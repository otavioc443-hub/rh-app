"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CircleHelp, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { PageHelpModal } from "@/components/ui/PageHelpModal";

type ProjectRow = {
  id: string;
  name: string;
  status: "active" | "paused" | "done";
  budget_total: number | null;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  company_id: string | null;
  created_at: string;
};

type ProjectClientRow = {
  id: string;
  name: string;
  active: boolean | null;
  company_id: string | null;
};

type ExtraPaymentRow = {
  id: string;
  project_id: string;
  amount: number | null;
  status: "pending" | "approved" | "paid" | "rejected" | null;
  created_at: string | null;
  reference_month: string | null;
};

type IndirectCostRow = {
  id: string;
  project_id: string;
  cost_type: "monthly" | "one_time" | "percentage_payroll";
  amount: number | null;
  notes?: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
};

type CollaboratorRow = {
  id: string;
  user_id: string | null;
  nome?: string | null;
  salario: number | null;
  is_active: boolean | null;
};

type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  member_role: "gestor" | "coordenador" | "colaborador";
};

type ProjectAllocationRow = {
  project_id: string;
  user_id: string;
  allocation_pct: number | null;
  created_at: string | null;
};

type RemittanceRow = {
  id: string;
  total_amount: number | null;
  status: "draft" | "payment_pending" | "paid" | "cancelled" | null;
  due_date: string | null;
  created_at: string | null;
  paid_at: string | null;
};

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
  amount_total: number | null;
  paid_amount: number | null;
  status: BulletinStatus;
  expected_payment_date: string | null;
  paid_at: string | null;
  created_at: string | null;
};

type DeliverableFinancialStatus = "aberto" | "pendente" | "baixado" | null;
type DeliverableWorkflowStatus = "pending" | "in_progress" | "sent" | "approved" | "approved_with_comments";

type DeliverableRow = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  review_due_at: string | null;
  financial_status: DeliverableFinancialStatus;
  status: DeliverableWorkflowStatus;
  submitted_at: string | null;
};

type WindowKey = "30" | "90" | "180" | "365" | "all" | "custom";
type ProjectSortKey =
  | "name"
  | "status"
  | "budget"
  | "direct"
  | "indirect"
  | "payroll"
  | "realTotal"
  | "pending"
  | "received"
  | "receiptRate"
  | "margin";
type SortDir = "asc" | "desc";

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

function formatDateBR(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = parseDateOnly(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function monthKey(dateLike: string | null | undefined) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}

function monthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-");
  if (!y || !m) return yyyyMm;
  return `${m}/${y}`;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthsBetween(start: Date, end: Date) {
  const out: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit) {
    out.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function activeMonthsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  costStart?: string | null,
  costEnd?: string | null,
  fallbackStart?: string | null
) {
  const parsedCostStart = parseDateOnly(costStart);
  const parsedFallbackStart = parseDateOnly(fallbackStart);
  const hasExplicitWindow = Boolean(parsedCostStart || parseDateOnly(costEnd));
  const effectiveStart = parsedCostStart ?? parsedFallbackStart ?? rangeStart;
  const effectiveEnd = parseDateOnly(costEnd) ?? (hasExplicitWindow ? rangeEnd : effectiveStart);
  const clippedStart = effectiveStart > rangeStart ? effectiveStart : rangeStart;
  const clippedEnd = effectiveEnd < rangeEnd ? effectiveEnd : rangeEnd;
  if (clippedStart > clippedEnd) return 0;
  return monthsBetween(startOfMonth(clippedStart), startOfMonth(clippedEnd)).length;
}

function isLegacyAbsolutePercentageValue(amount: number) {
  return amount > 100;
}

function parseNoteTag(notes: string | null | undefined, key: string) {
  const src = String(notes ?? "");
  const marker = `${key}=`;
  const start = src.indexOf(marker);
  if (start < 0) return "";
  const tail = src.slice(start + marker.length);
  const end = tail.indexOf(" | ");
  const value = (end >= 0 ? tail.slice(0, end) : tail).trim();
  return value;
}

function parseIndirectCollaboratorName(notes: string | null | undefined) {
  const source = parseNoteTag(notes, "Fonte");
  if (!source.toLowerCase().startsWith("colaborador:")) return "";
  return source.slice("colaborador:".length).trim();
}

function isIntegralSingleProjectIndirect(notes: string | null | undefined) {
  return parseNoteTag(notes, "Rateio").toLowerCase() === "integral (projeto unico)";
}

function bulletinStatusLabel(v: BulletinStatus) {
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

function deliverableStatusLabel(status: DeliverableWorkflowStatus) {
  if (status === "pending") return "Pendente";
  if (status === "in_progress") return "Em andamento";
  if (status === "sent") return "Enviado";
  if (status === "approved") return "Aprovado";
  return "Aprovado com comentarios";
}

function deliverableFinancialStatusLabel(status: DeliverableFinancialStatus) {
  if (status === "baixado") return "Baixado";
  if (status === "pendente") return "Pendente";
  return "Aberto";
}

function getDeliverableRealizationPct(deliverable: DeliverableRow) {
  if (deliverable.financial_status === "baixado") return 100;
  if (deliverable.status === "approved") return deliverable.financial_status === "pendente" ? 95 : 100;
  if (deliverable.status === "approved_with_comments") return 90;
  if (deliverable.status === "sent") return 70;
  if (deliverable.status === "in_progress") return 40;
  return 0;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function FinanceiroGerencialPage() {
  const { loading: roleLoading, role, active } = useUserRole();
  const canAccess = active && (role === "financeiro" || role === "admin");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [windowKey, setWindowKey] = useState<WindowKey>("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<"all" | string>("all");
  const [projectFilter, setProjectFilter] = useState<"all" | string>("all");
  const [bulletinStatusFilter, setBulletinStatusFilter] = useState<"all" | BulletinStatus>("all");
  const [showPageHelp, setShowPageHelp] = useState(false);
  const [showPayrollProjectionDetails, setShowPayrollProjectionDetails] = useState(false);
  const [showIndirectProjectionDetails, setShowIndirectProjectionDetails] = useState(false);
  const [showRiskDetails, setShowRiskDetails] = useState(false);
  const [showBudgetVsRealDetails, setShowBudgetVsRealDetails] = useState(false);
  const [showPredictabilityDetails, setShowPredictabilityDetails] = useState<30 | 60 | 90 | null>(null);
  const [projectSort, setProjectSort] = useState<{ key: ProjectSortKey; dir: SortDir }>({
    key: "margin",
    dir: "asc",
  });

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectClients, setProjectClients] = useState<ProjectClientRow[]>([]);
  const [extras, setExtras] = useState<ExtraPaymentRow[]>([]);
  const [indirectCosts, setIndirectCosts] = useState<IndirectCostRow[]>([]);
  const [collabs, setCollabs] = useState<CollaboratorRow[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberRow[]>([]);
  const [allocationRows, setAllocationRows] = useState<ProjectAllocationRow[]>([]);
  const [remittances, setRemittances] = useState<RemittanceRow[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRow[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);

  useEffect(() => {
    if (!showRiskDetails && !showBudgetVsRealDetails && !showPayrollProjectionDetails && !showIndirectProjectionDetails && !showPredictabilityDetails) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (showRiskDetails) setShowRiskDetails(false);
      if (showBudgetVsRealDetails) setShowBudgetVsRealDetails(false);
      if (showPayrollProjectionDetails) setShowPayrollProjectionDetails(false);
      if (showIndirectProjectionDetails) setShowIndirectProjectionDetails(false);
      if (showPredictabilityDetails) setShowPredictabilityDetails(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRiskDetails, showBudgetVsRealDetails, showPayrollProjectionDetails, showIndirectProjectionDetails, showPredictabilityDetails]);

  function downloadCsv(fileName: string, header: string[], rows: Array<Array<string | number>>) {
    const content = [header, ...rows].map((line) => line.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function load() {
  if (!canAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw new Error(sessionErr.message);
      const meId = sessionRes.session?.user?.id ?? null;
      if (!meId) throw new Error("Usuario nao autenticado.");

      const profRes = await supabase.from("profiles").select("company_id").eq("id", meId).maybeSingle();
      if (profRes.error) throw new Error(profRes.error.message);
      const myCompanyId = (profRes.data?.company_id as string | null | undefined) ?? null;
      setCompanyId(myCompanyId);
      setCompanyName(null);

      if (myCompanyId) {
        const companyRes = await supabase.from("companies").select("id,name").eq("id", myCompanyId).maybeSingle();
        if (companyRes.error) throw new Error(companyRes.error.message);
        setCompanyName((companyRes.data?.name as string | undefined) ?? null);
      }

      const [pRes, pmRes, paRes, pcRes, eRes, iRes, cRes, rRes, bRes, dRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id,name,status,budget_total,start_date,end_date,client_id,company_id,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("project_members")
          .select("project_id,user_id,member_role"),
        supabase
          .from("project_member_allocations")
          .select("project_id,user_id,allocation_pct,created_at"),
        supabase
          .from("project_clients")
          .select("id,name,active,company_id")
          .order("name", { ascending: true }),
        supabase
          .from("project_extra_payments")
          .select("id,project_id,amount,status,created_at,reference_month"),
        supabase
          .from("project_indirect_costs")
          .select("id,project_id,cost_type,amount,notes,start_date,end_date,created_at"),
        supabase
          .from("colaboradores")
          .select("id,user_id,nome,salario,is_active"),
        supabase
          .from("collaborator_invoice_remittances")
          .select("id,total_amount,status,due_date,created_at,paid_at"),
        supabase
          .from("project_measurement_bulletins")
          .select("id,project_id,amount_total,paid_amount,status,expected_payment_date,paid_at,created_at"),
        supabase
          .from("project_deliverables")
          .select("id,project_id,title,due_date,review_due_at,financial_status,status,submitted_at"),
      ]);

      if (pRes.error) throw new Error(pRes.error.message);
      if (pmRes.error) throw new Error(pmRes.error.message);
      if (paRes.error) throw new Error(paRes.error.message);
      if (pcRes.error) throw new Error(pcRes.error.message);
      if (eRes.error) throw new Error(eRes.error.message);
      if (iRes.error) throw new Error(iRes.error.message);
      if (cRes.error) throw new Error(cRes.error.message);
      if (rRes.error) throw new Error(rRes.error.message);
      if (bRes.error) throw new Error(bRes.error.message);
      if (dRes.error) throw new Error(dRes.error.message);

      const scopedProjects = ((pRes.data ?? []) as ProjectRow[]).filter((p) =>
        myCompanyId ? p.company_id === myCompanyId || p.company_id === null : true
      );
      const scopedClients = ((pcRes.data ?? []) as ProjectClientRow[]).filter((c) =>
        myCompanyId ? c.company_id === myCompanyId || c.company_id === null : true
      );

      const projectIds = new Set(scopedProjects.map((p) => p.id));
      const scopedExtras = ((eRes.data ?? []) as ExtraPaymentRow[]).filter((r) => projectIds.has(r.project_id));
      const scopedIndirect = ((iRes.data ?? []) as IndirectCostRow[]).filter((r) => projectIds.has(r.project_id));
      const scopedProjectMembers = ((pmRes.data ?? []) as ProjectMemberRow[]).filter((m) => projectIds.has(m.project_id));
      const scopedAllocations = ((paRes.data ?? []) as ProjectAllocationRow[]).filter((a) => projectIds.has(a.project_id));
      const scopedDeliverables = ((dRes.data ?? []) as DeliverableRow[]).filter((d) => projectIds.has(d.project_id));

      setProjects(scopedProjects);
      setProjectClients(scopedClients);
      setProjectMembers(scopedProjectMembers);
      setAllocationRows(scopedAllocations);
      setExtras(scopedExtras);
      setIndirectCosts(scopedIndirect);
      setCollabs((cRes.data ?? []) as CollaboratorRow[]);
      setRemittances((rRes.data ?? []) as RemittanceRow[]);
      setBulletins(
        ((bRes.data ?? []) as BulletinRow[]).filter((b) => projectIds.has(b.project_id))
      );
      setDeliverables(scopedDeliverables);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar visao gerencial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleLoading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, canAccess]);

  const selectedRange = useMemo(() => {
    if (windowKey === "all") return { start: null as Date | null, end: null as Date | null };
    if (windowKey === "custom") {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
      const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
      return {
        start: start && !Number.isNaN(start.getTime()) ? start : null,
        end: end && !Number.isNaN(end.getTime()) ? end : null,
      };
    }
    const days = Number(windowKey);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [windowKey, customStart, customEnd]);

  const inSelectedRange = useCallback((dateLike: string | null | undefined) => {
    const { start, end } = selectedRange;
    if (!start && !end) return true;
    if (!dateLike) return false;
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return false;
    if (start && dt < start) return false;
    if (end && dt > end) return false;
    return true;
  }, [selectedRange]);

  const inBulletinOperationalRange = useCallback((dateLike: string | null | undefined) => {
    if (windowKey === "all") return true;
    if (windowKey === "custom") return inSelectedRange(dateLike);
    if (!dateLike) return false;
    const dt = new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return false;
    const days = Number(windowKey);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    return dt >= start && dt <= end;
  }, [windowKey, inSelectedRange]);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of projectClients) map.set(c.id, c.name);
    return map;
  }, [projectClients]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (projectFilter !== "all" && p.id !== projectFilter) return false;
      return true;
    });
  }, [projects, clientFilter, projectFilter]);

  const filteredProjectIdSet = useMemo(() => new Set(filteredProjects.map((p) => p.id)), [filteredProjects]);
  const singleActiveProjectInScope = useMemo(
    () => filteredProjects.filter((p) => p.status === "active").length <= 1,
    [filteredProjects]
  );

  const salaryByUserId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of collabs) {
      if (c.is_active !== true) continue;
      const key = c.user_id ?? "";
      if (!key) continue;
      map.set(key, Number(c.salario ?? 0) || 0);
    }
    return map;
  }, [collabs]);

  const collaboratorNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of collabs) {
      const key = c.user_id ?? "";
      if (!key) continue;
      const name = String(c.nome ?? "").trim();
      if (!name) continue;
      map.set(key, name);
    }
    return map;
  }, [collabs]);

  const salaryByCollaboratorName = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of collabs) {
      if (c.is_active !== true) continue;
      const name = String(c.nome ?? "").trim().toLowerCase();
      if (!name) continue;
      map.set(name, Number(c.salario ?? 0) || 0);
    }
    return map;
  }, [collabs]);

  const resolveMonthlyIndirectAmount = useCallback((row: IndirectCostRow) => {
    const amount = Number(row.amount ?? 0) || 0;
    if (amount <= 0) return 0;
    if (row.cost_type !== "percentage_payroll") return amount;
    if (isLegacyAbsolutePercentageValue(amount)) return amount;
    const collaboratorName = parseIndirectCollaboratorName(row.notes);
    const collaboratorSalary = collaboratorName ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0) : 0;
    if (collaboratorSalary <= 0) return 0;
    return isIntegralSingleProjectIndirect(row.notes) || singleActiveProjectInScope
      ? collaboratorSalary
      : collaboratorSalary * (amount / 100);
  }, [salaryByCollaboratorName, singleActiveProjectInScope]);

  const payrollByProjectMonthly = useMemo(() => {
    if (!filteredProjects.length) return new Map<string, number>();
    const allProjectsById = new Map(projects.map((p) => [p.id, p]));
    const monthlyMap = new Map<string, number>();
    const monthStartRef = startOfMonth(new Date());
    const monthEndRef = endOfMonth(monthStartRef);

    const activeMembersByProject = new Map<string, string[]>();
    for (const pm of projectMembers) {
      if (!["colaborador", "coordenador", "gestor"].includes(pm.member_role)) continue;
      if (!salaryByUserId.has(pm.user_id)) continue;
      const list = activeMembersByProject.get(pm.project_id) ?? [];
      if (!list.includes(pm.user_id)) list.push(pm.user_id);
      activeMembersByProject.set(pm.project_id, list);
    }

    const allocationsByProject = new Map<string, ProjectAllocationRow[]>();
    for (const a of allocationRows) {
      if (!salaryByUserId.has(a.user_id)) continue;
      const list = allocationsByProject.get(a.project_id) ?? [];
      list.push(a);
      allocationsByProject.set(a.project_id, list);
    }

    const rawByUser = new Map<string, Map<string, number>>();

    for (const project of projects) {
      const projectStart = parseDateOnly(project.start_date) ?? parseDateOnly(project.created_at) ?? monthStartRef;
      const projectEnd = parseDateOnly(project.end_date) ?? monthEndRef;
      if (projectStart > monthEndRef || projectEnd < monthStartRef) continue;

      const latestAllocByUser = new Map<string, ProjectAllocationRow>();
      for (const a of allocationsByProject.get(project.id) ?? []) {
        const createdAt = a.created_at ? new Date(a.created_at) : null;
        if (createdAt && (Number.isNaN(createdAt.getTime()) || createdAt > monthEndRef)) continue;
        const prev = latestAllocByUser.get(a.user_id);
        if (!prev) {
          latestAllocByUser.set(a.user_id, a);
          continue;
        }
        const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : -Infinity;
        const currentTime = createdAt ? createdAt.getTime() : -Infinity;
        if (currentTime >= prevTime) latestAllocByUser.set(a.user_id, a);
      }

      const scopedAllocs = Array.from(latestAllocByUser.values());

      if (scopedAllocs.length > 0) {
        for (const a of scopedAllocs) {
          const w = Math.max(0, Number(a.allocation_pct ?? 0)) / 100;
          if (w <= 0) continue;
          const byProject = rawByUser.get(a.user_id) ?? new Map<string, number>();
          byProject.set(project.id, (byProject.get(project.id) ?? 0) + w);
          rawByUser.set(a.user_id, byProject);
        }
        continue;
      }

      const members = activeMembersByProject.get(project.id) ?? [];
      if (!members.length) continue;
      const split = 1 / members.length;
      for (const uid of members) {
        const byProject = rawByUser.get(uid) ?? new Map<string, number>();
        byProject.set(project.id, (byProject.get(project.id) ?? 0) + split);
        rawByUser.set(uid, byProject);
      }
    }

    for (const [uid, projectWeights] of rawByUser.entries()) {
      const salary = salaryByUserId.get(uid) ?? 0;
      if (salary <= 0) continue;
      const totalWeight = Array.from(projectWeights.values()).reduce((acc, w) => acc + w, 0);
      if (totalWeight <= 0) continue;
      for (const [projectId, w] of projectWeights.entries()) {
        if (!allProjectsById.has(projectId)) continue;
        const normalized = w / totalWeight;
        const add = salary * normalized;
        monthlyMap.set(projectId, (monthlyMap.get(projectId) ?? 0) + add);
      }
    }

    return monthlyMap;
  }, [projects, filteredProjects.length, projectMembers, allocationRows, salaryByUserId]);

  const collaboratorUserIdsInFilteredProjects = useMemo(() => {
    const ids = new Set<string>();
    for (const pm of projectMembers) {
      if (!filteredProjectIdSet.has(pm.project_id)) continue;
      if (!["colaborador", "coordenador", "gestor"].includes(pm.member_role)) continue;
      if (pm.user_id) ids.add(pm.user_id);
    }
    return ids;
  }, [projectMembers, filteredProjectIdSet]);

  const payrollBreakdown = useMemo(() => {
    if (!filteredProjects.length) return [] as Array<{
      userId: string;
      name: string;
      salary: number;
      allocationRule: "allocation" | "equal" | "mixed";
      allocations: Array<{ projectId: string; projectName: string; weightPct: number; allocatedSalary: number }>;
      filteredAllocatedSalary: number;
    }>;

    const monthStartRef = startOfMonth(new Date());
    const monthEndRef = endOfMonth(monthStartRef);
    const activeMembersByProject = new Map<string, string[]>();
    for (const pm of projectMembers) {
      if (!["colaborador", "coordenador", "gestor"].includes(pm.member_role)) continue;
      if (!salaryByUserId.has(pm.user_id)) continue;
      const list = activeMembersByProject.get(pm.project_id) ?? [];
      if (!list.includes(pm.user_id)) list.push(pm.user_id);
      activeMembersByProject.set(pm.project_id, list);
    }

    const allocationsByProject = new Map<string, ProjectAllocationRow[]>();
    for (const a of allocationRows) {
      if (!salaryByUserId.has(a.user_id)) continue;
      const list = allocationsByProject.get(a.project_id) ?? [];
      list.push(a);
      allocationsByProject.set(a.project_id, list);
    }

    const rawByUser = new Map<string, Map<string, number>>();
    const sourceByUser = new Map<string, Map<string, "allocation" | "equal">>();
    for (const project of projects) {
      const projectStart = parseDateOnly(project.start_date) ?? parseDateOnly(project.created_at) ?? monthStartRef;
      const projectEnd = parseDateOnly(project.end_date) ?? monthEndRef;
      if (projectStart > monthEndRef || projectEnd < monthStartRef) continue;

      const latestAllocByUser = new Map<string, ProjectAllocationRow>();
      for (const a of allocationsByProject.get(project.id) ?? []) {
        const createdAt = a.created_at ? new Date(a.created_at) : null;
        if (createdAt && (Number.isNaN(createdAt.getTime()) || createdAt > monthEndRef)) continue;
        const prev = latestAllocByUser.get(a.user_id);
        if (!prev) {
          latestAllocByUser.set(a.user_id, a);
          continue;
        }
        const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : -Infinity;
        const currentTime = createdAt ? createdAt.getTime() : -Infinity;
        if (currentTime >= prevTime) latestAllocByUser.set(a.user_id, a);
      }

      const scopedAllocs = Array.from(latestAllocByUser.values());
      if (scopedAllocs.length > 0) {
        for (const a of scopedAllocs) {
          const w = Math.max(0, Number(a.allocation_pct ?? 0)) / 100;
          if (w <= 0) continue;
          const byProject = rawByUser.get(a.user_id) ?? new Map<string, number>();
          byProject.set(project.id, (byProject.get(project.id) ?? 0) + w);
          rawByUser.set(a.user_id, byProject);
          const bySource = sourceByUser.get(a.user_id) ?? new Map<string, "allocation" | "equal">();
          bySource.set(project.id, "allocation");
          sourceByUser.set(a.user_id, bySource);
        }
        continue;
      }

      const members = activeMembersByProject.get(project.id) ?? [];
      if (!members.length) continue;
      const split = 1 / members.length;
      for (const uid of members) {
        const byProject = rawByUser.get(uid) ?? new Map<string, number>();
        byProject.set(project.id, (byProject.get(project.id) ?? 0) + split);
        rawByUser.set(uid, byProject);
        const bySource = sourceByUser.get(uid) ?? new Map<string, "allocation" | "equal">();
        if (!bySource.has(project.id)) bySource.set(project.id, "equal");
        sourceByUser.set(uid, bySource);
      }
    }

    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
    return Array.from(rawByUser.entries())
      .map(([userId, projectWeights]) => {
        const salary = salaryByUserId.get(userId) ?? 0;
        const totalWeight = Array.from(projectWeights.values()).reduce((acc, w) => acc + w, 0);
        if (salary <= 0 || totalWeight <= 0) return null;
        const sources = Array.from((sourceByUser.get(userId) ?? new Map<string, "allocation" | "equal">()).values());
        const allocationRule: "allocation" | "equal" | "mixed" =
          sources.length === 0
            ? "equal"
            : sources.every((source) => source === "allocation")
              ? "allocation"
              : sources.every((source) => source === "equal")
                ? "equal"
                : "mixed";
        const allocations = Array.from(projectWeights.entries())
          .map(([projectId, weight]) => {
            const weightPct = (weight / totalWeight) * 100;
            const allocatedSalary = salary * (weight / totalWeight);
            return {
              projectId,
              projectName: projectNameById.get(projectId) ?? projectId,
              weightPct,
              allocatedSalary,
            };
          })
          .sort((a, b) => b.allocatedSalary - a.allocatedSalary);
        const filteredAllocatedSalary = allocations
          .filter((row) => filteredProjectIdSet.has(row.projectId))
          .reduce((acc, row) => acc + row.allocatedSalary, 0);
        return {
          userId,
          name: collaboratorNameByUserId.get(userId) ?? "Colaborador sem nome",
          salary,
          allocationRule,
          allocations,
          filteredAllocatedSalary,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row && row.filteredAllocatedSalary > 0)
      .sort((a, b) => b.filteredAllocatedSalary - a.filteredAllocatedSalary);
  }, [filteredProjects.length, projectMembers, allocationRows, projects, salaryByUserId, collaboratorNameByUserId, filteredProjectIdSet]);

  const scopedExtras = useMemo(() => {
    return extras.filter((x) => {
      if (!filteredProjectIdSet.has(x.project_id)) return false;
      const ref = x.created_at ?? (x.reference_month ? `${x.reference_month}-01` : null);
      return inSelectedRange(ref);
    });
  }, [extras, filteredProjectIdSet, inSelectedRange]);

  const scopedIndirect = useMemo(() => {
    return indirectCosts.filter((x) => {
      if (!filteredProjectIdSet.has(x.project_id)) return false;
      if (!selectedRange.start && !selectedRange.end) return true;
      const rangeStart = selectedRange.start ?? parseDateOnly(x.start_date) ?? parseDateOnly(x.created_at) ?? new Date();
      const rangeEnd = selectedRange.end ?? parseDateOnly(x.end_date) ?? new Date();
      return activeMonthsInRange(rangeStart, rangeEnd, x.start_date, x.end_date, x.created_at) > 0;
    });
  }, [indirectCosts, filteredProjectIdSet, selectedRange.start, selectedRange.end]);

  const indirectValueByProject = useMemo(() => {
    const map = new Map<string, number>();
    const rangeStart =
      selectedRange.start ??
      (() => {
        const starts = projects
          .map((p) => parseDateOnly(p.start_date) ?? parseDateOnly(p.created_at))
          .filter((d): d is Date => !!d);
        return starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : new Date();
      })();
    const rangeEnd =
      selectedRange.end ??
      (() => {
        const ends = projects
          .map((p) => parseDateOnly(p.end_date))
          .filter((d): d is Date => !!d);
        const maxEnd = ends.length ? Math.max(...ends.map((d) => d.getTime())) : new Date().getTime();
        return new Date(maxEnd);
      })();

    for (const x of scopedIndirect) {
      const amount = Number(x.amount ?? 0) || 0;
      if (amount <= 0) continue;
      const months = activeMonthsInRange(rangeStart, rangeEnd, x.start_date, x.end_date, x.created_at);
      if (x.cost_type === "one_time") {
        const hit = months > 0 ? amount : 0;
        if (hit > 0) map.set(x.project_id, (map.get(x.project_id) ?? 0) + hit);
        continue;
      }
      if (x.cost_type === "monthly") {
        if (months > 0) map.set(x.project_id, (map.get(x.project_id) ?? 0) + (amount * months));
        continue;
      }
      if (isLegacyAbsolutePercentageValue(amount)) {
        if (months > 0) map.set(x.project_id, (map.get(x.project_id) ?? 0) + (amount * months));
        continue;
      }
      const collaboratorName = parseIndirectCollaboratorName(x.notes);
      const collaboratorSalary = collaboratorName ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0) : 0;
      const monthlyBase = collaboratorSalary > 0 ? collaboratorSalary : (payrollByProjectMonthly.get(x.project_id) ?? 0);
      if (months > 0 && monthlyBase > 0) {
        const monthlyValue =
          isIntegralSingleProjectIndirect(x.notes) || singleActiveProjectInScope
            ? monthlyBase
            : monthlyBase * (amount / 100);
        map.set(x.project_id, (map.get(x.project_id) ?? 0) + (monthlyValue * months));
      }
    }

    return map;
  }, [scopedIndirect, selectedRange.start, selectedRange.end, projects, payrollByProjectMonthly, salaryByCollaboratorName, singleActiveProjectInScope]);

  const scopedBulletins = useMemo(() => {
    return bulletins.filter((b) => {
      if (!filteredProjectIdSet.has(b.project_id)) return false;
      if (bulletinStatusFilter !== "all" && b.status !== bulletinStatusFilter) return false;
      const ref = b.expected_payment_date ? `${b.expected_payment_date}T00:00:00` : b.created_at;
      return inBulletinOperationalRange(ref);
    });
  }, [bulletins, filteredProjectIdSet, bulletinStatusFilter, inBulletinOperationalRange]);

  const summary = useMemo(() => {
    const budget = filteredProjects.reduce((acc, p) => acc + (Number(p.budget_total ?? 0) || 0), 0);
    const extrasPending = scopedExtras
      .filter((x) => x.status === "pending")
      .reduce((acc, x) => acc + (Number(x.amount ?? 0) || 0), 0);
    const extrasApproved = scopedExtras
      .filter((x) => x.status === "approved")
      .reduce((acc, x) => acc + (Number(x.amount ?? 0) || 0), 0);
    const extrasPaid = scopedExtras
      .filter((x) => x.status === "paid")
      .reduce((acc, x) => acc + (Number(x.amount ?? 0) || 0), 0);
    const directRecognized = extrasApproved + extrasPaid;
    const indirect = filteredProjects.reduce((acc, p) => acc + (indirectValueByProject.get(p.id) ?? 0), 0);
    const payroll = filteredProjects.reduce((acc, p) => acc + (payrollByProjectMonthly.get(p.id) ?? 0), 0);
    const totalCost = directRecognized + indirect + payroll;
    const margin = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;
    const approvalBase = extrasPending + extrasApproved + extrasPaid;
    const approvalRate = approvalBase > 0 ? ((extrasApproved + extrasPaid) / approvalBase) * 100 : 0;
    return {
      budget,
      extrasPending,
      extrasApproved,
      extrasPaid,
      directRecognized,
      indirect,
      payroll,
      totalCost,
      margin,
      approvalRate,
    };
  }, [filteredProjects, scopedExtras, indirectValueByProject, payrollByProjectMonthly]);

  const lifecycleSummary = useMemo(() => {
    const budget = filteredProjects.reduce((acc, p) => acc + (Number(p.budget_total ?? 0) || 0), 0);
    const projectById = new Map(filteredProjects.map((p) => [p.id, p]));
    const directRecognized = extras
      .filter((x) => filteredProjectIdSet.has(x.project_id) && (x.status === "approved" || x.status === "paid"))
      .reduce((acc, x) => acc + (Number(x.amount ?? 0) || 0), 0);

    let indirect = 0;
    let payroll = 0;

    for (const project of filteredProjects) {
      const projectStart = parseDateOnly(project.start_date) ?? parseDateOnly(project.created_at) ?? new Date();
      const projectEnd = parseDateOnly(project.end_date) ?? new Date();
      const lifecycleMonths =
        projectEnd >= projectStart ? monthsBetween(startOfMonth(projectStart), startOfMonth(projectEnd)).length : 1;
      payroll += (payrollByProjectMonthly.get(project.id) ?? 0) * Math.max(1, lifecycleMonths);
    }

    for (const x of indirectCosts) {
      if (!filteredProjectIdSet.has(x.project_id)) continue;
      const project = projectById.get(x.project_id);
      if (!project) continue;
      const amount = Number(x.amount ?? 0) || 0;
      if (amount <= 0) continue;

      const rangeStart = parseDateOnly(project.start_date) ?? parseDateOnly(project.created_at) ?? new Date();
      const rangeEnd = parseDateOnly(project.end_date) ?? new Date();
      const months = activeMonthsInRange(rangeStart, rangeEnd, x.start_date, x.end_date, x.created_at);
      if (months <= 0) continue;

      if (x.cost_type === "one_time") {
        indirect += amount;
        continue;
      }
      if (x.cost_type === "monthly") {
        indirect += amount * months;
        continue;
      }
      if (isLegacyAbsolutePercentageValue(amount)) {
        indirect += amount * months;
        continue;
      }

      const collaboratorName = parseIndirectCollaboratorName(x.notes);
      const collaboratorSalary = collaboratorName ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0) : 0;
      const monthlyBase = collaboratorSalary > 0 ? collaboratorSalary : (payrollByProjectMonthly.get(x.project_id) ?? 0);
      if (monthlyBase <= 0) continue;
      const monthlyValue =
        isIntegralSingleProjectIndirect(x.notes) || singleActiveProjectInScope
          ? monthlyBase
          : monthlyBase * (amount / 100);
      indirect += monthlyValue * months;
    }

    const totalCost = directRecognized + indirect + payroll;
    const margin = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;

    return {
      budget,
      directRecognized,
      indirect,
      payroll,
      totalCost,
      margin,
    };
  }, [filteredProjects, extras, filteredProjectIdSet, indirectCosts, payrollByProjectMonthly, salaryByCollaboratorName, singleActiveProjectInScope]);

  const byProject = useMemo(() => {
    const directByProject = new Map<string, number>();
    const pendingByProject = new Map<string, number>();
    for (const x of scopedExtras) {
      const val = Number(x.amount ?? 0) || 0;
      if (x.status === "pending") pendingByProject.set(x.project_id, (pendingByProject.get(x.project_id) ?? 0) + val);
      if (x.status === "approved" || x.status === "paid") {
        directByProject.set(x.project_id, (directByProject.get(x.project_id) ?? 0) + val);
      }
    }
    return filteredProjects
      .map((p) => {
        const budget = Number(p.budget_total ?? 0) || 0;
        const direct = directByProject.get(p.id) ?? 0;
        const indirect = indirectValueByProject.get(p.id) ?? 0;
        const pending = pendingByProject.get(p.id) ?? 0;
        const bulletinPaid = bulletins
          .filter((b) => b.project_id === p.id && b.status !== "cancelado")
          .reduce((acc, b) => {
            const paid = Number(b.paid_amount ?? 0) || 0;
            const total = Number(b.amount_total ?? 0) || 0;
            return acc + (paid > 0 ? paid : b.status === "pago" ? total : 0);
          }, 0);
        const payroll = payrollByProjectMonthly.get(p.id) ?? 0;
        const totalCost = direct + indirect + payroll;
        const margin = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;
        const receiptRate = budget > 0 ? (bulletinPaid / budget) * 100 : 0;
        return { ...p, budget, direct, indirect, pending, payroll, bulletinPaid, receiptRate, totalCost, margin };
      })
      .sort((a, b) => a.margin - b.margin);
  }, [filteredProjects, scopedExtras, bulletins, payrollByProjectMonthly, indirectValueByProject]);

  const lifecycleByProject = useMemo(() => {
    const directByProject = new Map<string, number>();
    const pendingByProject = new Map<string, number>();
    for (const x of extras) {
      if (!filteredProjectIdSet.has(x.project_id)) continue;
      const val = Number(x.amount ?? 0) || 0;
      if (x.status === "pending") pendingByProject.set(x.project_id, (pendingByProject.get(x.project_id) ?? 0) + val);
      if (x.status === "approved" || x.status === "paid") {
        directByProject.set(x.project_id, (directByProject.get(x.project_id) ?? 0) + val);
      }
    }

    return filteredProjects
      .map((p) => {
        const budget = Number(p.budget_total ?? 0) || 0;
        const direct = directByProject.get(p.id) ?? 0;
        const pending = pendingByProject.get(p.id) ?? 0;
        const projectStart = parseDateOnly(p.start_date) ?? parseDateOnly(p.created_at) ?? new Date();
        const projectEnd = parseDateOnly(p.end_date) ?? new Date();
        const lifecycleMonths =
          projectEnd >= projectStart ? monthsBetween(startOfMonth(projectStart), startOfMonth(projectEnd)).length : 1;
        const payroll = (payrollByProjectMonthly.get(p.id) ?? 0) * Math.max(1, lifecycleMonths);

        const indirect = indirectCosts
          .filter((x) => x.project_id === p.id)
          .reduce((acc, x) => {
            const amount = Number(x.amount ?? 0) || 0;
            if (amount <= 0) return acc;
            const months = activeMonthsInRange(projectStart, projectEnd, x.start_date, x.end_date, x.created_at);
            if (months <= 0) return acc;
            if (x.cost_type === "one_time") return acc + amount;
            if (x.cost_type === "monthly") return acc + (amount * months);
            if (isLegacyAbsolutePercentageValue(amount)) return acc + (amount * months);

            const collaboratorName = parseIndirectCollaboratorName(x.notes);
            const collaboratorSalary = collaboratorName ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0) : 0;
            const monthlyBase = collaboratorSalary > 0 ? collaboratorSalary : (payrollByProjectMonthly.get(p.id) ?? 0);
            if (monthlyBase <= 0) return acc;
            const monthlyValue =
              isIntegralSingleProjectIndirect(x.notes) || singleActiveProjectInScope
                ? monthlyBase
                : monthlyBase * (amount / 100);
            return acc + (monthlyValue * months);
          }, 0);

        const paid = bulletins
          .filter((b) => b.project_id === p.id && b.status !== "cancelado")
          .reduce((acc, b) => {
            const paidAmount = Number(b.paid_amount ?? 0) || 0;
            const totalAmount = Number(b.amount_total ?? 0) || 0;
            return acc + (paidAmount > 0 ? paidAmount : b.status === "pago" ? totalAmount : 0);
          }, 0);

        const totalCost = direct + indirect + payroll;
        const margin = budget > 0 ? ((budget - totalCost) / budget) * 100 : 0;
        const receiptRate = budget > 0 ? (paid / budget) * 100 : 0;
        return { ...p, budget, direct, indirect, pending, payroll, bulletinPaid: paid, receiptRate, totalCost, margin };
      })
      .sort((a, b) => a.margin - b.margin);
  }, [filteredProjects, extras, filteredProjectIdSet, indirectCosts, payrollByProjectMonthly, salaryByCollaboratorName, singleActiveProjectInScope, bulletins]);

  const sortedByProject = useMemo(() => {
    const list = [...byProject];
    const dirFactor = projectSort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (projectSort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dirFactor;
        case "status":
          return a.status.localeCompare(b.status) * dirFactor;
        case "budget":
          return (a.budget - b.budget) * dirFactor;
        case "direct":
          return (a.direct - b.direct) * dirFactor;
        case "indirect":
          return (a.indirect - b.indirect) * dirFactor;
        case "payroll":
          return (a.payroll - b.payroll) * dirFactor;
        case "realTotal":
          return (a.totalCost - b.totalCost) * dirFactor;
        case "pending":
          return (a.pending - b.pending) * dirFactor;
        case "received":
          return (a.bulletinPaid - b.bulletinPaid) * dirFactor;
        case "receiptRate":
          return (a.receiptRate - b.receiptRate) * dirFactor;
        case "margin":
        default:
          return (a.margin - b.margin) * dirFactor;
      }
    });
    return list;
  }, [byProject, projectSort]);

  const lifecycleRiskByProject = useMemo(() => {
    return lifecycleByProject.map((p) => {
      const budget = p.budget;
      const pendingPct = budget > 0 ? (p.pending / budget) * 100 : 0;
      const indirectPct = budget > 0 ? (p.indirect / budget) * 100 : 0;
      let score = 0;

      if (budget <= 0) score += 35;
      if (p.margin < 0) score += 50;
      else if (p.margin < 10) score += 30;
      else if (p.margin < 20) score += 15;

      if (pendingPct > 20) score += 25;
      else if (pendingPct > 10) score += 15;

      if (indirectPct > 25) score += 20;
      else if (indirectPct > 15) score += 10;

      const level = score >= 60 ? "vermelho" : score >= 30 ? "amarelo" : "verde";
      const reasons: string[] = [];
      if (budget <= 0) reasons.push("sem orçamento");
      if (p.margin < 0) reasons.push("margem negativa");
      else if (p.margin < 10) reasons.push("margem baixa");
      if (pendingPct > 10) reasons.push("extras pendentes altos");
      if (indirectPct > 15) reasons.push("indireto elevado");

      return { ...p, score, level, reasons, pendingPct, indirectPct };
    }).sort((a, b) => b.score - a.score || a.margin - b.margin);
  }, [lifecycleByProject]);

  const topMargins = useMemo(
    () => [...lifecycleByProject].sort((a, b) => b.margin - a.margin).slice(0, 5),
    [lifecycleByProject]
  );
  const worstMargins = useMemo(() => lifecycleByProject.slice(0, 5), [lifecycleByProject]);

  const byProjectTotals = useMemo(() => {
    return byProject.reduce(
      (acc, p) => {
        acc.budget += p.budget;
        acc.direct += p.direct;
        acc.indirect += p.indirect;
        acc.payroll += p.payroll;
        acc.pending += p.pending;
        return acc;
      },
      { budget: 0, direct: 0, indirect: 0, payroll: 0, pending: 0 }
    );
  }, [byProject]);

  function exportComparativoProjetosCsv() {
    downloadCsv(
      "financeiro-comparativo-projetos.csv",
      ["Projeto", "Status", "Orcamento", "Recebido boletins", "Recebimento/Orcado (%)", "Direto", "Indireto", "Folha", "Real total", "Extras pendentes", "Margem (%)"],
      [
        ...sortedByProject.map((p) => [
          p.name,
          p.status === "active" ? "Ativo" : p.status === "paused" ? "Pausado" : "Concluido",
          Number(p.budget.toFixed(2)),
          Number(p.bulletinPaid.toFixed(2)),
          Number(p.receiptRate.toFixed(2)),
          Number(p.direct.toFixed(2)),
          Number(p.indirect.toFixed(2)),
          Number(p.payroll.toFixed(2)),
          Number(p.totalCost.toFixed(2)),
          Number(p.pending.toFixed(2)),
          Number(p.margin.toFixed(2)),
        ]),
        [
          "Total",
          "-",
          Number(byProjectTotals.budget.toFixed(2)),
          Number(sortedByProject.reduce((acc, p) => acc + p.bulletinPaid, 0).toFixed(2)),
          Number((summary.budget > 0 ? (sortedByProject.reduce((acc, p) => acc + p.bulletinPaid, 0) / summary.budget) * 100 : 0).toFixed(2)),
          Number(byProjectTotals.direct.toFixed(2)),
          Number(byProjectTotals.indirect.toFixed(2)),
          Number(byProjectTotals.payroll.toFixed(2)),
          Number(summary.totalCost.toFixed(2)),
          Number(byProjectTotals.pending.toFixed(2)),
          Number(summary.margin.toFixed(2)),
        ],
      ]
    );
  }

  function toggleProjectSort(key: ProjectSortKey) {
    setProjectSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "name" || key === "status" ? "asc" : "desc" };
    });
  }

  function exportFluxoCaixaCsv() {
    const rowMap = [
      {
        label: "Entradas (boletins)",
        values: cashProjection.map((p) => p.bulletinIn),
      },
      {
        label: "Folha projetada",
        values: cashProjection.map((p) => p.payrollOut),
      },
      {
        label: "Remessas em aberto",
        values: cashProjection.map((p) => p.remittanceOut),
      },
      {
        label: "Extras pendentes",
        values: cashProjection.map((p) => p.extrasPendingOut),
      },
      {
        label: "Indiretos estimados",
        values: cashProjection.map((p) => p.indirectProjected),
      },
      {
        label: "Saida total projetada",
        values: cashProjection.map((p) => p.totalOut),
      },
      {
        label: "Saldo projetado",
        values: cashProjection.map((p) => p.netProjected),
      },
      {
        label: "Pressao no orcamento ativo (%)",
        values: cashProjection.map((p) => p.budgetCoveragePct),
      },
      {
        label: "Previsibilidade documental (%)",
        values: predictabilityProjection.map((p) => p.averageRealizationPct),
      },
    ];

    downloadCsv(
      "financeiro-fluxo-caixa-30-60-90.csv",
      ["Indicador", ...cashProjection.map((p) => `${p.days} dias`)],
      rowMap.map((r) => [r.label, ...r.values.map((v) => Number(v.toFixed(2)))])
    );
  }

  function exportBoletinsStatusCsv() {
    downloadCsv(
      "financeiro-boletins-por-status.csv",
      ["Status", "Qtd", "Valor total", "Recebido", "Em aberto"],
      bulletinsByStatus.map((r) => [
        bulletinStatusLabel(r.status),
        r.count,
        Number(r.amountTotal.toFixed(2)),
        Number(r.paidTotal.toFixed(2)),
        Number(r.openTotal.toFixed(2)),
      ])
    );
  }

  const indirectProjectionBreakdown = useMemo(() => {
    const horizons = [30, 60, 90] as const;
    const projectionStart = new Date();
    projectionStart.setHours(0, 0, 0, 0);
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    return indirectCosts
      .filter((x) => filteredProjectIdSet.has(x.project_id))
      .map((x) => {
        const amount = Number(x.amount ?? 0) || 0;
        if (amount <= 0) return null;
        const recurring = x.cost_type !== "one_time";
        const monthlyEquivalent = recurring ? resolveMonthlyIndirectAmount(x) : 0;
        const valuesByHorizon = horizons.map((days) => {
          const limit = new Date();
          limit.setDate(limit.getDate() + days);
          limit.setHours(23, 59, 59, 999);

          if (x.cost_type === "one_time") {
            const eventDate = parseDateOnly(x.start_date) ?? parseDateOnly(x.created_at);
            if (!eventDate) return 0;
            return eventDate >= projectionStart && eventDate <= limit ? amount : 0;
          }

          const months = activeMonthsInRange(projectionStart, limit, x.start_date, x.end_date, x.created_at);
          if (months <= 0) return 0;
          return monthlyEquivalent * months;
        });

        return {
          id: x.id,
          projectName: projectNameById.get(x.project_id) ?? x.project_id,
          typeLabel: x.cost_type === "monthly" ? "Mensal" : x.cost_type === "one_time" ? "Pontual" : "% sobre salario",
          sourceLabel: parseNoteTag(x.notes ?? null, "Fonte"),
          monthlyEquivalent,
          valuesByHorizon,
          startDate: x.start_date ?? "-",
          endDate: x.end_date ?? "-",
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row)
      .sort((a, b) => {
        const aTotal = a.valuesByHorizon.reduce((acc, v) => acc + v, 0);
        const bTotal = b.valuesByHorizon.reduce((acc, v) => acc + v, 0);
        return bTotal - aTotal;
      });
  }, [indirectCosts, filteredProjectIdSet, projects, resolveMonthlyIndirectAmount]);

  const monthly = useMemo(() => {
    const map = new Map<string, { pending: number; approvedPaid: number; indirect: number; bulletinExpected: number; bulletinPaid: number }>();
    for (const x of extras) {
      if (!filteredProjectIdSet.has(x.project_id)) continue;
      const ref = x.created_at ?? (x.reference_month ? `${x.reference_month}-01` : null);
      if (!inSelectedRange(ref)) continue;
      const key = monthKey(x.created_at ?? (x.reference_month ? `${x.reference_month}-01` : null));
      if (!key) continue;
      const row = map.get(key) ?? { pending: 0, approvedPaid: 0, indirect: 0, bulletinExpected: 0, bulletinPaid: 0 };
      const val = Number(x.amount ?? 0) || 0;
      if (x.status === "pending") row.pending += val;
      if (x.status === "approved" || x.status === "paid") row.approvedPaid += val;
      map.set(key, row);
    }
    for (const x of indirectCosts) {
      if (!filteredProjectIdSet.has(x.project_id)) continue;
      const amount = Number(x.amount ?? 0) || 0;
      if (amount <= 0) continue;
      const baseStart = parseDateOnly(x.start_date) ?? parseDateOnly(x.created_at);
      const baseEnd = parseDateOnly(x.end_date) ?? parseDateOnly(x.created_at) ?? new Date();
      if (!baseStart || !baseEnd) continue;
      for (const m of monthsBetween(startOfMonth(baseStart), startOfMonth(baseEnd))) {
        const monthStartRef = startOfMonth(m);
        if (!inSelectedRange(monthStartRef.toISOString())) continue;
        const key = monthKey(monthStartRef.toISOString());
        if (!key) continue;
        const row = map.get(key) ?? { pending: 0, approvedPaid: 0, indirect: 0, bulletinExpected: 0, bulletinPaid: 0 };
        if (x.cost_type === "one_time") {
          const createdKey = monthKey(x.created_at ?? x.start_date ?? x.end_date);
          if (createdKey === key) row.indirect += amount;
        } else if (x.cost_type === "monthly") {
          row.indirect += amount;
        } else if (isLegacyAbsolutePercentageValue(amount)) {
          row.indirect += amount;
        } else {
          row.indirect += resolveMonthlyIndirectAmount(x);
        }
        map.set(key, row);
      }
    }
    for (const b of scopedBulletins) {
      const key = monthKey(b.expected_payment_date ?? b.created_at);
      if (!key) continue;
      const row = map.get(key) ?? { pending: 0, approvedPaid: 0, indirect: 0, bulletinExpected: 0, bulletinPaid: 0 };
      const total = Number(b.amount_total ?? 0) || 0;
      const paid = Number(b.paid_amount ?? 0) || 0;
      if (b.status !== "cancelado") {
        row.bulletinExpected += Math.max(0, total - paid);
        row.bulletinPaid += Math.max(0, paid);
      }
      map.set(key, row);
    }
    return Array.from(map.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [extras, indirectCosts, scopedBulletins, filteredProjectIdSet, inSelectedRange, resolveMonthlyIndirectAmount]);

  const cashProjection = useMemo(() => {
    const horizons = [30, 60, 90] as const;
    const activeBudget = filteredProjects
      .filter((p) => p.status === "active")
      .reduce((acc, p) => acc + (Number(p.budget_total ?? 0) || 0), 0);

    const projectionStart = new Date();
    projectionStart.setHours(0, 0, 0, 0);

    const projectedIndirectUntil = (limit: Date) =>
      indirectCosts.reduce((acc, x) => {
        if (!filteredProjectIdSet.has(x.project_id)) return acc;
        const amount = Number(x.amount ?? 0) || 0;
        if (amount <= 0) return acc;

        if (x.cost_type === "one_time") {
          const eventDate = parseDateOnly(x.start_date) ?? parseDateOnly(x.created_at);
          if (!eventDate) return acc;
          return eventDate >= projectionStart && eventDate <= limit ? acc + amount : acc;
        }

        const months = activeMonthsInRange(projectionStart, limit, x.start_date, x.end_date, x.created_at);
        if (months <= 0) return acc;

        return acc + (resolveMonthlyIndirectAmount(x) * months);
      }, 0);

    return horizons.map((days) => {
      const limit = new Date();
      limit.setDate(limit.getDate() + days);
      limit.setHours(23, 59, 59, 999);

      const remittanceOut = remittances
        .filter((r) => {
          if (r.status === "paid" || r.status === "cancelled") return false;
          const base = r.due_date ? new Date(`${r.due_date}T00:00:00`) : r.created_at ? new Date(r.created_at) : null;
          return !!base && !Number.isNaN(base.getTime()) && base <= limit;
        })
        .reduce((acc, r) => acc + (Number(r.total_amount ?? 0) || 0), 0);

      const extrasPendingOut = extras
        .filter((x) => {
          if (x.status !== "pending") return false;
          const base = x.created_at ? new Date(x.created_at) : x.reference_month ? new Date(`${x.reference_month}-01`) : null;
          return !!base && !Number.isNaN(base.getTime()) && base <= limit;
        })
        .reduce((acc, x) => acc + (Number(x.amount ?? 0) || 0), 0);

      const payrollOut = summary.payroll * (days / 30);
      const indirectProjected = projectedIndirectUntil(limit);
      const bulletinIn = bulletins
        .filter((b) => {
          if (!filteredProjectIdSet.has(b.project_id)) return false;
          if (b.status === "cancelado") return false;
          const paid = Number(b.paid_amount ?? 0) || 0;
          const total = Number(b.amount_total ?? 0) || 0;
          const received = paid > 0 ? paid : b.status === "pago" ? total : 0;
          if (received <= 0) return false;
          const base = b.paid_at ? new Date(b.paid_at) : null;
          return !!base && !Number.isNaN(base.getTime()) && base <= limit;
        })
        .reduce((acc, b) => {
          const paid = Number(b.paid_amount ?? 0) || 0;
          const total = Number(b.amount_total ?? 0) || 0;
          const received = paid > 0 ? paid : b.status === "pago" ? total : 0;
          return acc + Math.max(0, received);
        }, 0);

      const totalOut = remittanceOut + extrasPendingOut + payrollOut + indirectProjected;
      const netProjected = bulletinIn - totalOut;
      const budgetCoveragePct = activeBudget > 0 ? (totalOut / activeBudget) * 100 : 0;

      return {
        days,
        bulletinIn,
        remittanceOut,
        extrasPendingOut,
        payrollOut,
        indirectProjected,
        totalOut,
        netProjected,
        budgetCoveragePct,
      };
    });
  }, [filteredProjects, remittances, extras, bulletins, filteredProjectIdSet, summary.payroll, indirectCosts, resolveMonthlyIndirectAmount]);

  const predictabilityProjection = useMemo(() => {
    const projectNameById = new Map(filteredProjects.map((project) => [project.id, project.name]));
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const windows = [
      { days: 30 as const, minOffset: 0, maxOffset: 30, label: "0-30 dias" },
      { days: 60 as const, minOffset: 31, maxOffset: 60, label: "31-60 dias" },
      { days: 90 as const, minOffset: 61, maxOffset: 90, label: "61-90 dias" },
    ];

    return windows.map((window) => {
      const items = deliverables
        .filter((deliverable) => filteredProjectIdSet.has(deliverable.project_id))
        .map((deliverable) => {
          const dueDateRaw = deliverable.due_date ?? deliverable.review_due_at;
          const dueDate = parseDateOnly(dueDateRaw);
          if (!dueDate) return null;

          const diffMs = dueDate.getTime() - start.getTime();
          const diffDays = Math.ceil(diffMs / 86400000);
          if (diffDays < window.minOffset || diffDays > window.maxOffset) return null;

          const realizationPct = getDeliverableRealizationPct(deliverable);
          return {
            ...deliverable,
            dueDate,
            dueDateRaw,
            projectName: projectNameById.get(deliverable.project_id) ?? "Projeto sem nome",
            realizationPct,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (a?.dueDate.getTime() ?? 0) - (b?.dueDate.getTime() ?? 0)) as Array<
          DeliverableRow & {
            dueDate: Date;
            dueDateRaw: string | null;
            projectName: string;
            realizationPct: number;
          }
        >;

      const averageRealizationPct = items.length
        ? items.reduce((acc, item) => acc + item.realizationPct, 0) / items.length
        : 0;

      return {
        ...window,
        items,
        count: items.length,
        averageRealizationPct,
      };
    });
  }, [deliverables, filteredProjectIdSet, filteredProjects]);

  const maxMonthly = useMemo(() => {
    return monthly.reduce((acc, m) => Math.max(acc, m.pending + m.approvedPaid + m.indirect), 0);
  }, [monthly]);

  const selectedPredictabilityDetail = useMemo(
    () => predictabilityProjection.find((item) => item.days === showPredictabilityDetails) ?? null,
    [predictabilityProjection, showPredictabilityDetails]
  );

  const bulletinCashStats = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let expectedOpen = 0;
    let paidTotal = 0;
    let overdueOpen = 0;

    for (const b of scopedBulletins) {
      if (b.status === "cancelado") continue;
      const total = Number(b.amount_total ?? 0) || 0;
      const paid = Number(b.paid_amount ?? 0) || 0;
      const open = Math.max(0, total - paid);
      expectedOpen += open;
      paidTotal += Math.max(0, paid);
      const due = b.expected_payment_date ? new Date(`${b.expected_payment_date}T00:00:00`) : null;
      if (open > 0 && due && !Number.isNaN(due.getTime()) && due < now) {
        overdueOpen += open;
      }
    }

    const realizedVsExpectedRate = expectedOpen + paidTotal > 0 ? (paidTotal / (expectedOpen + paidTotal)) * 100 : 0;
    const budgetReceiptRate = summary.budget > 0 ? (paidTotal / summary.budget) * 100 : 0;
    return { expectedOpen, paidTotal, overdueOpen, realizedVsExpectedRate, budgetReceiptRate };
  }, [scopedBulletins, summary.budget]);

  const monthlyBulletinPerformance = useMemo(() => {
    return monthly.map((m) => {
      const base = m.bulletinExpected + m.bulletinPaid;
      const rate = base > 0 ? (m.bulletinPaid / base) * 100 : 0;
      return { ...m, bulletinRealizationRate: rate };
    });
  }, [monthly]);

  const uiAlerts = useMemo(() => {
    const hasHighRisk = lifecycleRiskByProject.some((p) => p.level === "vermelho");
    const hasModerateRisk = lifecycleRiskByProject.some((p) => p.level === "amarelo");
    const hasOverdueBulletins = bulletinCashStats.overdueOpen > 0;
    const lowRealization = bulletinCashStats.realizedVsExpectedRate > 0 && bulletinCashStats.realizedVsExpectedRate < 50;
    return {
      hasHighRisk,
      hasModerateRisk,
      hasOverdueBulletins,
      lowRealization,
    };
  }, [lifecycleRiskByProject, bulletinCashStats]);

  const bulletinsByStatus = useMemo(() => {
    const order: BulletinStatus[] = [
      "em_analise",
      "faturado",
      "enviado_cliente",
      "previsao_pagamento",
      "parcialmente_pago",
      "pago",
      "atrasado",
      "cancelado",
      "outro",
    ];
    const map = new Map<
      BulletinStatus,
      { count: number; amountTotal: number; paidTotal: number; openTotal: number }
    >();
    for (const s of order) {
      map.set(s, { count: 0, amountTotal: 0, paidTotal: 0, openTotal: 0 });
    }
    for (const b of scopedBulletins) {
      const key = b.status ?? "outro";
      const row = map.get(key) ?? { count: 0, amountTotal: 0, paidTotal: 0, openTotal: 0 };
      const total = Number(b.amount_total ?? 0) || 0;
      const paid = Number(b.paid_amount ?? 0) || 0;
      row.count += 1;
      row.amountTotal += total;
      row.paidTotal += Math.max(0, paid);
      row.openTotal += Math.max(0, total - paid);
      map.set(key, row);
    }
    return order
      .map((status) => ({ status, ...(map.get(status) ?? { count: 0, amountTotal: 0, paidTotal: 0, openTotal: 0 }) }))
      .filter((r) => r.count > 0);
  }, [scopedBulletins]);

  if (!canAccess && !roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Acesso restrito ao Financeiro e Admin.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">Financeiro</p>
            <h1 className="text-xl font-semibold text-white">Visao gerencial financeira</h1>
            <p className="mt-1 text-sm text-blue-100/90">
              Comparativos economicos de custos diretos/indiretos, extras e margem por projeto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPageHelp(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              <CircleHelp size={14} />
              Ajuda da pagina
            </button>
            <select
              value={windowKey}
              onChange={(e) => setWindowKey(e.target.value as WindowKey)}
              className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white"
            >
              <option value="30" className="bg-white text-slate-900">Ultimos 30 dias</option>
              <option value="90" className="bg-white text-slate-900">Ultimos 90 dias</option>
              <option value="180" className="bg-white text-slate-900">Ultimos 180 dias</option>
              <option value="365" className="bg-white text-slate-900">Ultimos 365 dias</option>
              <option value="custom" className="bg-white text-slate-900">Periodo customizado</option>
              <option value="all" className="bg-white text-slate-900">Historico</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-blue-100">
            Cliente
            <select
              value={clientFilter}
              onChange={(e) => {
                const next = e.target.value as "all" | string;
                setClientFilter(next);
                setProjectFilter("all");
              }}
              className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-normal text-white"
            >
              <option value="all" className="bg-white text-slate-900">Todos os clientes</option>
              {projectClients.map((c) => (
                <option key={c.id} value={c.id} className="bg-white text-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-blue-100">
            Projeto
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value as "all" | string)}
              className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-normal text-white"
            >
              <option value="all" className="bg-white text-slate-900">Todos os projetos</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id} className="bg-white text-slate-900">
                  {p.name}
                  {p.client_id && clientNameById.get(p.client_id) ? ` (${clientNameById.get(p.client_id)})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-blue-100/90">Status do boletim (financeiro):</span>
          <select
            value={bulletinStatusFilter}
            onChange={(e) => setBulletinStatusFilter(e.target.value as "all" | BulletinStatus)}
            className="h-9 rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-white"
          >
            <option value="all" className="bg-white text-slate-900">Todos</option>
            <option value="em_analise" className="bg-white text-slate-900">Em analise</option>
            <option value="faturado" className="bg-white text-slate-900">Faturado</option>
            <option value="enviado_cliente" className="bg-white text-slate-900">Enviado ao cliente</option>
            <option value="previsao_pagamento" className="bg-white text-slate-900">Previsao de pagamento</option>
            <option value="parcialmente_pago" className="bg-white text-slate-900">Parcialmente pago</option>
            <option value="pago" className="bg-white text-slate-900">Pago</option>
            <option value="atrasado" className="bg-white text-slate-900">Atrasado</option>
            <option value="cancelado" className="bg-white text-slate-900">Cancelado</option>
            <option value="outro" className="bg-white text-slate-900">Outro</option>
          </select>
          {bulletinStatusFilter !== "all" ? (
            <button
              type="button"
              onClick={() => setBulletinStatusFilter("all")}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              Limpar filtro de status
            </button>
          ) : null}
        </div>
        {windowKey === "custom" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-blue-100">
              Data inicial
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-normal text-white"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-blue-100">
              Data final
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-normal text-white"
              />
            </label>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-blue-100/90">Filtros ativos:</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            Janela: {windowKey === "all" ? "Historico" : windowKey === "custom" ? "Customizado" : `${windowKey} dias`}
          </span>
          {clientFilter !== "all" ? (
            <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs text-sky-100">
              Cliente: {clientNameById.get(clientFilter) ?? "Selecionado"}
            </span>
          ) : null}
          {projectFilter !== "all" ? (
            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-100">
              Projeto: {filteredProjects.find((p) => p.id === projectFilter)?.name ?? "Selecionado"}
            </span>
          ) : null}
          {bulletinStatusFilter !== "all" ? (
            <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs text-amber-100">
              Status boletim: {bulletinStatusLabel(bulletinStatusFilter)}
            </span>
          ) : null}
        </div>
        {msg ? <p className="mt-3 text-sm text-rose-200">{msg}</p> : null}
      </section>

      <PageHelpModal
        open={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="Ajuda da pagina - Visao gerencial financeira"
        items={[
          { title: "Resumo", text: "Resumo das principais formulas e leituras da tela." },
          { title: "Custo total (global)", text: "Direto reconhecido + custos indiretos + folha projetada do ciclo completo dos projetos filtrados." },
          { title: "Fluxo 30/60/90", text: "Entradas consideram boletins pagos (pagamento confirmado). Saidas combinam folha mensal atual, remessas em aberto, extras pendentes e indiretos estimados." },
          { title: "Recebimento / Orcado", text: "% recebido por projeto = boletins pagos / orcamento do projeto." },
          { title: "Semaforo de risco", text: "Classificacao gerencial baseada no ciclo completo do projeto: margem, extras pendentes e peso de indireto. Serve para priorizacao." },
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-4 shadow-sm"><div className="mb-2 h-1.5 rounded-full bg-indigo-500" /><p className="text-xs text-slate-500">Orcamento total</p><p className="mt-1 text-xl font-semibold text-slate-900">{money(summary.budget)}</p><p className="mt-1 text-xs text-slate-500">Base: {filteredProjects.length} projeto(s)</p></div>
        <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm"><div className="mb-2 h-1.5 rounded-full bg-sky-500" /><p className="text-xs text-slate-500">Direto reconhecido</p><p className="mt-1 text-xl font-semibold text-slate-900">{money(summary.directRecognized)}</p><p className="mt-1 text-xs text-slate-500">Base: extras aprovados + pagos</p></div>
        <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-br from-white to-fuchsia-50 p-4 shadow-sm"><div className="mb-2 h-1.5 rounded-full bg-fuchsia-500" /><p className="text-xs text-slate-500">Indireto</p><p className="mt-1 text-xl font-semibold text-slate-900">{money(summary.indirect)}</p><p className="mt-1 text-xs text-slate-500">Base: lancamentos indiretos no recorte</p></div>
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-4 shadow-sm"><div className="mb-2 h-1.5 rounded-full bg-amber-500" /><p className="text-xs text-slate-500">Extras pendentes</p><p className="mt-1 text-xl font-semibold text-amber-700">{money(summary.extrasPending)}</p><p className="mt-1 text-xs text-slate-500">Base: extras com status pendente</p></div>
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-4 shadow-sm"><div className="mb-2 h-1.5 rounded-full bg-emerald-500" /><p className="text-xs text-slate-500">Folha mensal do recorte</p><p className="mt-1 text-xl font-semibold text-slate-900">{money(summary.payroll)}</p><p className="mt-1 text-xs text-slate-500">Base: {collaboratorUserIdsInFilteredProjects.size} membro(s) de projeto</p></div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div
          className={`rounded-xl border bg-white p-4 ${
            uiAlerts.hasOverdueBulletins || uiAlerts.lowRealization
              ? "border-amber-300 bg-amber-50/30"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Indicadores economicos</p>
            <InfoTooltip
              title="Indicadores economicos"
              body={[
                "Custo total projetado usa o ciclo completo dos projetos filtrados: do inicio ate a previsao de termino.",
                "Margem global estimada compara esse custo total projetado com o orcamento dos projetos filtrados.",
                "Taxa de aprovacao de extras continua usando extras pendentes/aprovados/pagos do recorte atual.",
              ]}
            />
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>Custo total projetado do ciclo (direto + indireto + folha): <b>{money(lifecycleSummary.totalCost)}</b></p>
            <p>Margem global estimada (inicio ao fim): <b className={lifecycleSummary.margin < 0 ? "text-rose-700" : "text-emerald-700"}>{pct(lifecycleSummary.margin)}</b></p>
            <p>Taxa de aprovacao de extras: <b>{pct(summary.approvalRate)}</b></p>
            <p>Extras aprovados + pagos: <b>{money(summary.extrasApproved + summary.extrasPaid)}</b></p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Comparativo mensal (6 meses, recorte atual)</p>
            <InfoTooltip
              title="Comparativo mensal (6 meses)"
              body={[
                  "Mostra variacao mensal de custos no recorte atual (extras e indiretos).",
                "A barra compara cada mes com o maior total mensal exibido.",
              ]}
            />
          </div>
          <div className="mt-3 space-y-2">
            {monthly.map((m) => {
              const total = m.pending + m.approvedPaid + m.indirect;
              const width = maxMonthly > 0 ? Math.max(6, Math.round((total / maxMonthly) * 100)) : 0;
              return (
                <div key={m.month} className="text-xs text-slate-700">
                  <div className="mb-1 flex items-center justify-between">
                    <span>{monthLabel(m.month)}</span>
                    <span>{money(total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-700" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {monthly.length === 0 ? <p className="text-sm text-slate-500">Sem dados mensais no periodo.</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Entradas previstas x realizadas (boletins)</p>
            <InfoTooltip
              title="Entradas previstas x realizadas (boletins)"
              body={[
                "Compara boletins em aberto (a receber) com valores ja recebidos.",
                "Inadimplencia indica saldo aberto com previsao de pagamento vencida.",
                "Taxa de realizacao = recebido / (recebido + a receber).",
              ]}
            />
          </div>
          {(uiAlerts.hasOverdueBulletins || uiAlerts.lowRealization) ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {uiAlerts.hasOverdueBulletins ? "Atencao: existem boletins com saldo em atraso. " : ""}
              {uiAlerts.lowRealization ? "Taxa de realizacao abaixo de 50% no recorte atual." : ""}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">A receber (previsto em aberto)</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{money(bulletinCashStats.expectedOpen)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Realizado (pago acumulado)</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{money(bulletinCashStats.paidTotal)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Em atraso (inadimplencia)</p>
              <p className="mt-1 text-lg font-semibold text-rose-700">{money(bulletinCashStats.overdueOpen)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Taxa de realizacao</p>
              <p className={`mt-1 text-lg font-semibold ${bulletinCashStats.realizedVsExpectedRate < 50 ? "text-rose-700" : bulletinCashStats.realizedVsExpectedRate < 75 ? "text-amber-700" : "text-emerald-700"}`}>
                {pct(bulletinCashStats.realizedVsExpectedRate)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
              <p className="text-xs text-slate-500">Percentual de recebimento sobre o valor orcado</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className={`text-lg font-semibold ${bulletinCashStats.budgetReceiptRate < 30 ? "text-amber-700" : bulletinCashStats.budgetReceiptRate > 100 ? "text-emerald-700" : "text-slate-900"}`}>
                  {pct(bulletinCashStats.budgetReceiptRate)}
                </p>
                <p className="text-xs text-slate-600">
                  Recebido: <b>{money(bulletinCashStats.paidTotal)}</b> de <b>{money(summary.budget)}</b>
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${bulletinCashStats.budgetReceiptRate >= 100 ? "bg-emerald-500" : bulletinCashStats.budgetReceiptRate >= 60 ? "bg-sky-500" : bulletinCashStats.budgetReceiptRate >= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${Math.max(3, Math.min(100, Math.round(bulletinCashStats.budgetReceiptRate)))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border bg-white p-4 ${
            uiAlerts.hasHighRisk ? "border-rose-300 bg-rose-50/20" : uiAlerts.hasModerateRisk ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Acuracia de recebimento (ultimos 6 meses)</p>
            <InfoTooltip
              title="Acuracia de recebimento (ultimos 6 meses)"
              body={[
                "Mede quanto do previsto em boletins virou recebimento em cada mes.",
                "Ajuda a calibrar previsoes e expectativas de caixa.",
              ]}
            />
          </div>
          <div className="mt-3 space-y-2">
            {monthlyBulletinPerformance.map((m) => (
              <div key={`bp-${m.month}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700">{monthLabel(m.month)}</span>
                  <span className={m.bulletinRealizationRate < 50 ? "text-rose-700" : m.bulletinRealizationRate < 75 ? "text-amber-700" : "text-emerald-700"}>
                    {pct(m.bulletinRealizationRate)}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${m.bulletinRealizationRate < 50 ? "bg-rose-500" : m.bulletinRealizationRate < 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.max(4, Math.min(100, Math.round(m.bulletinRealizationRate)))}%` }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>Previsto: {money(m.bulletinExpected + m.bulletinPaid)}</span>
                  <span>Realizado: {money(m.bulletinPaid)}</span>
                </div>
              </div>
            ))}
            {monthlyBulletinPerformance.length === 0 ? <p className="text-sm text-slate-500">Sem boletins no periodo.</p> : null}
          </div>
        </div>
      </section>

      {selectedPredictabilityDetail ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setShowPredictabilityDetails(null)}
        >
          <div
            className="relative w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPredictabilityDetails(null)}
              className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <div className="pr-24">
              <h3 className="text-base font-semibold text-slate-900">Base da previsibilidade documental</h3>
              <p className="mt-1 text-sm text-slate-600">
                Documentos previstos para {selectedPredictabilityDetail.label.toLowerCase()}, com percentual de realizacao calculado pelo status atual do entregavel.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Janela</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedPredictabilityDetail.label}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Documentos no periodo</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedPredictabilityDetail.count}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Realizacao media</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedPredictabilityDetail.count ? pct(selectedPredictabilityDetail.averageRealizationPct) : "-"}</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-3 text-left">Projeto</th>
                    <th className="p-3 text-left">Documento</th>
                    <th className="p-3 text-left">Prazo</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Financeiro</th>
                    <th className="p-3 text-right">% realizacao</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPredictabilityDetail.items.length ? (
                    selectedPredictabilityDetail.items.map((item) => (
                      <tr key={`predictability-${selectedPredictabilityDetail.days}-${item.id}`} className="border-t border-slate-100">
                        <td className="p-3 font-medium text-slate-900">{item.projectName}</td>
                        <td className="p-3 text-slate-700">{item.title}</td>
                        <td className="p-3 text-slate-700">{formatDateBR(item.dueDateRaw)}</td>
                        <td className="p-3 text-slate-700">{deliverableStatusLabel(item.status)}</td>
                        <td className="p-3 text-slate-700">{deliverableFinancialStatusLabel(item.financial_status)}</td>
                        <td className={`p-3 text-right font-semibold ${item.realizationPct >= 85 ? "text-emerald-700" : item.realizationPct >= 60 ? "text-amber-700" : "text-slate-700"}`}>
                          {pct(item.realizationPct)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-3 text-slate-500">Sem documentos previstos nesta janela.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showBudgetVsRealDetails ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setShowBudgetVsRealDetails(false)}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowBudgetVsRealDetails(false)}
              className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <div className="pr-24">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Base de Orcado x Real</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Detalhamento consolidado por projeto na visao do ciclo completo: orcado, direto, indireto, folha, real total e desvio.
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[820px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-3 text-left">Projeto</th>
                    <th className="p-3 text-right">Orcado</th>
                    <th className="p-3 text-right">Direto</th>
                    <th className="p-3 text-right">Indireto</th>
                    <th className="p-3 text-right">Folha</th>
                    <th className="p-3 text-right">Real total</th>
                    <th className="p-3 text-right">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {lifecycleByProject.length ? (
                    lifecycleByProject.map((p) => (
                      <tr key={`budget-real-modal-${p.id}`} className="border-t border-slate-100">
                        <td className="p-3 font-medium text-slate-900">{p.name}</td>
                        <td className="p-3 text-right text-slate-700">{money(p.budget)}</td>
                        <td className="p-3 text-right text-slate-700">{money(p.direct)}</td>
                        <td className="p-3 text-right text-slate-700">{money(p.indirect)}</td>
                        <td className="p-3 text-right text-slate-700">{money(p.payroll)}</td>
                        <td className="p-3 text-right font-semibold text-slate-900">{money(p.totalCost)}</td>
                        <td className={`p-3 text-right font-semibold ${p.budget - p.totalCost < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {money(p.budget - p.totalCost)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-3 text-slate-500">Nenhum projeto no recorte atual.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showRiskDetails ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setShowRiskDetails(false)}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowRiskDetails(false)}
              className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <div className="pr-24">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Base do Semaforo de Risco</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Detalhamento do score por projeto na visao do ciclo completo, com margem, peso de indireto e extras pendentes.
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-3 text-left">Projeto</th>
                    <th className="p-3 text-right">Score</th>
                    <th className="p-3 text-left">Nivel</th>
                    <th className="p-3 text-right">Margem</th>
                    <th className="p-3 text-right">Folha</th>
                    <th className="p-3 text-right">Extras pendentes</th>
                    <th className="p-3 text-right">Pend./Orcado</th>
                    <th className="p-3 text-right">Indireto</th>
                    <th className="p-3 text-right">Indir./Orcado</th>
                    <th className="p-3 text-left">Motivos</th>
                  </tr>
                </thead>
                <tbody>
                  {lifecycleRiskByProject.length ? (
                    lifecycleRiskByProject.map((p) => (
                      <tr key={`risk-modal-${p.id}`} className="border-t border-slate-100">
                        <td className="p-3 font-medium text-slate-900">{p.name}</td>
                        <td className="p-3 text-right font-semibold text-slate-900">{p.score}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              p.level === "vermelho"
                                ? "bg-rose-50 text-rose-700"
                                : p.level === "amarelo"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {p.level === "vermelho" ? "Risco alto" : p.level === "amarelo" ? "Risco moderado" : "Risco baixo"}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-semibold ${p.margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{pct(p.margin)}</td>
                        <td className="p-3 text-right text-slate-700">{money(p.payroll)}</td>
                        <td className="p-3 text-right text-amber-700">{money(p.pending)}</td>
                        <td className="p-3 text-right text-slate-700">{pct(p.pendingPct)}</td>
                        <td className="p-3 text-right text-slate-700">{money(p.indirect)}</td>
                        <td className="p-3 text-right text-slate-700">{pct(p.indirectPct)}</td>
                        <td className="p-3 text-slate-600">{p.reasons.length ? p.reasons.join(", ") : "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-3 text-slate-500">Nenhum projeto no recorte atual.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showPayrollProjectionDetails ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setShowPayrollProjectionDetails(false)}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPayrollProjectionDetails(false)}
              className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <div className="pr-24">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Base da Folha Projetada</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Competencia atual com rateio automatico do salario entre projetos quando o membro participa de mais de um.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">
                A folha usa apenas a competencia atual. Se houver alocacao cadastrada, ela prevalece; sem alocacao explicita, o sistema divide igualmente.
              </p>
              <InfoTooltip
                title="Base da folha mensal rateada"
                body={[
                  "A folha usa apenas a competencia atual, nao soma meses passados do recorte.",
                  "Se existir alocacao vigente em project_member_allocations, o salario segue esses percentuais.",
                  "Sem alocacao explicita, o sistema divide igualmente entre os projetos ativos em que o membro participa.",
                ]}
              />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1040px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-3 text-left">Membro</th>
                    <th className="p-3 text-left">Regra aplicada</th>
                    <th className="p-3 text-right">Salario base</th>
                    <th className="p-3 text-right">Total alocado (projetos filtrados)</th>
                    <th className="p-3 text-left">Rateio atual</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollBreakdown.length ? (
                    payrollBreakdown.map((row) => (
                      <tr key={`pb-modal-${row.userId}`} className="border-t border-slate-100">
                        <td className="p-3 font-medium text-slate-900">{row.name}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              row.allocationRule === "allocation"
                                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                                : row.allocationRule === "mixed"
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                            }`}
                          >
                            {row.allocationRule === "allocation"
                              ? "Alocacao cadastrada"
                              : row.allocationRule === "mixed"
                                ? "Misto"
                                : "Divisao igual"}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-700">{money(row.salary)}</td>
                        <td className="p-3 text-right font-semibold text-emerald-700">{money(row.filteredAllocatedSalary)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {row.allocations.map((allocation) => {
                              const activeInFilter = filteredProjectIdSet.has(allocation.projectId);
                              return (
                                <span
                                  key={`${row.userId}-${allocation.projectId}-modal`}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    activeInFilter
                                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                      : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                                  }`}
                                >
                                  {allocation.projectName}: {pct(allocation.weightPct)} ({money(allocation.allocatedSalary)})
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-3 text-slate-500">
                        Nenhum membro com salario ativo entrou na folha mensal do recorte atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showIndirectProjectionDetails ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setShowIndirectProjectionDetails(false)}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowIndirectProjectionDetails(false)}
              className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <div className="pr-24">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Base dos Indiretos Estimados</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Cada linha mostra o valor mensal efetivo e quanto entra nos horizontes de 30, 60 e 90 dias.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">
                Mensal e % sobre salario entram pela vigencia ativa. Pontual entra apenas dentro do horizonte do evento.
              </p>
              <InfoTooltip
                title="Base dos indiretos"
                body={[
                  "Mensal e % sobre salario entram pela vigencia ativa no horizonte.",
                  "Pontual entra apenas se a data do evento cair dentro do horizonte.",
                  "Valores percentuais usam o salario atual do colaborador da origem.",
                ]}
              />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-3 text-left">Projeto</th>
                    <th className="p-3 text-left">Tipo</th>
                    <th className="p-3 text-left">Origem</th>
                    <th className="p-3 text-left">Vigencia</th>
                    <th className="p-3 text-right">Base mensal</th>
                    <th className="p-3 text-right">30 dias</th>
                    <th className="p-3 text-right">60 dias</th>
                    <th className="p-3 text-right">90 dias</th>
                  </tr>
                </thead>
                <tbody>
                  {indirectProjectionBreakdown.length ? (
                    indirectProjectionBreakdown.map((row) => (
                      <tr key={`ind-break-modal-${row.id}`} className="border-t border-slate-100">
                        <td className="p-3 font-medium text-slate-900">{row.projectName}</td>
                        <td className="p-3 text-slate-700">{row.typeLabel}</td>
                        <td className="p-3 text-slate-700">{row.sourceLabel}</td>
                        <td className="p-3 text-slate-600">{row.startDate} ate {row.endDate}</td>
                        <td className="p-3 text-right text-slate-700">{money(row.monthlyEquivalent)}</td>
                        <td className="p-3 text-right text-slate-700">{money(row.valuesByHorizon[0] ?? 0)}</td>
                        <td className="p-3 text-right text-slate-700">{money(row.valuesByHorizon[1] ?? 0)}</td>
                        <td className="p-3 text-right text-slate-700">{money(row.valuesByHorizon[2] ?? 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-3 text-slate-500">
                        Nenhum lancamento indireto ativo entra no horizonte projetado atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-start gap-2">
              <p className="text-sm font-semibold text-slate-900">Boletins por status (fila financeira)</p>
              <InfoTooltip
                title="Boletins por status (fila financeira)"
                body={[
                  "Resume a fila de boletins no recorte atual por status.",
                  "Clique no status para filtrar automaticamente os boletins na visao.",
                ]}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Quantidade e valores por status no recorte atual (cliente/projeto/periodo).
            </p>
          </div>
          <button
            type="button"
            onClick={exportBoletinsStatusCsv}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3 text-right">Valor total</th>
                <th className="p-3 text-right">Recebido</th>
                <th className="p-3 text-right">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {bulletinsByStatus.map((r) => {
                const activeRow = bulletinStatusFilter === r.status;
                return (
                <tr
                  key={r.status}
                  className={`border-t border-slate-100 odd:bg-white even:bg-slate-50/40 transition ${
                    activeRow ? "bg-sky-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="p-3 font-medium text-slate-900">
                    <button
                      type="button"
                      onClick={() => setBulletinStatusFilter(activeRow ? "all" : r.status)}
                      className={`rounded-lg px-2 py-1 text-left text-sm font-medium ${
                        activeRow ? "bg-sky-100 text-sky-800" : "hover:bg-slate-100"
                      }`}
                      title={activeRow ? "Remover filtro deste status" : "Filtrar por este status"}
                    >
                      {bulletinStatusLabel(r.status)}
                    </button>
                  </td>
                  <td className="p-3 text-right text-slate-700">{r.count}</td>
                  <td className="p-3 text-right text-slate-700">{money(r.amountTotal)}</td>
                  <td className="p-3 text-right text-emerald-700">{money(r.paidTotal)}</td>
                  <td className={`p-3 text-right ${r.openTotal > 0 ? "text-amber-700" : "text-slate-500"}`}>{money(r.openTotal)}</td>
                </tr>
              )})}
              {bulletinsByStatus.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-slate-500">Sem boletins no recorte atual.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-start gap-2">
              <p className="text-sm font-semibold text-slate-900">Fluxo de caixa projetado (30/60/90 dias)</p>
              <InfoTooltip
                title="Fluxo de caixa projetado (30/60/90 dias)"
                body={[
                  "Entradas consideram apenas boletins com pagamento confirmado (boletins pagos).",
                  "Saidas combinam folha mensal atual, remessas, extras pendentes e indiretos estimados.",
                  "Saldo projetado = entradas realizadas - saidas projetadas.",
                  "Previsibilidade documental mostra a maturidade dos documentos por janela de entrega e abre o detalhamento ao clicar.",
                ]}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Projecao operacional de saidas (folha mensal atual, remessas, extras pendentes e indiretos estimados) e pressao sobre o orcamento ativo.
            </p>
          </div>
          <button
            type="button"
            onClick={exportFluxoCaixaCsv}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        </div>
        <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 shadow-sm">
              <tr>
                <th className="p-3 text-left">Indicador</th>
                {cashProjection.map((p) => (
                  <th key={`h-${p.days}`} className="p-3 text-right">
                    {p.days} dias
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-900">Entradas realizadas (boletins pagos)</td>
                {cashProjection.map((p) => (
                  <td key={`in-${p.days}`} className="p-3 text-right font-semibold text-emerald-700">{money(p.bulletinIn)}</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100 bg-slate-50/40">
                <td className="p-3 font-medium text-slate-900">
                  <button
                    type="button"
                    onClick={() => setShowPayrollProjectionDetails(true)}
                    className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100"
                  >
                    <span>Folha projetada</span>
                    <span className="text-xs font-semibold text-emerald-700">Ver base</span>
                  </button>
                </td>
                {cashProjection.map((p) => (
                  <td key={`payroll-${p.days}`} className="p-3 text-right text-slate-700">{money(p.payrollOut)}</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-900">Remessas em aberto</td>
                {cashProjection.map((p) => (
                  <td key={`rem-${p.days}`} className="p-3 text-right text-slate-700">{money(p.remittanceOut)}</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100 bg-slate-50/40">
                <td className="p-3 font-medium text-slate-900">Extras pendentes</td>
                {cashProjection.map((p) => (
                  <td key={`extra-${p.days}`} className="p-3 text-right text-amber-700">{money(p.extrasPendingOut)}</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-900">
                  <button
                    type="button"
                    onClick={() => setShowIndirectProjectionDetails(true)}
                    className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-100"
                  >
                    <span>Indiretos estimados</span>
                    <span className="text-xs font-semibold text-fuchsia-700">Ver base</span>
                  </button>
                </td>
                {cashProjection.map((p) => (
                  <td key={`ind-${p.days}`} className="p-3 text-right text-slate-700">{money(p.indirectProjected)}</td>
                ))}
              </tr>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="p-3 font-semibold text-slate-900">Saida total projetada</td>
                {cashProjection.map((p) => (
                  <td key={`out-${p.days}`} className="p-3 text-right font-semibold text-slate-900">{money(p.totalOut)}</td>
                ))}
              </tr>
              <tr className="border-t border-slate-100">
                <td className="p-3 font-semibold text-slate-900">Saldo projetado</td>
                {cashProjection.map((p) => (
                  <td key={`net-${p.days}`} className={`p-3 text-right font-semibold ${p.netProjected < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {money(p.netProjected)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-100 bg-slate-50/40">
                <td className="p-3 font-medium text-slate-900">
                  <span className="inline-flex items-center gap-2">
                    Previsibilidade de documentos
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">clicar abre base</span>
                  </span>
                </td>
                {predictabilityProjection.map((p) => (
                  <td key={`predict-${p.days}`} className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setShowPredictabilityDetails(p.days)}
                      className="inline-flex min-w-[120px] flex-col items-end rounded-lg px-2 py-1 hover:bg-slate-100"
                    >
                      <span className={`text-sm font-semibold ${p.averageRealizationPct >= 85 ? "text-emerald-700" : p.averageRealizationPct >= 60 ? "text-amber-700" : "text-slate-700"}`}>
                        {p.count ? pct(p.averageRealizationPct) : "-"}
                      </span>
                      <span className="text-[11px] text-slate-500">{p.count} doc(s)</span>
                    </button>
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-900">Pressao no orcamento ativo</td>
                {cashProjection.map((p) => (
                  <td
                    key={`press-${p.days}`}
                    className={`p-3 text-right font-semibold ${p.budgetCoveragePct > 60 ? "text-rose-700" : p.budgetCoveragePct > 35 ? "text-amber-700" : "text-emerald-700"}`}
                  >
                    {pct(p.budgetCoveragePct)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Semaforo de risco financeiro (visao contratual)</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRiskDetails(true)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ver base
              </button>
              <InfoTooltip
                title="Semaforo de risco financeiro (visao contratual)"
                body={[
                  "Classifica risco com base no ciclo completo do projeto: margem, extras pendentes e peso de custo indireto.",
                  "E uma priorizacao gerencial e nao substitui analise detalhada de caixa.",
                ]}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">Visao contratual do ciclo completo: margem, extras pendentes e peso de custo indireto.</p>
          {uiAlerts.hasHighRisk ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Atencao: ha projeto(s) em risco alto. Priorize revisao de margem, extras pendentes e custo indireto.
            </div>
          ) : uiAlerts.hasModerateRisk ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Existem projetos com risco moderado. Acompanhe evolucao de margem e pendencias.
            </div>
          ) : null}
          <div className="mt-3 space-y-2">
            {lifecycleRiskByProject.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      Margem {pct(p.margin)} | Folha {money(p.payroll)} | Pendente {money(p.pending)} | Indireto {money(p.indirect)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      p.level === "vermelho"
                        ? "bg-rose-50 text-rose-700"
                        : p.level === "amarelo"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {p.level === "vermelho" ? "Risco alto" : p.level === "amarelo" ? "Risco moderado" : "Risco baixo"}
                  </span>
                </div>
                {p.reasons.length ? (
                  <p className="mt-2 text-xs text-slate-600">Motivos: {p.reasons.join(", ")}</p>
                ) : null}
              </div>
            ))}
            {lifecycleRiskByProject.length === 0 ? <p className="text-sm text-slate-500">Sem projetos para analise.</p> : null}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-800">Risco baixo</p>
              <p className="mt-1 text-[11px] text-emerald-800/90">
                Margem saudavel e baixo peso de pendencias/extras no custo total.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">Risco moderado</p>
              <p className="mt-1 text-[11px] text-amber-800/90">
                Exige acompanhamento: margem pressionada ou aumento relevante de indiretos/extras.
              </p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2">
              <p className="text-xs font-semibold text-rose-800">Risco alto</p>
              <p className="mt-1 text-[11px] text-rose-800/90">
                Prioridade imediata: margem critica e maior comprometimento do orcamento.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Orcado x Real (visao contratual)</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBudgetVsRealDetails(true)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ver base
              </button>
              <InfoTooltip
                title="Orcado x Real (visao contratual)"
                body={[
                  "Compara o orcamento com o custo total projetado do ciclo completo do projeto.",
                  "Top e piores margens ajudam a priorizar acoes da equipe financeira/gestao.",
                ]}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Top margens</p>
              <div className="mt-2 space-y-2">
                {topMargins.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">{p.name}</span>
                    <span className="font-semibold text-emerald-700">{pct(p.margin)}</span>
                  </div>
                ))}
                {topMargins.length === 0 ? <p className="text-xs text-slate-500">Sem dados.</p> : null}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Piores margens</p>
              <div className="mt-2 space-y-2">
                {worstMargins.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">{p.name}</span>
                    <span className={`font-semibold ${p.margin < 0 ? "text-rose-700" : "text-amber-700"}`}>{pct(p.margin)}</span>
                  </div>
                ))}
                {worstMargins.length === 0 ? <p className="text-xs text-slate-500">Sem dados.</p> : null}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <p>
              <b>Orcado:</b> {money(lifecycleSummary.budget)} | <b>Real do ciclo (direto + indireto + folha):</b> {money(lifecycleSummary.totalCost)}
            </p>
            <p className="mt-1">
              <b>Desvio:</b>{" "}
              <span className={lifecycleSummary.budget - lifecycleSummary.totalCost < 0 ? "text-rose-700 font-semibold" : "text-emerald-700 font-semibold"}>
                {money(lifecycleSummary.budget - lifecycleSummary.totalCost)}
              </span>
            </p>
          </div>
          {null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-start gap-2">
              <p className="text-sm font-semibold text-slate-900">Comparativo por projeto (recorte atual)</p>
              <InfoTooltip
                title="Comparativo por projeto"
                body={[
                  "Tabela analitica por projeto no recorte atual, com orcamento, recebimento, custos e margem.",
                  "Use a ordenacao por coluna e o export CSV para analise detalhada.",
                ]}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Clique no cabecalho para ordenar. Atual: {projectSort.key} ({projectSort.dir === "asc" ? "crescente" : "decrescente"}).
            </p>
          </div>
          <button
            type="button"
            onClick={exportComparativoProjetosCsv}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        </div>
        <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 shadow-sm">
              <tr>
                {[
                  ["Projeto", "name"],
                  ["Status", "status"],
                  ["Orcamento", "budget"],
                  ["Recebido (R$)", "received"],
                  ["Receb./Orcado", "receiptRate"],
                  ["Direto", "direct"],
                  ["Indireto", "indirect"],
                  ["Folha", "payroll"],
                  ["Real total", "realTotal"],
                  ["Extras pendentes", "pending"],
                  ["Margem", "margin"],
                ].map(([label, key]) => (
                  <th key={String(key)} className={`p-3 ${["name", "status"].includes(String(key)) ? "text-left" : "text-right"}`}>
                    <button
                      type="button"
                      onClick={() => toggleProjectSort(key as ProjectSortKey)}
                      className="inline-flex items-center gap-1 font-semibold hover:text-slate-900"
                      title={`Ordenar por ${label}`}
                    >
                      {label}
                      <ArrowDownUp size={14} className={projectSort.key === key ? "text-slate-900" : "text-slate-400"} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedByProject.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
                  <td className="p-3 font-medium text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600">{p.status === "active" ? "Ativo" : p.status === "paused" ? "Pausado" : "Concluido"}</td>
                  <td className="p-3 text-right text-slate-700">{money(p.budget)}</td>
                  <td className="p-3 text-right text-emerald-700">{money(p.bulletinPaid)}</td>
                  <td className={`p-3 text-right font-semibold ${p.receiptRate >= 100 ? "text-emerald-700" : p.receiptRate >= 50 ? "text-sky-700" : "text-slate-700"}`}>{pct(p.receiptRate)}</td>
                  <td className="p-3 text-right text-slate-700">{money(p.direct)}</td>
                  <td className="p-3 text-right text-slate-700">{money(p.indirect)}</td>
                  <td className="p-3 text-right text-slate-700">{money(p.payroll)}</td>
                  <td className="p-3 text-right font-semibold text-slate-900">{money(p.totalCost)}</td>
                  <td className="p-3 text-right text-amber-700">{money(p.pending)}</td>
                  <td className={`p-3 text-right font-semibold ${p.margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{pct(p.margin)}</td>
                </tr>
              ))}
              {sortedByProject.length > 0 ? (
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="p-3 text-slate-900">Total</td>
                  <td className="p-3 text-slate-500">-</td>
                  <td className="p-3 text-right text-slate-900">{money(byProjectTotals.budget)}</td>
                  <td className="p-3 text-right text-emerald-700">{money(sortedByProject.reduce((acc, p) => acc + p.bulletinPaid, 0))}</td>
                  <td className="p-3 text-right text-slate-900">
                    {pct(summary.budget > 0 ? (sortedByProject.reduce((acc, p) => acc + p.bulletinPaid, 0) / summary.budget) * 100 : 0)}
                  </td>
                  <td className="p-3 text-right text-slate-900">{money(byProjectTotals.direct)}</td>
                  <td className="p-3 text-right text-slate-900">{money(byProjectTotals.indirect)}</td>
                  <td className="p-3 text-right text-slate-900">{money(byProjectTotals.payroll)}</td>
                  <td className="p-3 text-right font-semibold text-slate-900">{money(summary.totalCost)}</td>
                  <td className="p-3 text-right text-amber-700">{money(byProjectTotals.pending)}</td>
                  <td className={`p-3 text-right ${summary.margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{pct(summary.margin)}</td>
                </tr>
              ) : null}
              {sortedByProject.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-3 text-slate-500">Nenhum projeto para comparativo.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">
          Empresa vinculada: {companyId ? (companyName ?? "Carregando nome da empresa...") : "nao definida (visao global)"}.
        </p>
      </section>
    </div>
  );
}

