"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, ReceiptText, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DiretoriaPageHeader from "@/components/portal/DiretoriaPageHeader";

type ProjectRow = { id: string; name: string; status: "active" | "paused" | "done"; budget_total?: number | null };

type BulletinStatus =
  | "em_analise"
  | "faturado"
  | "enviado_cliente"
  | "previsao_pagamento"
  | "pago"
  | "parcialmente_pago"
  | "atrasado"
  | "cancelado"
  | "outro";

type BulletinRow = {
  id: string;
  project_id: string;
  reference_month: string;
  bulletin_number: string | null;
  invoice_number: string | null;
  amount_total: number;
  paid_amount: number | null;
  status: BulletinStatus;
  issue_date: string | null;
  expected_payment_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
};

type DeliverableStatus =
  | "pending"
  | "in_progress"
  | "sent"
  | "approved"
  | "approved_with_comments"
  | "blocked"
  | "cancelled";

type DeliverableRow = {
  id: string;
  project_id: string;
  title: string;
  status: DeliverableStatus;
  actual_amount: number | null;
  budget_amount: number | null;
  financial_status?: "aberto" | "pendente" | "baixado" | null;
};

type BulletinHistoryRow = {
  id: string;
  bulletin_id: string;
  project_id: string;
  action: "created" | "status_updated" | "payment_tracking_updated";
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function isMissingColumnError(message?: string | null) {
  return (message ?? "").toLowerCase().includes("column") && (message ?? "").toLowerCase().includes("does not exist");
}

function isMissingTableError(message?: string | null) {
  const v = (message ?? "").toLowerCase();
  return v.includes("could not find the table") || (v.includes("relation") && v.includes("does not exist"));
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateBr(v?: string | null) {
  if (!v) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return v;
  return dt.toLocaleDateString("pt-BR");
}

function statusLabel(v: BulletinStatus) {
  if (v === "em_analise") return "Em analise";
  if (v === "faturado") return "Faturado";
  if (v === "enviado_cliente") return "Enviado ao cliente";
  if (v === "previsao_pagamento") return "Previsao de pagamento";
  if (v === "pago") return "Pago";
  if (v === "parcialmente_pago") return "Parcialmente pago";
  if (v === "atrasado") return "Atrasado";
  if (v === "cancelado") return "Cancelado";
  return "Outro";
}

function statusClass(v: BulletinStatus) {
  if (v === "pago") return "bg-emerald-50 text-emerald-700";
  if (v === "parcialmente_pago" || v === "previsao_pagamento") return "bg-amber-50 text-amber-700";
  if (v === "atrasado" || v === "cancelado") return "bg-rose-50 text-rose-700";
  if (v === "faturado" || v === "enviado_cliente") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function deliverableStatusLabel(v: DeliverableStatus | "all") {
  if (v === "all") return "Todos";
  if (v === "pending") return "Pendente";
  if (v === "in_progress") return "Em andamento";
  if (v === "sent") return "Enviado";
  if (v === "approved") return "Aprovado";
  if (v === "approved_with_comments") return "Aprovado com comentarios";
  if (v === "blocked") return "Bloqueado";
  if (v === "cancelled") return "Cancelado";
  return v;
}

function deliverableFinancialStatusLabel(v?: DeliverableRow["financial_status"]) {
  if (v === "baixado") return "Baixado";
  if (v === "pendente") return "Pendente";
  return "Aberto";
}

function historyActionLabel(v: BulletinHistoryRow["action"]) {
  if (v === "created") return "Criado";
  if (v === "status_updated") return "Status atualizado";
  return "Acompanhamento atualizado";
}

function toNumber(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function DiretoriaMedicoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [rows, setRows] = useState<BulletinRow[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [deliverablesLoading, setDeliverablesLoading] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulletinNumber, setBulletinNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amountTotal, setAmountTotal] = useState("");
  const [status, setStatus] = useState<BulletinStatus>("em_analise");
  const [issueDate, setIssueDate] = useState("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [deliverableStatusFilter, setDeliverableStatusFilter] = useState<"all" | DeliverableStatus>("all");
  const [selectedDeliverableIds, setSelectedDeliverableIds] = useState<string[]>([]);

  const [projectFilter, setProjectFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BulletinStatus>("all");
  const [editingBulletinId, setEditingBulletinId] = useState<string | null>(null);
  const [editingBulletinStatus, setEditingBulletinStatus] = useState<BulletinStatus>("em_analise");
  const [editingExpectedPaymentDate, setEditingExpectedPaymentDate] = useState("");
  const [editingPaidAmount, setEditingPaidAmount] = useState("");
  const [editingPaidAt, setEditingPaidAt] = useState("");
  const [editingNotes, setEditingNotes] = useState("");
  const [editingDeliverableStatusFilter, setEditingDeliverableStatusFilter] = useState<"all" | DeliverableStatus>("all");
  const [editingSelectedDeliverableIds, setEditingSelectedDeliverableIds] = useState<string[]>([]);
  const [editingBulletinHistoryById, setEditingBulletinHistoryById] = useState<Record<string, BulletinHistoryRow[]>>({});
  const [activeHistoryBulletinId, setActiveHistoryBulletinId] = useState<string | null>(null);
  const [openedActionMenuBulletinId, setOpenedActionMenuBulletinId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{
    top: number;
    left: number;
    connectorTop: number;
    connectorLeft: number;
    connectorHeight: number;
  } | null>(null);
  const paymentTableAreaRef = useRef<HTMLDivElement | null>(null);

  const projectById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const projectBudgetById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of projects) {
      const n = Number(p.budget_total);
      if (Number.isFinite(n)) map[p.id] = n;
    }
    return map;
  }, [projects]);

  const deliverableTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of deliverables) {
      map[d.id] = d.title || "Entregavel sem titulo";
    }
    return map;
  }, [deliverables]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, projectFilter, statusFilter]);

  const openedActionMenuRow = useMemo(
    () => filteredRows.find((r) => r.id === openedActionMenuBulletinId) ?? null,
    [filteredRows, openedActionMenuBulletinId]
  );

  const activeHistoryBulletinRow = useMemo(
    () => rows.find((r) => r.id === activeHistoryBulletinId) ?? null,
    [rows, activeHistoryBulletinId]
  );

  const deliverablesForProject = useMemo(
    () => deliverables.filter((d) => d.project_id === projectId),
    [deliverables, projectId],
  );

  const filteredDeliverablesForBulletin = useMemo(() => {
    return deliverablesForProject.filter((d) => {
      if (deliverableStatusFilter !== "all" && d.status !== deliverableStatusFilter) return false;
      return true;
    });
  }, [deliverablesForProject, deliverableStatusFilter]);

  const selectedDeliverables = useMemo(() => {
    const selected = new Set(selectedDeliverableIds);
    return deliverablesForProject.filter((d) => selected.has(d.id));
  }, [deliverablesForProject, selectedDeliverableIds]);

  const editingBulletinRow = useMemo(
    () => rows.find((r) => r.id === editingBulletinId) ?? null,
    [rows, editingBulletinId]
  );

  const deliverablesForEditingBulletinProject = useMemo(() => {
    if (!editingBulletinRow) return [] as DeliverableRow[];
    return deliverables.filter((d) => d.project_id === editingBulletinRow.project_id);
  }, [deliverables, editingBulletinRow]);

  const filteredDeliverablesForEditingBulletin = useMemo(() => {
    return deliverablesForEditingBulletinProject.filter((d) => {
      if (editingDeliverableStatusFilter !== "all" && d.status !== editingDeliverableStatusFilter) return false;
      return true;
    });
  }, [deliverablesForEditingBulletinProject, editingDeliverableStatusFilter]);

  const editingSelectedDeliverablesAmount = useMemo(() => {
    const selected = new Set(editingSelectedDeliverableIds);
    const selectedRows = deliverablesForEditingBulletinProject.filter((d) => selected.has(d.id));
    return selectedRows.reduce((acc, d) => {
      const actual = Number(d.actual_amount);
      if (Number.isFinite(actual) && actual > 0) return acc + actual;
      const budget = Number(d.budget_amount);
      if (Number.isFinite(budget) && budget > 0) return acc + budget;
      return acc;
    }, 0);
  }, [deliverablesForEditingBulletinProject, editingSelectedDeliverableIds]);

  const selectedDeliverablesAmount = useMemo(() => {
    const rawSum = selectedDeliverables.reduce((acc, d) => {
      const actual = Number(d.actual_amount);
      if (Number.isFinite(actual) && actual > 0) return acc + actual;
      const budget = Number(d.budget_amount);
      if (Number.isFinite(budget) && budget > 0) return acc + budget;
      return acc;
    }, 0);
    const projectBudget = Number(projectBudgetById[projectId] ?? NaN);
    const allSelectedForProject =
      !!projectId &&
      deliverablesForProject.length > 0 &&
      selectedDeliverableIds.length === deliverablesForProject.length;
    if (allSelectedForProject && Number.isFinite(projectBudget) && projectBudget > 0) {
      const diff = Math.abs(projectBudget - rawSum);
      if (diff <= 0.05) return projectBudget;
    }
    return rawSum;
  }, [selectedDeliverables, projectBudgetById, projectId, deliverablesForProject.length, selectedDeliverableIds.length]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const totalAmount = filteredRows.reduce((acc, r) => acc + (Number(r.amount_total) || 0), 0);
    const paid = filteredRows.reduce((acc, r) => {
      const paidAmt = Number(r.paid_amount);
      if (Number.isFinite(paidAmt)) return acc + paidAmt;
      if (r.status === "pago") return acc + (Number(r.amount_total) || 0);
      return acc;
    }, 0);
    const open = filteredRows.filter((r) => !["pago", "cancelado"].includes(r.status)).length;
    return { total, totalAmount, paid, open };
  }, [filteredRows]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setMeId(authData.user.id);

      const [projectsRes, rowsRes] = await Promise.all([
        supabase.from("projects").select("id,name,status,budget_total").order("created_at", { ascending: false }),
        supabase
          .from("project_measurement_bulletins")
          .select("id,project_id,reference_month,bulletin_number,invoice_number,amount_total,paid_amount,status,issue_date,expected_payment_date,paid_at,notes,created_at,updated_at")
          .order("reference_month", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (projectsRes.error) throw new Error(projectsRes.error.message);
      if (rowsRes.error) throw new Error(rowsRes.error.message);

      const nextProjects = (projectsRes.data ?? []) as ProjectRow[];
      setProjects(nextProjects);
      setRows((rowsRes.data ?? []) as BulletinRow[]);
      setProjectId((prev) => prev || nextProjects[0]?.id || "");
    } catch (e: unknown) {
      setProjects([]);
      setRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar medicoes/boletins.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectDeliverables(nextProjectId: string) {
    if (!nextProjectId) {
      setDeliverables([]);
      return;
    }
    setDeliverablesLoading(true);
    try {
      const res = await supabase
        .from("project_deliverables")
        .select("id,project_id,title,status,actual_amount,budget_amount,financial_status")
        .eq("project_id", nextProjectId)
        .order("created_at", { ascending: true });
      if (res.error && isMissingColumnError(res.error.message)) {
        const fallback = await supabase
          .from("project_deliverables")
          .select("id,project_id,title,status,actual_amount,budget_amount")
          .eq("project_id", nextProjectId)
          .order("created_at", { ascending: true });
        if (fallback.error) throw new Error(fallback.error.message);
        setDeliverables(
          ((fallback.data ?? []) as Array<Omit<DeliverableRow, "financial_status">>).map((d) => ({
            ...d,
            financial_status: "aberto",
          }))
        );
        return;
      }
      if (res.error) throw new Error(res.error.message);
      setDeliverables((res.data ?? []) as DeliverableRow[]);
    } catch (e: unknown) {
      setDeliverables([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar entregaveis do projeto.");
    } finally {
      setDeliverablesLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-action-menu-root='true']")) return;
      setOpenedActionMenuBulletinId(null);
      setActionMenuAnchor(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!activeHistoryBulletinId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveHistoryBulletinId(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeHistoryBulletinId]);

  useEffect(() => {
    setSelectedDeliverableIds([]);
    setDeliverableStatusFilter("all");
    if (!projectId) {
      setAmountTotal("");
      return;
    }
    void loadProjectDeliverables(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!selectedDeliverableIds.length) {
      setAmountTotal("");
      return;
    }
    setAmountTotal(selectedDeliverablesAmount.toFixed(2).replace(".", ","));
  }, [selectedDeliverableIds, selectedDeliverablesAmount]);

  async function syncDeliverablesFinancialStatusByIds(nextProjectId: string, deliverableIds: string[]) {
    const ids = Array.from(new Set(deliverableIds.filter(Boolean)));
    if (!ids.length) return;

    const itemsRes = await supabase
      .from("project_measurement_bulletin_items")
      .select("deliverable_id,bulletin_id")
      .eq("project_id", nextProjectId)
      .in("deliverable_id", ids);

    if (itemsRes.error) {
      if (isMissingTableError(itemsRes.error.message)) {
        throw new Error(
          "Falta a migration de vinculo entre boletim e entregaveis. Rode a migration para controlar status financeiro aberto/pendente/baixado."
        );
      }
      throw new Error(itemsRes.error.message);
    }

    const items = (itemsRes.data ?? []) as Array<{ deliverable_id: string; bulletin_id: string }>;
    const bulletinIds = Array.from(new Set(items.map((i) => i.bulletin_id).filter(Boolean)));

    if (!bulletinIds.length) {
      const { error: resetErr } = await supabase
        .from("project_deliverables")
        .update({ financial_status: "aberto" })
        .eq("project_id", nextProjectId)
        .in("id", ids);
      if (resetErr) throw new Error(resetErr.message);
      return;
    }

    const bulletinsRes = await supabase.from("project_measurement_bulletins").select("id,status").in("id", bulletinIds);
    if (bulletinsRes.error) throw new Error(bulletinsRes.error.message);

    const bulletinStatusById = new Map<string, BulletinStatus>(
      ((bulletinsRes.data ?? []) as Array<{ id: string; status: BulletinStatus }>).map((r) => [r.id, r.status])
    );

    const nextStatusByDeliverableId = new Map<string, "aberto" | "pendente" | "baixado">();
    for (const deliverableId of ids) {
      const linkedStatuses = items
        .filter((i) => i.deliverable_id === deliverableId)
        .map((i) => bulletinStatusById.get(i.bulletin_id))
        .filter(Boolean) as BulletinStatus[];

      if (!linkedStatuses.length) {
        nextStatusByDeliverableId.set(deliverableId, "aberto");
      } else if (linkedStatuses.some((s) => s === "pago")) {
        nextStatusByDeliverableId.set(deliverableId, "baixado");
      } else if (linkedStatuses.some((s) => s !== "cancelado")) {
        nextStatusByDeliverableId.set(deliverableId, "pendente");
      } else {
        nextStatusByDeliverableId.set(deliverableId, "aberto");
      }
    }

    for (const [deliverableId, financialStatus] of nextStatusByDeliverableId.entries()) {
      const { error } = await supabase
        .from("project_deliverables")
        .update({ financial_status: financialStatus })
        .eq("project_id", nextProjectId)
        .eq("id", deliverableId);
      if (error) throw new Error(error.message);
    }
  }

  async function insertBulletinHistory(
    bulletinId: string,
    projectIdValue: string,
    action: BulletinHistoryRow["action"],
    payload: Record<string, unknown>
  ) {
    const res = await supabase.from("project_measurement_bulletin_history").insert({
      bulletin_id: bulletinId,
      project_id: projectIdValue,
      action,
      actor_user_id: meId || null,
      payload,
    });
    if (res.error && !isMissingTableError(res.error.message)) {
      throw new Error(res.error.message);
    }
  }

  async function loadBulletinHistory(bulletinId: string, projectIdValue: string) {
    const res = await supabase
      .from("project_measurement_bulletin_history")
      .select("id,bulletin_id,project_id,action,actor_user_id,payload,created_at")
      .eq("bulletin_id", bulletinId)
      .eq("project_id", projectIdValue)
      .order("created_at", { ascending: false });
    if (res.error) {
      if (isMissingTableError(res.error.message)) {
        setEditingBulletinHistoryById((prev) => ({ ...prev, [bulletinId]: [] }));
        return;
      }
      throw new Error(res.error.message);
    }
    setEditingBulletinHistoryById((prev) => ({ ...prev, [bulletinId]: (res.data ?? []) as BulletinHistoryRow[] }));
  }

  async function openBulletinEditor(row: BulletinRow) {
    setEditingBulletinId(row.id);
    setEditingBulletinStatus(row.status);
    setEditingExpectedPaymentDate(row.expected_payment_date ?? "");
    setEditingPaidAmount(Number(row.paid_amount || 0) > 0 ? String(row.paid_amount).replace(".", ",") : "");
    setEditingPaidAt(row.paid_at ?? "");
    setEditingNotes(row.notes ?? "");
    setEditingDeliverableStatusFilter("all");
    try {
      await loadProjectDeliverables(row.project_id);
      const itemsRes = await supabase
        .from("project_measurement_bulletin_items")
        .select("deliverable_id")
        .eq("bulletin_id", row.id)
        .eq("project_id", row.project_id);
      if (itemsRes.error) {
        if (!isMissingTableError(itemsRes.error.message)) throw new Error(itemsRes.error.message);
        setEditingSelectedDeliverableIds([]);
      } else {
        setEditingSelectedDeliverableIds(((itemsRes.data ?? []) as Array<{ deliverable_id: string }>).map((x) => x.deliverable_id));
      }
      await loadBulletinHistory(row.id, row.project_id);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir edicao do boletim.");
    }
  }

  function closeBulletinEditor() {
    setEditingBulletinId(null);
    setEditingSelectedDeliverableIds([]);
    setEditingDeliverableStatusFilter("all");
  }

  async function createBulletin() {
    if (!projectId) return setMsg("Selecione o projeto.");
    if (!referenceMonth) return setMsg("Informe a referencia.");
    if (!selectedDeliverableIds.length) return setMsg("Selecione ao menos um entregavel para gerar o boletim.");
    const amount = toNumber(amountTotal.trim());
    if (!Number.isFinite(amount) || amount < 0) return setMsg("Informe valor valido.");

    const paid = paidAmount.trim() ? toNumber(paidAmount.trim()) : NaN;
    if (paidAmount.trim() && (!Number.isFinite(paid) || paid < 0)) return setMsg("Valor pago invalido.");

    setSaving(true);
    setMsg("");
    try {
      const insertRes = await supabase
        .from("project_measurement_bulletins")
        .insert({
          project_id: projectId,
          reference_month: referenceMonth,
          bulletin_number: bulletinNumber.trim() || null,
          invoice_number: invoiceNumber.trim() || null,
          amount_total: amount,
          paid_amount: Number.isFinite(paid) ? paid : null,
          status,
          issue_date: issueDate || null,
          expected_payment_date: expectedPaymentDate || null,
          paid_at: paidAt || null,
          notes: notes.trim() || null,
          created_by: meId || null,
          updated_by: meId || null,
        })
        .select("id")
        .single();
      if (insertRes.error) throw new Error(insertRes.error.message);
      const bulletinId = insertRes.data.id;

      const deliverableIdsToMark = selectedDeliverableIds.filter(Boolean);
      if (deliverableIdsToMark.length > 0) {
        const itemsInsertRes = await supabase.from("project_measurement_bulletin_items").insert(
          deliverableIdsToMark.map((deliverableId) => ({
            bulletin_id: bulletinId,
            project_id: projectId,
            deliverable_id: deliverableId,
            created_by: meId || null,
          }))
        );
        if (itemsInsertRes.error) {
          await supabase.from("project_measurement_bulletins").delete().eq("id", bulletinId);
          if (isMissingTableError(itemsInsertRes.error.message)) {
            throw new Error(
              "Falta a migration de vinculo entre boletim e entregaveis. Rode a migration para gerar boletins com controle financeiro aberto/pendente/baixado."
            );
          }
          throw new Error(itemsInsertRes.error.message);
        }
        await syncDeliverablesFinancialStatusByIds(projectId, deliverableIdsToMark);
      }
      await insertBulletinHistory(bulletinId, projectId, "created", {
        status,
        expected_payment_date: expectedPaymentDate || null,
        paid_at: paidAt || null,
        paid_amount: Number.isFinite(paid) ? paid : null,
        deliverable_ids: deliverableIdsToMark,
        deliverable_titles: deliverableIdsToMark.map((id) => deliverableTitleById[id] ?? id),
      });

      setBulletinNumber("");
      setInvoiceNumber("");
      setAmountTotal("");
      setStatus("em_analise");
      setIssueDate("");
      setExpectedPaymentDate("");
      setPaidAmount("");
      setPaidAt("");
      setNotes("");
      setSelectedDeliverableIds([]);
      setDeliverableStatusFilter("all");
      setMsg(`Medicao/boletim registrado. Status atual: ${statusLabel(status)}.`);
      await load();
      await loadProjectDeliverables(projectId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar medicao/boletim.");
    } finally {
      setSaving(false);
    }
  }

  function toggleDeliverableSelection(id: string) {
    setSelectedDeliverableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllFilteredDeliverables() {
    const filteredIds = filteredDeliverablesForBulletin
      .filter((d) => (d.financial_status ?? "aberto") === "aberto")
      .map((d) => d.id);
    setSelectedDeliverableIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => prevSet.has(id));
      if (allSelected) {
        return prev.filter((id) => !filteredIds.includes(id));
      }
      const next = new Set(prev);
      for (const id of filteredIds) next.add(id);
      return Array.from(next);
    });
  }

  function toggleEditingDeliverableSelection(id: string) {
    setEditingSelectedDeliverableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllFilteredEditingDeliverables() {
    const filteredIds = filteredDeliverablesForEditingBulletin
      .filter((d) => {
        const isLinked = editingSelectedDeliverableIds.includes(d.id);
        const isOpen = (d.financial_status ?? "aberto") === "aberto";
        return isLinked || isOpen;
      })
      .map((d) => d.id);
    setEditingSelectedDeliverableIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => prevSet.has(id));
      if (allSelected) return prev.filter((id) => !filteredIds.includes(id));
      const next = new Set(prev);
      for (const id of filteredIds) next.add(id);
      return Array.from(next);
    });
  }

  async function savePaymentTracking(row: BulletinRow) {
    setSaving(true);
    setMsg("");
    try {
      const nextPaid = editingPaidAmount.trim() ? toNumber(editingPaidAmount.trim()) : NaN;
      if (editingPaidAmount.trim() && (!Number.isFinite(nextPaid) || nextPaid < 0)) {
        throw new Error("Valor pago invalido.");
      }
      if (!editingSelectedDeliverableIds.length) {
        throw new Error("Selecione ao menos 1 entregavel para manter o boletim.");
      }
      if ((editingBulletinStatus === "previsao_pagamento" || editingBulletinStatus === "atrasado") && !editingExpectedPaymentDate) {
        throw new Error("Informe a previsao de pagamento para o status selecionado.");
      }
      if ((editingBulletinStatus === "pago" || editingBulletinStatus === "parcialmente_pago") && !editingPaidAt) {
        throw new Error("Informe a data de pagamento para o status selecionado.");
      }
      if ((editingBulletinStatus === "pago" || editingBulletinStatus === "parcialmente_pago") && !editingPaidAmount.trim()) {
        throw new Error("Informe o valor pago para o status selecionado.");
      }
      if (editingBulletinStatus === "parcialmente_pago" && Number.isFinite(nextPaid) && nextPaid >= Number(row.amount_total || 0)) {
        throw new Error("Para 'Parcialmente pago', o valor pago deve ser menor que o valor total do boletim.");
      }
      if (editingBulletinStatus === "pago" && Number.isFinite(nextPaid) && nextPaid <= 0) {
        throw new Error("Para 'Pago', informe um valor pago maior que zero.");
      }
      const nextAmountTotal = editingSelectedDeliverablesAmount;

      const { error: updateErr } = await supabase
        .from("project_measurement_bulletins")
        .update({
          amount_total: nextAmountTotal,
          status: editingBulletinStatus,
          expected_payment_date: editingExpectedPaymentDate || null,
          paid_amount: Number.isFinite(nextPaid) ? nextPaid : null,
          paid_at: editingPaidAt || null,
          notes: editingNotes.trim() || null,
          updated_by: meId || null,
        })
        .eq("id", row.id);
      if (updateErr) throw new Error(updateErr.message);

      const currentItemsRes = await supabase
        .from("project_measurement_bulletin_items")
        .select("deliverable_id")
        .eq("bulletin_id", row.id)
        .eq("project_id", row.project_id);
      if (currentItemsRes.error) {
        if (isMissingTableError(currentItemsRes.error.message)) {
          throw new Error("Falta a migration de vinculo entre boletim e entregaveis.");
        }
        throw new Error(currentItemsRes.error.message);
      }
      const currentIds = ((currentItemsRes.data ?? []) as Array<{ deliverable_id: string }>).map((x) => x.deliverable_id);
      const nextIds = Array.from(new Set(editingSelectedDeliverableIds.filter(Boolean)));
      const toRemove = currentIds.filter((id) => !nextIds.includes(id));
      const toAdd = nextIds.filter((id) => !currentIds.includes(id));

      if (toRemove.length) {
        const { error } = await supabase
          .from("project_measurement_bulletin_items")
          .delete()
          .eq("bulletin_id", row.id)
          .eq("project_id", row.project_id)
          .in("deliverable_id", toRemove);
        if (error) throw new Error(error.message);
      }
      if (toAdd.length) {
        const { error } = await supabase.from("project_measurement_bulletin_items").insert(
          toAdd.map((deliverableId) => ({
            bulletin_id: row.id,
            project_id: row.project_id,
            deliverable_id: deliverableId,
            created_by: meId || null,
          }))
        );
        if (error) throw new Error(error.message);
      }

      await syncDeliverablesFinancialStatusByIds(row.project_id, Array.from(new Set([...currentIds, ...nextIds])));
      await insertBulletinHistory(row.id, row.project_id, "payment_tracking_updated", {
        from_status: row.status,
        to_status: editingBulletinStatus,
        amount_total_before: row.amount_total ?? null,
        amount_total_after: nextAmountTotal,
        expected_payment_date_before: row.expected_payment_date ?? null,
        expected_payment_date_after: editingExpectedPaymentDate || null,
        paid_at_before: row.paid_at ?? null,
        paid_at_after: editingPaidAt || null,
        paid_amount_before: row.paid_amount ?? null,
        paid_amount_after: Number.isFinite(nextPaid) ? nextPaid : null,
        deliverables_added: toAdd,
        deliverables_added_titles: toAdd.map((id) => deliverableTitleById[id] ?? id),
        deliverables_removed: toRemove,
        deliverables_removed_titles: toRemove.map((id) => deliverableTitleById[id] ?? id),
      });

      setMsg("Acompanhamento de pagamento atualizado com sucesso.");
      await load();
      await loadProjectDeliverables(row.project_id);
      await loadBulletinHistory(row.id, row.project_id);
      setEditingBulletinId(null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar acompanhamento de pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <DiretoriaPageHeader
        icon={ReceiptText}
        title="Diretoria - Medicoes e boletins"
        subtitle="Gere medicao/boletim para faturamento ao cliente e acompanhe previsao e pagamento."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        }
      />

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">{msg}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Gerar medicao/boletim</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Selecione...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Referencia
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as BulletinStatus)}>
              <option value="em_analise">Em analise</option>
              <option value="faturado">Faturado</option>
              <option value="enviado_cliente">Enviado ao cliente</option>
              <option value="previsao_pagamento">Previsao de pagamento</option>
              <option value="pago">Pago</option>
              <option value="parcialmente_pago">Parcialmente pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Numero do boletim
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={bulletinNumber} onChange={(e) => setBulletinNumber(e.target.value)} placeholder="Ex: MED-2026-015" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Numero da nota
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex: NF-10234" />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Selecionar entregaveis para o boletim</p>
              <p className="text-xs text-slate-600">
                Filtre por status, marque os documentos e o valor total sera calculado automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Status do entregavel
                <select
                  className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={deliverableStatusFilter}
                  onChange={(e) => setDeliverableStatusFilter(e.target.value as "all" | DeliverableStatus)}
                >
                  <option value="all">Todos</option>
                  <option value="approved">Aprovado</option>
                  <option value="approved_with_comments">Aprovado com comentarios</option>
                  <option value="sent">Enviado</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="pending">Pendente</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <button
                type="button"
                onClick={toggleSelectAllFilteredDeliverables}
                disabled={!filteredDeliverablesForBulletin.length}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Marcar filtrados
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white">
            {deliverablesLoading ? (
              <div className="p-3 text-sm text-slate-500">Carregando entregaveis...</div>
            ) : !projectId ? (
              <div className="p-3 text-sm text-slate-500">Selecione um projeto para listar os entregaveis.</div>
            ) : !filteredDeliverablesForBulletin.length ? (
              <div className="p-3 text-sm text-slate-500">
                Nenhum entregavel para o filtro: {deliverableStatusLabel(deliverableStatusFilter)}.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredDeliverablesForBulletin.map((d) => {
                  const selected = selectedDeliverableIds.includes(d.id);
                  const isFinancialOpen = (d.financial_status ?? "aberto") === "aberto";
                  const amount =
                    (Number.isFinite(Number(d.actual_amount)) && Number(d.actual_amount) > 0
                      ? Number(d.actual_amount)
                      : Number.isFinite(Number(d.budget_amount)) && Number(d.budget_amount) > 0
                        ? Number(d.budget_amount)
                        : 0);
                  return (
                    <li key={d.id} className="p-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          checked={selected}
                          disabled={!isFinancialOpen}
                          onChange={() => toggleDeliverableSelection(d.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900">{d.title}</div>
                          <div className="text-xs text-slate-600">
                            Status: {deliverableStatusLabel(d.status)} | Financeiro: {deliverableFinancialStatusLabel(d.financial_status)} | Valor: {fmtMoney(amount)}
                          </div>
                          {!isFinancialOpen ? (
                            <div
                              className={`mt-1 text-[11px] font-semibold ${
                                d.financial_status === "baixado" ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              {d.financial_status === "baixado"
                                ? "Documento ja baixado em boletim."
                                : "Documento vinculado a boletim pendente de pagamento."}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-600">Entregaveis filtrados</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{filteredDeliverablesForBulletin.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-600">Selecionados</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{selectedDeliverableIds.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-600">Soma dos documentos</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(selectedDeliverablesAmount)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Valor total (R$)
            <input
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
              value={amountTotal}
              readOnly
              placeholder="Selecione os entregaveis"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Data emissao
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Previsao pagamento
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={expectedPaymentDate} onChange={(e) => setExpectedPaymentDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Valor pago
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0,00" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Data pagamento
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          Observacoes
          <textarea className="min-h-[88px] rounded-xl border border-slate-200 p-3 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informacoes complementares da medicao/boletim..." />
        </label>
        <button
          type="button"
          onClick={() => void createBulletin()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save size={16} /> Registrar boletim
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Acompanhamento de pagamento</h2>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Boletins</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Em aberto</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Valor total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtMoney(stats.totalAmount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Pago</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtMoney(stats.paid)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | BulletinStatus)}>
              <option value="all">Todos</option>
              <option value="em_analise">Em analise</option>
              <option value="faturado">Faturado</option>
              <option value="enviado_cliente">Enviado ao cliente</option>
              <option value="previsao_pagamento">Previsao de pagamento</option>
              <option value="pago">Pago</option>
              <option value="parcialmente_pago">Parcialmente pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
              <option value="outro">Outro</option>
            </select>
          </label>
        </div>

        <div ref={paymentTableAreaRef} className="relative">
          <div className="overflow-x-auto">
          <table className="min-w-[1160px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Projeto</th>
                <th className="p-3">Referencia</th>
                <th className="p-3">Boletim/NF</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Pago</th>
                <th className="p-3">Previsao</th>
                <th className="p-3">Status</th>
                <th className="p-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((r) => {
                  const isEditing = editingBulletinId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr key={r.id} className="border-t">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{projectById[r.project_id] ?? r.project_id}</div>
                          <div className="text-xs text-slate-500">{r.notes ?? "-"}</div>
                        </td>
                        <td className="p-3 text-slate-600">{r.reference_month}</td>
                        <td className="p-3 text-slate-600">{r.bulletin_number ?? "-"} / {r.invoice_number ?? "-"}</td>
                        <td className="p-3 text-right font-semibold text-slate-900">{fmtMoney(Number(r.amount_total) || 0)}</td>
                        <td className="p-3 text-right text-slate-700">{fmtMoney(Number(r.paid_amount) || 0)}</td>
                        <td className="p-3 text-slate-600">{r.expected_payment_date ?? "-"}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="relative inline-flex" data-action-menu-root="true">
                            <button
                              type="button"
                              onClick={(event) => {
                                if (openedActionMenuBulletinId === r.id) {
                                  setOpenedActionMenuBulletinId(null);
                                  setActionMenuAnchor(null);
                                  return;
                                }
                                const sectionEl = paymentTableAreaRef.current;
                                const buttonEl = event.currentTarget;
                                if (sectionEl) {
                                  const sectionRect = sectionEl.getBoundingClientRect();
                                  const buttonRect = buttonEl.getBoundingClientRect();
                                  const menuWidth = 208;
                                  const left = Math.max(
                                    12,
                                    Math.min(
                                      buttonRect.right - sectionRect.left - menuWidth,
                                      sectionRect.width - menuWidth - 12
                                    )
                                  );
                                  const anchorRight = buttonRect.right - sectionRect.left - 18;
                                  const connectorLeft = Math.max(left + 16, Math.min(anchorRight, left + menuWidth - 16));
                                  const top = buttonRect.bottom - sectionRect.top + 4;
                                  const connectorTop = buttonRect.bottom - sectionRect.top;
                                  setActionMenuAnchor({
                                    top,
                                    left,
                                    connectorTop,
                                    connectorLeft,
                                    connectorHeight: 8,
                                  });
                                } else {
                                  setActionMenuAnchor(null);
                                }
                                setOpenedActionMenuBulletinId(r.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <MoreHorizontal size={14} /> Acoes
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="border-t bg-slate-50">
                          <td className="p-3" colSpan={8}>
                            <div className="space-y-3">
                              {isEditing && (
                                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-slate-900">Editar acompanhamento de pagamento</p>
                                    <button type="button" onClick={closeBulletinEditor} className="text-xs font-semibold text-slate-600">Fechar</button>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-4">
                                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-2">
                                      <label className="grid gap-1 text-xs font-semibold text-indigo-900">Status do boletim
                                        <select className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm text-slate-900" value={editingBulletinStatus} onChange={(e) => setEditingBulletinStatus(e.target.value as BulletinStatus)}>
                                          <option value="em_analise">Em analise</option><option value="faturado">Faturado</option><option value="enviado_cliente">Enviado ao cliente</option><option value="previsao_pagamento">Previsao de pagamento</option><option value="pago">Pago</option><option value="parcialmente_pago">Parcialmente pago</option><option value="atrasado">Atrasado</option><option value="cancelado">Cancelado</option><option value="outro">Outro</option>
                                        </select>
                                      </label>
                                      <p className="mt-1 text-[11px] font-medium text-indigo-800/80">Alteracao aplicada ao salvar acompanhamento.</p>
                                    </div>
                                    <div
                                      className={
                                        editingBulletinStatus === "previsao_pagamento" || editingBulletinStatus === "atrasado"
                                          ? "rounded-lg border border-amber-200 bg-amber-50/70 p-2"
                                          : ""
                                      }
                                    >
                                      <label className="grid gap-1 text-xs font-semibold text-slate-700">Previsao pagamento
                                        <input
                                          type="date"
                                          className={`h-10 rounded-lg px-3 text-sm ${
                                            editingBulletinStatus === "previsao_pagamento" || editingBulletinStatus === "atrasado"
                                              ? "border border-amber-200 bg-white"
                                              : "border border-slate-200"
                                          }`}
                                          value={editingExpectedPaymentDate}
                                          onChange={(e) => setEditingExpectedPaymentDate(e.target.value)}
                                        />
                                      </label>
                                      {editingBulletinStatus === "previsao_pagamento" || editingBulletinStatus === "atrasado" ? (
                                        <p className="mt-1 text-[11px] font-medium text-amber-800/80">Informe/atualize a previsao para acompanhamento financeiro.</p>
                                      ) : null}
                                    </div>
                                    <label className="grid gap-1 text-xs font-semibold text-slate-700">Valor pago
                                      <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={editingPaidAmount} onChange={(e) => setEditingPaidAmount(e.target.value)} placeholder="0,00" />
                                    </label>
                                    <div
                                      className={
                                        editingBulletinStatus === "pago" || editingBulletinStatus === "parcialmente_pago"
                                          ? "rounded-lg border border-emerald-200 bg-emerald-50/70 p-2"
                                          : ""
                                      }
                                    >
                                      <label className="grid gap-1 text-xs font-semibold text-slate-700">Data pagamento
                                        <input
                                          type="date"
                                          className={`h-10 rounded-lg px-3 text-sm ${
                                            editingBulletinStatus === "pago" || editingBulletinStatus === "parcialmente_pago"
                                              ? "border border-emerald-200 bg-white"
                                              : "border border-slate-200"
                                          }`}
                                          value={editingPaidAt}
                                          onChange={(e) => setEditingPaidAt(e.target.value)}
                                        />
                                      </label>
                                      {editingBulletinStatus === "pago" || editingBulletinStatus === "parcialmente_pago" ? (
                                        <p className="mt-1 text-[11px] font-medium text-emerald-800/80">Preencha a data do pagamento para consolidar o acompanhamento.</p>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-[11px] font-semibold text-slate-600">Valor do boletim (automatico pelos entregaveis selecionados)</p>
                                      <p className="mt-1 text-lg font-semibold text-slate-900">{fmtMoney(editingSelectedDeliverablesAmount)}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                      Ao adicionar/remover documentos, o valor total do boletim sera ajustado automaticamente ao salvar.
                                    </div>
                                  </div>
                                  <label className="grid gap-1 text-xs font-semibold text-slate-700">Observacoes
                                    <textarea className="min-h-[70px] rounded-lg border border-slate-200 p-2 text-sm" value={editingNotes} onChange={(e) => setEditingNotes(e.target.value)} />
                                  </label>
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                      <label className="grid gap-1 text-xs font-semibold text-slate-700">Filtrar entregaveis (status)
                                        <select className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm" value={editingDeliverableStatusFilter} onChange={(e) => setEditingDeliverableStatusFilter(e.target.value as "all" | DeliverableStatus)}>
                                          <option value="all">Todos</option><option value="approved">Aprovado</option><option value="approved_with_comments">Aprovado com comentarios</option><option value="sent">Enviado</option><option value="in_progress">Em andamento</option><option value="pending">Pendente</option><option value="blocked">Bloqueado</option><option value="cancelled">Cancelado</option>
                                        </select>
                                      </label>
                                      <button type="button" onClick={toggleSelectAllFilteredEditingDeliverables} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">Marcar filtrados</button>
                                    </div>
                                    <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white">
                                      <ul className="divide-y divide-slate-100">
                                        {filteredDeliverablesForEditingBulletin.map((d) => {
                                          const checked = editingSelectedDeliverableIds.includes(d.id);
                                          const isOpen = (d.financial_status ?? "aberto") === "aberto";
                                          const canToggle = checked || isOpen;
                                          const amount = (Number(d.actual_amount) || Number(d.budget_amount) || 0);
                                          return (
                                            <li key={`${r.id}-${d.id}`} className="p-2">
                                              <label className={`flex items-start gap-2 ${canToggle ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}>
                                                <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} disabled={!canToggle} onChange={() => toggleEditingDeliverableSelection(d.id)} />
                                                <div className="text-xs text-slate-700">
                                                  <div className="font-semibold text-slate-900">{d.title}</div>
                                                  <div>Status: {deliverableStatusLabel(d.status)} | Financeiro: {deliverableFinancialStatusLabel(d.financial_status)} | {fmtMoney(amount)}</div>
                                                </div>
                                              </label>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                      <span>Selecionados: {editingSelectedDeliverableIds.length}</span>
                                      <span>Soma: {fmtMoney(editingSelectedDeliverablesAmount)}</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button type="button" onClick={closeBulletinEditor} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                                    <button type="button" disabled={saving} onClick={() => void savePaymentTracking(r)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Salvar acompanhamento</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={8}>
                    Nenhum boletim encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {openedActionMenuRow && actionMenuAnchor ? (
            <>
              <div
                className="pointer-events-none absolute z-40 w-1 rounded-full bg-indigo-300"
                style={{
                  left: actionMenuAnchor.connectorLeft,
                  top: actionMenuAnchor.connectorTop,
                  height: actionMenuAnchor.connectorHeight,
                }}
                data-action-menu-root="true"
              />
              <div
                className="pointer-events-none absolute z-40 h-4 w-4 rotate-45 rounded-[2px] border-2 border-indigo-200 bg-white shadow-sm"
                style={{
                  left: actionMenuAnchor.connectorLeft - 6,
                  top: actionMenuAnchor.connectorTop + 2,
                }}
                data-action-menu-root="true"
              />
              <div
                className="absolute z-50 w-[208px] max-w-[calc(100%-24px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                style={{ left: actionMenuAnchor.left, top: actionMenuAnchor.top }}
                data-action-menu-root="true"
              >
                <div className="mb-2 border-b border-slate-100 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Acoes do boletim
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenedActionMenuBulletinId(null);
                    setActionMenuAnchor(null);
                    void openBulletinEditor(openedActionMenuRow);
                  }}
                  className="mb-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {editingBulletinId === openedActionMenuRow.id ? "Editando..." : "Editar"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetRow = openedActionMenuRow;
                    setOpenedActionMenuBulletinId(null);
                    setActionMenuAnchor(null);
                    setActiveHistoryBulletinId(targetRow.id);
                    if (!editingBulletinHistoryById[targetRow.id]) {
                      await loadBulletinHistory(targetRow.id, targetRow.project_id);
                    }
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Historico
                </button>
              </div>
            </>
          ) : null}
        </div>

        {activeHistoryBulletinRow ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/35 p-4"
            onClick={() => setActiveHistoryBulletinId(null)}
          >
            <div
              className="relative w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setActiveHistoryBulletinId(null)}
                className="absolute right-4 top-4 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Fechar
              </button>
              <div className="mb-3 pr-20">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Base do historico do boletim</p>
                  <p className="text-xs text-slate-500">
                    Ref.: {activeHistoryBulletinRow.reference_month} | Boletim/NF: {activeHistoryBulletinRow.bulletin_number ?? "-"} / {activeHistoryBulletinRow.invoice_number ?? "-"}
                  </p>
                </div>
              </div>
              {(() => {
                const historyRows = editingBulletinHistoryById[activeHistoryBulletinRow.id] ?? [];
                return historyRows.length ? (
                  <div className="max-h-[65vh] overflow-auto pr-1">
                    <ul className="space-y-2">
                      {historyRows.map((h) => {
                        const p = (h.payload ?? {}) as Record<string, unknown>;
                        const fromStatus = typeof p.from_status === "string" ? (p.from_status as BulletinStatus) : null;
                        const toStatus = typeof p.to_status === "string" ? (p.to_status as BulletinStatus) : null;
                        const prevExp = typeof p.expected_payment_date_before === "string" ? String(p.expected_payment_date_before) : null;
                        const nextExp = typeof p.expected_payment_date_after === "string" ? String(p.expected_payment_date_after) : (typeof p.expected_payment_date === "string" ? String(p.expected_payment_date) : null);
                        const prevPaidAt = typeof p.paid_at_before === "string" ? String(p.paid_at_before) : null;
                        const nextPaidAt = typeof p.paid_at_after === "string" ? String(p.paid_at_after) : (typeof p.paid_at === "string" ? String(p.paid_at) : null);
                        const prevPaidAmt = typeof p.paid_amount_before === "number" ? p.paid_amount_before : null;
                        const nextPaidAmt = typeof p.paid_amount_after === "number" ? p.paid_amount_after : (typeof p.paid_amount === "number" ? p.paid_amount : null);
                        const deliverablesAdded = Array.isArray(p.deliverables_added) ? (p.deliverables_added as unknown[]).length : Array.isArray(p.deliverable_ids) ? (p.deliverable_ids as unknown[]).length : 0;
                        const deliverablesRemoved = Array.isArray(p.deliverables_removed) ? (p.deliverables_removed as unknown[]).length : 0;
                        const deliverablesAddedTitles = Array.isArray(p.deliverables_added_titles)
                          ? (p.deliverables_added_titles as unknown[]).map(String)
                          : Array.isArray(p.deliverable_titles)
                            ? (p.deliverable_titles as unknown[]).map(String)
                            : [];
                        const deliverablesRemovedTitles = Array.isArray(p.deliverables_removed_titles)
                          ? (p.deliverables_removed_titles as unknown[]).map(String)
                          : [];
                        return (
                          <li key={h.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-slate-900">{historyActionLabel(h.action)}</div>
                              <div>{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                            </div>
                            <ul className="mt-2 space-y-1">
                              {fromStatus || toStatus ? (
                                <li>
                                  Status: {fromStatus ? <span>{statusLabel(fromStatus)}</span> : <span>-</span>}
                                  {" -> "}
                                  {toStatus ? <span>{statusLabel(toStatus)}</span> : <span>-</span>}
                                </li>
                              ) : null}
                              {(typeof p.amount_total_before === "number" || typeof p.amount_total_after === "number") &&
                              Number(p.amount_total_before ?? 0) !== Number(p.amount_total_after ?? 0) ? (
                                <li>
                                  Valor do boletim: {fmtMoney(Number(p.amount_total_before ?? 0))} {"->"} {fmtMoney(Number(p.amount_total_after ?? 0))}
                                </li>
                              ) : null}
                              {(prevExp || nextExp) && prevExp !== nextExp ? (
                                <li>Previsao pagamento: {fmtDateBr(prevExp)} {"->"} {fmtDateBr(nextExp)}</li>
                              ) : null}
                              {(prevPaidAt || nextPaidAt) && prevPaidAt !== nextPaidAt ? (
                                <li>Data pagamento: {fmtDateBr(prevPaidAt)} {"->"} {fmtDateBr(nextPaidAt)}</li>
                              ) : null}
                              {(prevPaidAmt !== null || nextPaidAmt !== null) && prevPaidAmt !== nextPaidAmt ? (
                                <li>Valor pago: {fmtMoney(Number(prevPaidAmt || 0))} {"->"} {fmtMoney(Number(nextPaidAmt || 0))}</li>
                              ) : null}
                              {deliverablesAdded > 0 ? (
                                <li>
                                  Entregaveis adicionados: {deliverablesAddedTitles.length ? deliverablesAddedTitles.join(", ") : `${deliverablesAdded}`}
                                </li>
                              ) : null}
                              {deliverablesRemoved > 0 ? (
                                <li>
                                  Entregaveis removidos: {deliverablesRemovedTitles.length ? deliverablesRemovedTitles.join(", ") : `${deliverablesRemoved}`}
                                </li>
                              ) : null}
                              {h.action === "created" && !fromStatus && !toStatus && deliverablesAdded === 0 ? (
                                <li>Boletim criado e vinculado ao projeto.</li>
                              ) : null}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Sem historico registrado (ou migration ainda nao aplicada).</div>
                );
              })()}
            </div>
          </div>
        ) : null}

      </section>
    </div>
  );
}
