"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, MoreHorizontal, Pencil, Printer, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type CostCategory =
  | "rh"
  | "financeiro"
  | "adm"
  | "ti"
  | "juridico"
  | "utilidades"
  | "tributos"
  | "infraestrutura"
  | "outros";
type CostType = "monthly" | "one_time" | "percentage_payroll";
type SourceMode = "manual" | "collaborator" | "sector";
type SplitMode = "equal" | "budget";

type ProjectRow = {
  id: string;
  name: string;
  status: "active" | "paused" | "done";
  company_id: string | null;
  budget_total: number | null;
};

type CollaboratorRow = {
  id: string;
  user_id: string | null;
  nome: string | null;
  departamento: string | null;
  setor: string | null;
  salario: number | null;
  is_active: boolean | null;
};

type SectorOption = {
  key: string;
  label: string;
  count: number;
};

type IndirectCostRow = {
  id: string;
  project_id: string;
  cost_category: CostCategory;
  cost_type: CostType;
  amount: number;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
};

type IndirectCostAuditRow = {
  id: string;
  indirect_cost_id: string;
  project_id: string;
  action: "delete" | "update";
  reason: string;
  old_row?: Record<string, unknown> | null;
  new_row?: Record<string, unknown> | null;
  actor_user_id: string;
  actor_role: string | null;
  created_at: string;
};

function isLegacyAbsolutePercentageValue(amount: number) {
  return amount > 100;
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPctValue(v: number) {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function categoryLabel(v: CostCategory) {
  if (v === "rh") return "RH";
  if (v === "financeiro") return "Financeiro";
  if (v === "adm") return "Administrativo";
  if (v === "ti") return "TI";
  if (v === "juridico") return "Juridico";
  if (v === "utilidades") return "Utilidades";
  if (v === "tributos") return "Tributos";
  if (v === "infraestrutura") return "Infraestrutura";
  return "Outros";
}

function typeLabel(v: CostType) {
  if (v === "monthly") return "Mensal";
  if (v === "one_time") return "Pontual";
  return "% sobre salario";
}

function indirectAmountLabel(row: Pick<IndirectCostRow, "cost_type" | "amount">) {
  const amount = Number(row.amount) || 0;
  if (row.cost_type === "percentage_payroll" && !isLegacyAbsolutePercentageValue(amount)) {
    return fmtPctValue(amount);
  }
  return fmtMoney(amount);
}

function splitAmount(total: number, weights: number[]) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (!weights.length || safeTotal <= 0) return [];
  const totalWeight = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
  const baseWeights = totalWeight > 0 ? weights : weights.map(() => 1);
  const sumWeights = baseWeights.reduce((acc, w) => acc + w, 0);
  const raw = baseWeights.map((w) => (safeTotal * w) / sumWeights);
  const rounded = raw.map((v) => Math.round(v * 100) / 100);
  const roundedSum = rounded.reduce((acc, v) => acc + v, 0);
  const diff = Math.round((safeTotal - roundedSum) * 100) / 100;
  if (rounded.length) rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + diff) * 100) / 100;
  return rounded;
}

function parseNoteTag(notes: string | null, key: string) {
  const src = String(notes ?? "");
  const marker = `${key}=`;
  const start = src.indexOf(marker);
  if (start < 0) return "-";
  const tail = src.slice(start + marker.length);
  const end = tail.indexOf(" | ");
  const value = (end >= 0 ? tail.slice(0, end) : tail).trim();
  return value || "-";
}

function parseIndirectCollaboratorName(notes: string | null) {
  const source = parseNoteTag(notes, "Fonte");
  if (!source || source === "-") return "";
  if (!source.toLowerCase().startsWith("colaborador:")) return "";
  return source.slice("colaborador:".length).trim();
}

function isIntegralSingleProjectIndirect(notes: string | null) {
  return parseNoteTag(notes, "Rateio").toLowerCase() === "integral (projeto unico)";
}

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  const needs = /[",\n\r]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function htmlEscape(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function FinanceiroCustosIndiretosPage() {
  const { loading: roleLoading, role, active } = useUserRole();
  const isAllowed = active && (role === "financeiro" || role === "admin");
  const canDeleteHistory = active && role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [meId, setMeId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("Empresa");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("/logo.png");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [collabs, setCollabs] = useState<CollaboratorRow[]>([]);
  const [historyRows, setHistoryRows] = useState<IndirectCostRow[]>([]);
  const [auditRows, setAuditRows] = useState<IndirectCostAuditRow[]>([]);
  const [actorNameById, setActorNameById] = useState<Record<string, string>>({});
  const [editingHistoryId, setEditingHistoryId] = useState<string>("");
  const [editingHistorySource, setEditingHistorySource] = useState<string>("");
  const [openHistoryActionId, setOpenHistoryActionId] = useState<string>("");
  const [historyActionAnchor, setHistoryActionAnchor] = useState<{
    top: number;
    left: number;
    connectorTop: number;
    connectorLeft: number;
    connectorHeight: number;
  } | null>(null);
  const [detailHistoryRow, setDetailHistoryRow] = useState<IndirectCostRow | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const historySectionRef = useRef<HTMLElement | null>(null);
  const historyTableAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!detailHistoryRow && !auditModalOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (detailHistoryRow) setDetailHistoryRow(null);
      if (auditModalOpen) setAuditModalOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detailHistoryRow, auditModalOpen]);

  const [sourceMode, setSourceMode] = useState<SourceMode>("manual");
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [costCategory, setCostCategory] = useState<CostCategory>("adm");
  const [costType, setCostType] = useState<CostType>("monthly");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyProjectId, setHistoryProjectId] = useState<"all" | string>("all");
  const [historyCategory, setHistoryCategory] = useState<"all" | CostCategory>("all");
  const [historyType, setHistoryType] = useState<"all" | CostType>("all");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditActorId, setAuditActorId] = useState<"all" | string>("all");
  const [auditQ, setAuditQ] = useState("");

  const activeProjects = useMemo(
    () =>
      projects.filter(
        (p) => p.status === "active" && (!companyId || p.company_id === companyId || p.company_id === null)
      ),
    [projects, companyId]
  );

  const sectorOptions = useMemo(() => {
    const map = new Map<string, SectorOption>();
    for (const c of collabs) {
      const raw = (c.setor ?? c.departamento ?? "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(key, { key: raw, label: raw, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [collabs]);

  const selectedCollaborator = useMemo(
    () => collabs.find((c) => c.id === selectedCollaboratorId) ?? null,
    [collabs, selectedCollaboratorId]
  );

  const salaryByCollaboratorName = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of collabs) {
      const name = String(c.nome ?? "").trim().toLowerCase();
      if (!name) continue;
      map.set(name, Number(c.salario) || 0);
    }
    return map;
  }, [collabs]);

  const selectedSectorStats = useMemo(() => {
    const key = selectedSector.trim().toLowerCase();
    if (!key) return { count: 0, payroll: 0 };
    const list = collabs.filter((c) => (c.setor ?? c.departamento ?? "").trim().toLowerCase() === key);
    return {
      count: list.length,
      payroll: list.reduce((acc, c) => acc + (Number(c.salario) || 0), 0),
    };
  }, [collabs, selectedSector]);

  const amountNum = useMemo(() => Math.max(0, Number(amount.replace(",", ".")) || 0), [amount]);

  const projectWeights = useMemo(() => {
    if (splitMode === "budget") {
      const w = activeProjects.map((p) => Math.max(0, Number(p.budget_total) || 0));
      if (w.some((x) => x > 0)) return w;
    }
    return activeProjects.map(() => 1);
  }, [activeProjects, splitMode]);

  const preview = useMemo(() => {
    const values =
      costType === "percentage_payroll" && activeProjects.length <= 1
        ? activeProjects.map(() => amountNum)
        : splitAmount(amountNum, projectWeights);
    return activeProjects.map((p, idx) => ({
      project_id: p.id,
      project_name: p.name,
      value: values[idx] ?? 0,
    }));
  }, [activeProjects, amountNum, projectWeights, costType]);

  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const filteredHistory = useMemo(() => {
    const fromMs = historyFrom ? new Date(`${historyFrom}T00:00:00`).getTime() : null;
    const toMs = historyTo ? new Date(`${historyTo}T23:59:59`).getTime() : null;
    return historyRows.filter((r) => {
      if (historyProjectId !== "all" && r.project_id !== historyProjectId) return false;
      if (historyCategory !== "all" && r.cost_category !== historyCategory) return false;
      if (historyType !== "all" && r.cost_type !== historyType) return false;

      const createdMs = new Date(r.created_at).getTime();
      if (fromMs !== null && Number.isFinite(createdMs) && createdMs < fromMs) return false;
      if (toMs !== null && Number.isFinite(createdMs) && createdMs > toMs) return false;
      return true;
    });
  }, [historyRows, historyFrom, historyTo, historyProjectId, historyCategory, historyType]);

  const resolveEffectiveHistoryAmount = useMemo(
    () => (row: Pick<IndirectCostRow, "cost_type" | "amount" | "notes">) => {
      const amount = Number(row.amount) || 0;
      if (amount <= 0) return 0;
      if (row.cost_type !== "percentage_payroll") return amount;
      if (isLegacyAbsolutePercentageValue(amount)) return amount;
      const collaboratorName = parseIndirectCollaboratorName(row.notes ?? null);
      const collaboratorSalary = collaboratorName
        ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0)
        : 0;
      if (collaboratorSalary <= 0) return 0;
      return isIntegralSingleProjectIndirect(row.notes ?? null) || activeProjects.length <= 1
        ? collaboratorSalary
        : collaboratorSalary * (amount / 100);
    },
    [salaryByCollaboratorName, activeProjects.length]
  );

  const effectiveAmountDetail = useMemo(
    () => (row: Pick<IndirectCostRow, "cost_type" | "amount" | "notes">) => {
      const amount = Number(row.amount) || 0;
      if (row.cost_type !== "percentage_payroll" || isLegacyAbsolutePercentageValue(amount)) {
        return {
          label: indirectAmountLabel(row),
          hint: "",
        };
      }
      const collaboratorName = parseIndirectCollaboratorName(row.notes ?? null);
      const collaboratorSalary = collaboratorName
        ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0)
        : 0;
      if (collaboratorSalary > 0) {
        const isIntegral = isIntegralSingleProjectIndirect(row.notes ?? null) || activeProjects.length <= 1;
        const effective = isIntegral ? collaboratorSalary : collaboratorSalary * (amount / 100);
        return {
          label: fmtMoney(effective),
          hint: isIntegral
            ? `Integral sobre ${collaboratorName} (${fmtMoney(collaboratorSalary)})`
            : `${fmtPctValue(amount)} sobre ${collaboratorName} (${fmtMoney(collaboratorSalary)})`,
        };
      }
      return {
        label: "Nao identificado",
        hint: `${fmtPctValue(amount)} sem salario/origem valida`,
      };
    },
    [salaryByCollaboratorName, activeProjects.length]
  );

  const historyTotal = useMemo(
    () => filteredHistory.reduce((acc, r) => acc + resolveEffectiveHistoryAmount(r), 0),
    [filteredHistory, resolveEffectiveHistoryAmount]
  );

  const historyTotalLabel = useMemo(() => {
    return fmtMoney(historyTotal);
  }, [historyTotal]);

  const actorOptions = useMemo(() => {
    const ids = Array.from(new Set(auditRows.map((a) => a.actor_user_id).filter(Boolean)));
    return ids
      .map((id) => ({ id, label: actorNameById[id] ? `${actorNameById[id]} (${id.slice(0, 8)})` : `${id.slice(0, 8)}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [auditRows, actorNameById]);

  const filteredAuditRows = useMemo(() => {
    const fromMs = auditFrom ? new Date(`${auditFrom}T00:00:00`).getTime() : null;
    const toMs = auditTo ? new Date(`${auditTo}T23:59:59`).getTime() : null;
    const term = auditQ.trim().toLowerCase();
    return auditRows.filter((a) => {
      if (auditActorId !== "all" && a.actor_user_id !== auditActorId) return false;
      const createdMs = new Date(a.created_at).getTime();
      if (fromMs !== null && Number.isFinite(createdMs) && createdMs < fromMs) return false;
      if (toMs !== null && Number.isFinite(createdMs) && createdMs > toMs) return false;
      if (!term) return true;
      const haystack = [
        a.reason,
        a.action,
        a.actor_role ?? "",
        actorNameById[a.actor_user_id] ?? "",
        a.actor_user_id,
        projectNameById[a.project_id] ?? a.project_id,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [auditRows, auditFrom, auditTo, auditActorId, auditQ, actorNameById, projectNameById]);

  const openHistoryActionRow = useMemo(
    () => historyRows.find((row) => row.id === openHistoryActionId) ?? null,
    [historyRows, openHistoryActionId]
  );

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setMeId(authData.user.id);

      const [profileRes, projectsRes, collabsRes] = await Promise.all([
        supabase.from("profiles").select("company_id").eq("id", authData.user.id).maybeSingle<{ company_id: string | null }>(),
        supabase.from("projects").select("id,name,status,company_id,budget_total").order("created_at", { ascending: false }),
        supabase
          .from("colaboradores")
          .select("id,user_id,nome,departamento,setor,salario,is_active")
          .eq("is_active", true)
          .order("nome", { ascending: true }),
      ]);

      if (profileRes.error) throw new Error(profileRes.error.message);
      if (projectsRes.error) throw new Error(projectsRes.error.message);
      if (collabsRes.error) throw new Error(collabsRes.error.message);

      const cid = profileRes.data?.company_id ?? null;
      setCompanyId(cid);
      if (cid) {
        const companyRes = await supabase
          .from("company")
          .select("name,logo_url")
          .eq("id", cid)
          .maybeSingle<{ name: string | null; logo_url: string | null }>();
        if (!companyRes.error && companyRes.data) {
          setCompanyName((companyRes.data.name ?? "Empresa").trim() || "Empresa");
          setCompanyLogoUrl((companyRes.data.logo_url ?? "").trim() || "/logo.png");
        } else {
          setCompanyName("Empresa");
          setCompanyLogoUrl("/logo.png");
        }
      } else {
        setCompanyName("Empresa");
        setCompanyLogoUrl("/logo.png");
      }
      const projectList = (projectsRes.data ?? []) as ProjectRow[];
      setProjects(projectList);
      setCollabs((collabsRes.data ?? []) as CollaboratorRow[]);

      const scopedProjectIds = projectList
        .filter((p) => !cid || p.company_id === cid || p.company_id === null)
        .map((p) => p.id);

      if (scopedProjectIds.length) {
        const historyRes = await supabase
          .from("project_indirect_costs")
          .select("id,project_id,cost_category,cost_type,amount,notes,start_date,end_date,created_by,created_at")
          .in("project_id", scopedProjectIds)
          .order("created_at", { ascending: false })
          .limit(800);
        if (historyRes.error) throw new Error(historyRes.error.message);
        setHistoryRows((historyRes.data ?? []) as IndirectCostRow[]);

        const auditRes = await supabase
          .from("project_indirect_costs_audit")
          .select("id,indirect_cost_id,project_id,action,reason,actor_user_id,actor_role,created_at")
          .in("project_id", scopedProjectIds)
          .order("created_at", { ascending: false })
          .limit(100);

        if (auditRes.error) {
          const text = auditRes.error.message.toLowerCase();
          const missing =
            text.includes("does not exist") ||
            text.includes("relation") ||
            text.includes("schema cache");
          if (missing) {
            setAuditRows([]);
            setMsg(
              "Auditoria de exclusoes indisponivel. Rode supabase/sql/2026-02-17_create_project_indirect_costs_audit.sql."
            );
          } else {
            throw new Error(auditRes.error.message);
          }
        } else {
          const rows = (auditRes.data ?? []) as IndirectCostAuditRow[];
          setAuditRows(rows);

          const actorIds = Array.from(new Set(rows.map((a) => a.actor_user_id).filter(Boolean)));
          if (actorIds.length) {
            const actorRes = await supabase.from("profiles").select("id,full_name,email").in("id", actorIds);
            if (!actorRes.error) {
              const map: Record<string, string> = {};
              for (const p of actorRes.data ?? []) {
                const id = String((p as { id?: string }).id ?? "");
                if (!id) continue;
                const fullName = String((p as { full_name?: string | null }).full_name ?? "").trim();
                const email = String((p as { email?: string | null }).email ?? "").trim();
                map[id] = fullName || email || id.slice(0, 8);
              }
              setActorNameById(map);
            } else {
              setActorNameById({});
            }
          } else {
            setActorNameById({});
          }
        }
      } else {
        setHistoryRows([]);
        setAuditRows([]);
        setActorNameById({});
      }
    } catch (e: unknown) {
      setProjects([]);
      setCollabs([]);
      setHistoryRows([]);
      setAuditRows([]);
      setActorNameById({});
      setMsg(e instanceof Error ? e.message : "Erro ao carregar custos indiretos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active || !role) return;
    void load();
  }, [active, role]);

  useEffect(() => {
    if (sourceMode !== "collaborator") return;
    if (!selectedCollaborator) return;
    if (costType === "percentage_payroll") return;
    if (amountNum > 0) return;
    const salary = Number(selectedCollaborator.salario) || 0;
    if (salary > 0) setAmount(String(salary));
  }, [sourceMode, selectedCollaborator, amountNum, costType]);

  useEffect(() => {
    if (!openHistoryActionId) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-history-actions-root='true']")) return;
      setOpenHistoryActionId("");
      setHistoryActionAnchor(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openHistoryActionId]);

  function resetForm() {
    setEditingHistoryId("");
    setEditingHistorySource("");
    setOpenHistoryActionId("");
    setHistoryActionAnchor(null);
    setSourceMode("manual");
    setSplitMode("equal");
    setCostCategory("adm");
    setCostType("monthly");
    setAmount("");
    setNotes("");
    setStartDate("");
    setEndDate("");
    setSelectedCollaboratorId("");
    setSelectedSector("");
  }

  function beginEditHistoryRow(row: IndirectCostRow) {
    setOpenHistoryActionId("");
    setHistoryActionAnchor(null);
    const source = parseNoteTag(row.notes, "Fonte");
    const split = parseNoteTag(row.notes, "Rateio");
    const noteText = parseNoteTag(row.notes, "Obs");
    const collabName = source.startsWith("colaborador:") ? source.slice("colaborador:".length).trim() : "";
    const sectorName = source.startsWith("setor:") ? source.slice("setor:".length).trim() : "";
    const matchedCollab = collabName
      ? collabs.find((c) => String(c.nome ?? "").trim().toLowerCase() === collabName.toLowerCase())
      : undefined;

    setEditingHistoryId(row.id);
    setEditingHistorySource(source === "-" ? "manual" : source);
    setSourceMode(source.startsWith("setor:") ? "sector" : matchedCollab ? "collaborator" : "manual");
    setSplitMode(split === "orcamento" ? "budget" : "equal");
    setCostCategory(row.cost_category);
    setCostType(row.cost_type);
    setAmount(String(Number(row.amount) || 0));
    setNotes(noteText === "-" ? "" : noteText);
    setStartDate(row.start_date ?? "");
    setEndDate(row.end_date ?? "");
    setSelectedCollaboratorId(matchedCollab?.id ?? "");
    setSelectedSector(sectorName);
    setMsg("");
  }

  async function saveIndirectCosts() {
    if (!isAllowed) {
      setMsg("Sem permissao para cadastrar custos indiretos.");
      return;
    }
    if (!editingHistoryId && !activeProjects.length) {
      setMsg("Nao existem projetos ativos para rateio.");
      return;
    }
    if (amountNum <= 0) {
      setMsg("Informe um valor maior que zero.");
      return;
    }
    if ((costType === "monthly" || costType === "percentage_payroll") && (!startDate || !endDate)) {
      setMsg("Custos recorrentes exigem inicio e fim de vigencia.");
      return;
    }
    if (!editingHistoryId && costType === "percentage_payroll" && amountNum > 100) {
      setMsg("Para % sobre salario, informe um percentual entre 0 e 100.");
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setMsg("A data final nao pode ser menor que a data inicial.");
      return;
    }

    if (sourceMode === "collaborator" && !selectedCollaboratorId) {
      setMsg("Selecione um colaborador.");
      return;
    }
    if (sourceMode === "sector" && !selectedSector.trim()) {
      setMsg("Selecione um setor.");
      return;
    }
    if (costType === "percentage_payroll" && sourceMode !== "collaborator") {
      setMsg("Para percentual, use origem por colaborador.");
      return;
    }

    const baseSource =
      editingHistoryId && editingHistorySource
        ? editingHistorySource
        :
      sourceMode === "manual"
        ? "manual"
        : sourceMode === "collaborator"
        ? `colaborador:${selectedCollaborator?.nome ?? selectedCollaboratorId}`
        : `setor:${selectedSector}`;

    const rateioLabel =
      costType === "percentage_payroll" && preview.filter((p) => p.value > 0).length <= 1
        ? "integral (projeto unico)"
        : splitMode === "equal"
          ? "igual"
          : "orcamento";

    const sharedNotes = [
      `Fonte=${baseSource}`,
      `Rateio=${rateioLabel}`,
      notes.trim() ? `Obs=${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    if (editingHistoryId) {
      const currentRow = historyRows.find((r) => r.id === editingHistoryId);
      if (!currentRow) {
        setMsg("Lancamento nao encontrado para edicao.");
        return;
      }

      setSaving(true);
      setMsg("");
      try {
        const nextRow = {
          ...currentRow,
          cost_category: costCategory,
          cost_type: costType,
          amount: amountNum,
          notes: sharedNotes,
          start_date: startDate || null,
          end_date: endDate || null,
        };
        const { error } = await supabase
          .from("project_indirect_costs")
          .update({
            cost_category: costCategory,
            cost_type: costType,
            amount: amountNum,
            notes: sharedNotes,
            start_date: startDate || null,
            end_date: endDate || null,
          })
          .eq("id", editingHistoryId);
        if (error) throw new Error(error.message);
        const auditInsert = await supabase.from("project_indirect_costs_audit").insert({
          indirect_cost_id: currentRow.id,
          project_id: currentRow.project_id,
          action: "update",
          reason: "Edicao de lancamento",
          old_row: currentRow,
          new_row: nextRow,
          actor_user_id: meId,
          actor_role: role ?? null,
        });
        if (auditInsert.error) throw new Error(auditInsert.error.message);
        setMsg("Lancamento indireto atualizado.");
        resetForm();
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao atualizar custo indireto.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const rows = preview
      .filter((p) => p.value > 0)
      .map((p) => ({
        project_id: p.project_id,
        cost_category: costCategory,
        cost_type: costType,
        amount: p.value,
        notes: sharedNotes,
        start_date: startDate || null,
        end_date: endDate || null,
        created_by: meId || null,
      }));

    if (!rows.length) {
      setMsg("Nao foi possivel gerar o rateio.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("project_indirect_costs").insert(rows);
      if (error) throw new Error(error.message);
      setMsg(
        costType === "percentage_payroll" && rows.length === 1
          ? "Custo indireto percentual cadastrado de forma integral no unico projeto ativo do rateio."
          : `Custos indiretos cadastrados em ${rows.length} projetos ativos.`
      );
      resetForm();
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar custos indiretos.");
    } finally {
      setSaving(false);
    }
  }

  function exportHistoryCsv() {
    const lines: string[] = [];
    lines.push(
      [
        "criado_em",
        "projeto",
        "categoria",
        "tipo",
        "valor",
        "valor_efetivo",
        "origem",
        "rateio",
        "inicio_vigencia",
        "fim_vigencia",
        "observacao",
      ].join(",")
    );

    for (const r of filteredHistory) {
      lines.push(
        [
          new Date(r.created_at).toLocaleString("pt-BR"),
          projectNameById[r.project_id] ?? r.project_id,
          categoryLabel(r.cost_category),
          typeLabel(r.cost_type),
          indirectAmountLabel(r),
          effectiveAmountDetail(r).label,
          parseNoteTag(r.notes, "Fonte"),
          parseNoteTag(r.notes, "Rateio"),
          r.start_date ?? "",
          r.end_date ?? "",
          r.notes ?? "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadTextFile(`custos_indiretos_historico_${stamp}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportHistoryPdf() {
    const rowsHtml = filteredHistory
      .map((r) => {
        return `
          <tr>
            <td>${htmlEscape(new Date(r.created_at).toLocaleString("pt-BR"))}</td>
            <td>${htmlEscape(projectNameById[r.project_id] ?? r.project_id)}</td>
            <td>${htmlEscape(categoryLabel(r.cost_category))}</td>
            <td>${htmlEscape(typeLabel(r.cost_type))}</td>
            <td style="text-align:right">${htmlEscape(indirectAmountLabel(r))}</td>
            <td style="text-align:right">${htmlEscape(effectiveAmountDetail(r).label)}</td>
            <td>${htmlEscape(parseNoteTag(r.notes, "Fonte"))}</td>
            <td>${htmlEscape(parseNoteTag(r.notes, "Rateio"))}</td>
            <td>${htmlEscape(`${r.start_date ?? "-"} ate ${r.end_date ?? "-"}`)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Custos indiretos - Historico</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
            .header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
            .header img{height:40px;max-width:180px;object-fit:contain}
            h1{margin:0 0 8px 0;font-size:20px}
            p{margin:0 0 12px 0;font-size:12px;color:#475569}
            .kpi{font-size:12px;margin:0 0 16px 0}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:12px;text-align:left}
            th{background:#f8fafc}
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${htmlEscape(companyLogoUrl)}" alt="Logo ${htmlEscape(companyName)}" />
            <div>
              <div style="font-size:13px;font-weight:700">${htmlEscape(companyName)}</div>
              <div style="font-size:11px;color:#64748b">Relatorio financeiro</div>
            </div>
          </div>
          <h1>Financeiro - Historico de custos indiretos</h1>
          <p>
            Filtros: de ${htmlEscape(historyFrom || "-")} ate ${htmlEscape(historyTo || "-")}
            | projeto ${htmlEscape(historyProjectId === "all" ? "Todos" : (projectNameById[historyProjectId] ?? historyProjectId))}
            | categoria ${htmlEscape(historyCategory === "all" ? "Todas" : categoryLabel(historyCategory))}
            | tipo ${htmlEscape(historyType === "all" ? "Todos" : typeLabel(historyType))}
          </p>
          <p class="kpi">Registros: ${htmlEscape(filteredHistory.length)} | Total: ${htmlEscape(historyTotalLabel)}</p>
          <table>
            <thead>
              <tr>
                <th>Criado em</th>
                <th>Projeto</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Valor efetivo</th>
                <th>Origem</th>
                <th>Rateio</th>
                <th>Vigencia</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="9">Nenhum lancamento encontrado.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function deleteHistoryRow(rowId: string) {
    if (!canDeleteHistory) {
      setMsg("Apenas admin pode excluir lancamentos.");
      return;
    }
    const target = historyRows.find((x) => x.id === rowId) ?? null;
    if (!target) {
      setMsg("Lancamento nao encontrado.");
      return;
    }

    const reasonInput = window.prompt("Informe o motivo da exclusao deste lancamento:");
    if (reasonInput === null) return;
    const reason = reasonInput.trim();
    if (!reason) {
      setMsg("Motivo da exclusao e obrigatorio.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const auditInsert = await supabase.from("project_indirect_costs_audit").insert({
        indirect_cost_id: target.id,
        project_id: target.project_id,
        action: "delete",
        reason,
        old_row: target,
        actor_user_id: meId,
        actor_role: role ?? null,
      });
      if (auditInsert.error) throw new Error(auditInsert.error.message);

      const { error } = await supabase.from("project_indirect_costs").delete().eq("id", rowId);
      if (error) throw new Error(error.message);
      setMsg("Lancamento excluido com sucesso (auditoria registrada).");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir lancamento.");
    } finally {
      setSaving(false);
    }
  }

  function exportAuditCsv() {
    const lines: string[] = [];
    lines.push(["data_hora", "projeto", "acao", "motivo", "ator", "ator_role", "ator_user_id"].join(","));
    for (const a of filteredAuditRows) {
      lines.push(
        [
          new Date(a.created_at).toLocaleString("pt-BR"),
          projectNameById[a.project_id] ?? a.project_id,
          a.action,
          a.reason,
          actorNameById[a.actor_user_id] ?? "",
          a.actor_role ?? "",
          a.actor_user_id,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadTextFile(`custos_indiretos_auditoria_${stamp}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportAuditPdf() {
    const rowsHtml = filteredAuditRows
      .map((a) => {
        const actorLabel = `${actorNameById[a.actor_user_id] ?? a.actor_user_id.slice(0, 8)} | ${a.actor_role ?? "-"} (${a.actor_user_id.slice(0, 8)})`;
        return `
          <tr>
            <td>${htmlEscape(new Date(a.created_at).toLocaleString("pt-BR"))}</td>
            <td>${htmlEscape(projectNameById[a.project_id] ?? a.project_id)}</td>
            <td>${htmlEscape(a.action)}</td>
            <td>${htmlEscape(a.reason)}</td>
            <td>${htmlEscape(actorLabel)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Auditoria de custos indiretos</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
            .header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
            .header img{height:40px;max-width:180px;object-fit:contain}
            h1{margin:0 0 8px 0;font-size:20px}
            p{margin:0 0 12px 0;font-size:12px;color:#475569}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:12px;text-align:left}
            th{background:#f8fafc}
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${htmlEscape(companyLogoUrl)}" alt="Logo ${htmlEscape(companyName)}" />
            <div>
              <div style="font-size:13px;font-weight:700">${htmlEscape(companyName)}</div>
              <div style="font-size:11px;color:#64748b">Relatorio financeiro</div>
            </div>
          </div>
          <h1>Financeiro - Auditoria de exclusoes</h1>
          <p>
            Filtros: de ${htmlEscape(auditFrom || "-")} ate ${htmlEscape(auditTo || "-")}
            | ator ${htmlEscape(auditActorId === "all" ? "Todos" : (actorNameById[auditActorId] ?? auditActorId))}
            | busca "${htmlEscape(auditQ || "-")}"
          </p>
          <p>Registros: ${htmlEscape(filteredAuditRows.length)}</p>
          <table>
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Projeto</th>
                <th>Acao</th>
                <th>Motivo</th>
                <th>Ator</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5">Nenhum registro encontrado.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  if (roleLoading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando...</div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          Acesso restrito a Financeiro e Admin.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <section ref={historySectionRef} className="relative rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Custos indiretos</h1>
            <p className="mt-1 text-sm text-slate-600">
              Cadastro separado para rateio por projetos ativos, com fonte manual, colaborador ou setor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Projetos ativos</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{activeProjects.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Base de colaborador</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{collabs.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Valor informado</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {costType === "percentage_payroll" ? fmtPctValue(amountNum) : fmtMoney(amountNum)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Rateio</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {costType === "percentage_payroll" && preview.filter((p) => p.value > 0).length <= 1
                ? "Integral (projeto unico)"
                : splitMode === "equal"
                  ? "Igual"
                  : "Por orcamento"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {editingHistoryId ? "Editar lancamento indireto" : "Novo custo indireto (rateio automatico)"}
          </h2>
          {editingHistoryId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar edicao
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Origem
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
              value={sourceMode}
              onChange={(e) => setSourceMode(e.target.value as SourceMode)}
            >
              <option value="manual">Digitacao manual</option>
              <option value="collaborator">Por colaborador</option>
              <option value="sector">Por setor</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Categoria
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
              value={costCategory}
              onChange={(e) => setCostCategory(e.target.value as CostCategory)}
            >
              <option value="rh">RH</option>
              <option value="financeiro">Financeiro</option>
              <option value="adm">Administrativo</option>
              <option value="ti">TI</option>
              <option value="juridico">Juridico</option>
              <option value="utilidades">Utilidades (luz, agua, internet)</option>
              <option value="tributos">Tributos (IPTU, impostos, taxas)</option>
              <option value="infraestrutura">Infraestrutura (aluguel, condominio, manutencao)</option>
              <option value="outros">Outros</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Tipo
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
              value={costType}
              onChange={(e) => setCostType(e.target.value as CostType)}
            >
              <option value="monthly">Mensal</option>
              <option value="one_time">Pontual</option>
              <option value="percentage_payroll">% sobre salario do colaborador</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Rateio
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
              value={splitMode}
              onChange={(e) => setSplitMode(e.target.value as SplitMode)}
            >
              <option value="equal">Igual entre projetos ativos</option>
              <option value="budget">Proporcional ao orcamento</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {sourceMode === "collaborator" ? (
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Colaborador
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
                value={selectedCollaboratorId}
                onChange={(e) => setSelectedCollaboratorId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {collabs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.nome ?? "Sem nome").trim()} - {(c.setor ?? c.departamento ?? "Sem setor").trim()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {sourceMode === "sector" ? (
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Setor
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                <option value="">Selecione...</option>
                {sectorOptions.map((s) => (
                  <option key={s.key} value={s.label}>
                    {s.label} ({s.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            {costType === "percentage_payroll" ? "Percentual sobre o salario do colaborador (%)" : "Valor total (R$)"}
            <input
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
              placeholder={costType === "percentage_payroll" ? "0 a 100" : "0,00"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Inicio {(costType === "monthly" || costType === "percentage_payroll") ? "(obrigatorio)" : "(opcional)"}
            <input
              type="date"
              className={`h-11 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 ${
                (costType === "monthly" || costType === "percentage_payroll") && !startDate
                  ? "border-amber-300"
                  : "border-slate-200"
              }`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            Fim {(costType === "monthly" || costType === "percentage_payroll") ? "(obrigatorio)" : "(opcional)"}
            <input
              type="date"
              className={`h-11 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 ${
                (costType === "monthly" || costType === "percentage_payroll") && !endDate
                  ? "border-amber-300"
                  : "border-slate-200"
              }`}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {costType === "one_time" ? (
            <span>
              Sem vigencia informada, o custo pontual vale apenas no mes do lancamento.
            </span>
          ) : costType === "monthly" ? (
            <span>
              Custo mensal exige inicio e fim de vigencia. Sem esse intervalo, o rateio recorrente nao sera salvo.
            </span>
          ) : (
            <span>
              % sobre salario exige origem por colaborador, inicio e fim de vigencia, e aceita somente valores entre 0 e 100. Valores acima de 100 sao tratados como cadastro legado em valor absoluto.
            </span>
          )}
        </div>

        {sourceMode === "collaborator" && selectedCollaborator ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            Colaborador: <b>{selectedCollaborator.nome ?? "-"}</b> | Setor:{" "}
            <b>{(selectedCollaborator.setor ?? selectedCollaborator.departamento ?? "-").trim()}</b> | Salario base:{" "}
            <b>{fmtMoney(Number(selectedCollaborator.salario) || 0)}</b>
          </div>
        ) : null}

        {sourceMode === "sector" && selectedSector ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            Setor: <b>{selectedSector}</b> | Colaboradores ativos: <b>{selectedSectorStats.count}</b> | Folha do setor:{" "}
            <b>{fmtMoney(selectedSectorStats.payroll)}</b>
          </div>
        ) : null}

        <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
          Observacao
          <textarea
            className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
            placeholder="Detalhes para auditoria do custo indireto..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Categoria: <b>{categoryLabel(costCategory)}</b> | Tipo: <b>{typeLabel(costType)}</b> | Projetos ativos no rateio:{" "}
            <b>{activeProjects.length}</b>
          </p>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void saveIndirectCosts()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save size={16} /> {editingHistoryId ? "Salvar alteracoes" : "Salvar rateio"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Previa do rateio</h2>
        <p className="mt-1 text-sm text-slate-600">Distribuicao do valor informado pelos projetos ativos.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[780px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Projeto</th>
                <th className="p-3 text-right">Peso</th>
                <th className="p-3 text-right">{costType === "percentage_payroll" ? "Percentual rateado" : "Valor rateado"}</th>
              </tr>
            </thead>
            <tbody>
              {preview.length ? (
                preview.map((row, idx) => (
                  <tr key={row.project_id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{row.project_name}</div>
                    </td>
                    <td className="p-3 text-right text-slate-600">{projectWeights[idx] ?? 0}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">
                      {costType === "percentage_payroll" ? fmtPctValue(row.value) : fmtMoney(row.value)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={3}>
                    Sem projetos ativos para exibir.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td className="p-3 font-semibold text-slate-700">Total</td>
                <td className="p-3" />
                <td className="p-3 text-right font-semibold text-slate-900">{fmtMoney(preview.reduce((acc, x) => acc + x.value, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Historico de lancamentos</h2>
            <p className="mt-1 text-sm text-slate-600">Acompanhe custos indiretos registrados e aplicados nos projetos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAuditModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              title="Abrir auditoria de exclusoes em tela suspensa"
            >
              Ver auditoria
            </button>
            <button
              type="button"
              onClick={exportHistoryCsv}
              disabled={!filteredHistory.length}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              title="Exportar CSV com os filtros atuais"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={exportHistoryPdf}
              disabled={!filteredHistory.length}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              title="Abrir versao para salvar em PDF"
            >
              <Printer size={16} /> Exportar PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            De
            <input
              type="date"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Ate
            <input
              type="date"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={historyProjectId}
              onChange={(e) => setHistoryProjectId(e.target.value)}
            >
              <option value="all">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Categoria
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={historyCategory}
              onChange={(e) => setHistoryCategory(e.target.value as "all" | CostCategory)}
            >
              <option value="all">Todas</option>
              <option value="rh">RH</option>
              <option value="financeiro">Financeiro</option>
              <option value="adm">Administrativo</option>
              <option value="ti">TI</option>
              <option value="juridico">Juridico</option>
              <option value="utilidades">Utilidades</option>
              <option value="tributos">Tributos</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="outros">Outros</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={historyType}
              onChange={(e) => setHistoryType(e.target.value as "all" | CostType)}
            >
              <option value="all">Todos</option>
              <option value="monthly">Mensal</option>
              <option value="one_time">Pontual</option>
              <option value="percentage_payroll">% salario</option>
            </select>
          </label>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          Registros: <b>{filteredHistory.length}</b> | Total filtrado: <b>{historyTotalLabel}</b>
        </div>

        <div ref={historyTableAreaRef} className="relative mt-4">
          <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Criado em</th>
                <th className="p-3">Projeto</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Valor efetivo</th>
                {isAllowed ? <th className="p-3 text-right">Acao</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length ? (
                filteredHistory.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 text-slate-600">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{projectNameById[r.project_id] ?? r.project_id}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {categoryLabel(r.cost_category)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {typeLabel(r.cost_type)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-900">{indirectAmountLabel(r)}</td>
                    <td className="p-3 text-right">
                      <div className="font-semibold text-slate-900">{effectiveAmountDetail(r).label}</div>
                      {effectiveAmountDetail(r).hint ? (
                        <div className="mt-0.5 text-[11px] text-slate-500">{effectiveAmountDetail(r).hint}</div>
                      ) : null}
                    </td>
                    {isAllowed ? (
                      <td className="p-3 text-right">
                        <div className="relative inline-flex justify-end" data-history-actions-root="true">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={(event) => {
                              if (openHistoryActionId === r.id) {
                                setOpenHistoryActionId("");
                                setHistoryActionAnchor(null);
                                return;
                              }
                              const sectionEl = historyTableAreaRef.current;
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
                                setHistoryActionAnchor({
                                  top,
                                  left,
                                  connectorTop,
                                  connectorLeft,
                                  connectorHeight: 8,
                                });
                              } else {
                                setHistoryActionAnchor(null);
                              }
                              setOpenHistoryActionId(r.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <MoreHorizontal size={14} /> Acoes
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={isAllowed ? 7 : 6}>
                    Nenhum lancamento encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {openHistoryActionRow && historyActionAnchor ? (
            <>
              <div
                className="pointer-events-none absolute z-40 w-1 rounded-full bg-indigo-300"
                style={{
                  left: historyActionAnchor.connectorLeft,
                  top: historyActionAnchor.connectorTop,
                  height: historyActionAnchor.connectorHeight,
                }}
                data-history-actions-root="true"
              />
              <div
                className="pointer-events-none absolute z-40 h-4 w-4 rotate-45 rounded-[2px] border-2 border-indigo-200 bg-white shadow-sm"
                style={{
                  left: historyActionAnchor.connectorLeft - 6,
                  top: historyActionAnchor.connectorTop + 2,
                }}
                data-history-actions-root="true"
              />
              <div
                className="absolute z-50 w-[208px] max-w-[calc(100%-24px)] max-h-[220px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                style={{ left: historyActionAnchor.left, top: historyActionAnchor.top }}
                data-history-actions-root="true"
              >
                <div className="mb-2 border-b border-slate-100 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Acoes do lancamento
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => beginEditHistoryRow(openHistoryActionRow)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailHistoryRow(openHistoryActionRow);
                    setOpenHistoryActionId("");
                    setHistoryActionAnchor(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ver mais
                </button>
                {canDeleteHistory ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setOpenHistoryActionId("");
                      setHistoryActionAnchor(null);
                      void deleteHistoryRow(openHistoryActionRow.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    Excluir
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

      </section>

      {detailHistoryRow ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setDetailHistoryRow(null)}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDetailHistoryRow(null)}
              className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            <div className="pr-24">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Base do lancamento indireto</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {projectNameById[detailHistoryRow.project_id] ?? detailHistoryRow.project_id}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Criado em</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(detailHistoryRow.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{indirectAmountLabel(detailHistoryRow)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor efetivo</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{effectiveAmountDetail(detailHistoryRow).label}</p>
                {effectiveAmountDetail(detailHistoryRow).hint ? (
                  <p className="mt-1 text-xs text-slate-500">{effectiveAmountDetail(detailHistoryRow).hint}</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{parseNoteTag(detailHistoryRow.notes, "Fonte")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rateio</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{parseNoteTag(detailHistoryRow.notes, "Rateio")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vigencia</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {(detailHistoryRow.start_date ?? "-") + " ate " + (detailHistoryRow.end_date ?? "-")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observacao</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">
                  {parseNoteTag(detailHistoryRow.notes, "Obs")}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {auditModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onClick={() => setAuditModalOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex flex-wrap items-start justify-between gap-3 pr-24">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Base da auditoria de custos indiretos</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Exclusoes ficam registradas abaixo. Edicoes sao visualizadas pelo estado atual do lancamento em
                  {" "}Ver mais{" "}e pelo formulario de edicao.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="absolute right-0 top-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportAuditCsv}
                  disabled={!filteredAuditRows.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Download size={16} /> Exportar CSV auditoria
                </button>
                <button
                  type="button"
                  onClick={exportAuditPdf}
                  disabled={!filteredAuditRows.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Printer size={16} /> Exportar PDF auditoria
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                De
                <input
                  type="date"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={auditFrom}
                  onChange={(e) => setAuditFrom(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Ate
                <input
                  type="date"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={auditTo}
                  onChange={(e) => setAuditTo(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Ator
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={auditActorId}
                  onChange={(e) => setAuditActorId(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {actorOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Buscar
                <input
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={auditQ}
                  onChange={(e) => setAuditQ(e.target.value)}
                  placeholder="Motivo, ator, projeto..."
                />
              </label>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              Registros de auditoria: <b>{filteredAuditRows.length}</b>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-3">Data/hora</th>
                    <th className="p-3">Projeto</th>
                    <th className="p-3">Acao</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Ator</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditRows.length ? (
                    filteredAuditRows.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-3 text-slate-600">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                        <td className="p-3 font-medium text-slate-900">{projectNameById[a.project_id] ?? a.project_id}</td>
                        <td className="p-3 text-slate-700">{a.action}</td>
                        <td className="p-3 text-slate-700">{a.reason}</td>
                        <td className="p-3 text-slate-600">
                          {(actorNameById[a.actor_user_id] ?? a.actor_user_id.slice(0, 8))} | {a.actor_role ?? "-"} (
                          {a.actor_user_id.slice(0, 8)})
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={5}>
                        Nenhuma exclusao registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
