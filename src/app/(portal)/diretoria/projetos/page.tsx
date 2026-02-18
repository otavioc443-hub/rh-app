"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProjectStatus = "active" | "paused" | "done";
type ProjectStage = "ofertas" | "desenvolvimento" | "as_built" | "pausado" | "cancelado";
type ProjectType =
  | "hv"
  | "rmt"
  | "basico"
  | "estrutural"
  | "civil"
  | "eletromecanico"
  | "eletrico"
  | "hidraulico"
  | "outro";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_stage: ProjectStage | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  client_id: string | null;
  project_type: ProjectType | null;
  project_scopes: string[] | null;
  created_at: string;
};

type ProjectClientRow = {
  id: string;
  name: string;
};

type MemberRow = {
  id: string;
  project_id: string;
  user_id: string;
};

type DeliverableRow = {
  id: string;
  project_id: string;
  title: string | null;
  due_date: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "sent" | "approved" | "approved_with_comments";
  created_at: string | null;
};

type ExtraPaymentRow = {
  id: string;
  project_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  reference_month: string | null;
  created_at: string | null;
};

type ProjectTimelineRow = {
  id: string;
  project_id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
};

type DeliverableTimelineRow = {
  id: string;
  deliverable_id: string;
  project_id: string;
  event_type: string;
  status_from: string | null;
  status_to: string | null;
  comment: string | null;
  created_at: string;
};

type DeletedDeliverableRow = {
  id: string;
  project_id: string | null;
  deliverable_ref_id: string;
  title: string | null;
  status: string | null;
  deleted_at: string;
};

type ProjectSummary = {
  members: number;
  deliverables: number;
  approved: number;
  progressPct: number;
  extrasPending: number;
  extrasApproved: number;
  extrasPaid: number;
};

type IndirectCostRow = {
  id: string;
  project_id: string;
  amount: number;
  created_at: string | null;
};

type ProjectAllocationRow = {
  project_id: string;
  user_id: string;
  allocation_pct: number | null;
};

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function projectTypeLabel(value: ProjectType | null | undefined) {
  if (value === "hv") return "HV";
  if (value === "rmt") return "RMT";
  if (value === "basico") return "Basico";
  if (value === "estrutural") return "Estrutural";
  if (value === "civil") return "Civil";
  if (value === "eletromecanico") return "Eletromecanico";
  if (value === "eletrico") return "Eletrico";
  if (value === "hidraulico") return "Hidraulico";
  if (value === "outro") return "Outro";
  return "-";
}

function statusLabel(value: ProjectStatus) {
  if (value === "paused") return "Pausado";
  if (value === "active") return "Ativo";
  return "Concluido";
}

function deliverableEventLabel(eventType: string) {
  if (eventType === "returned_for_rework") return "Retornou para ajuste";
  if (eventType === "status_changed") return "Mudanca de status";
  if (eventType === "created") return "Criado";
  if (eventType === "contribution_added") return "Contribuicao registrada";
  if (eventType === "assignee_added") return "Responsavel adicionado";
  if (eventType === "assignee_removed") return "Responsavel removido";
  if (eventType === "document_uploaded") return "Documento enviado";
  if (eventType === "document_linked") return "Link de documento atualizado";
  return eventType;
}

function deliverableStatusLabel(value?: string | null) {
  if (value === "pending") return "Pendente";
  if (value === "in_progress") return "Em andamento";
  if (value === "sent") return "Enviado";
  if (value === "approved") return "Aprovado";
  if (value === "approved_with_comments") return "Aprovado com comentarios";
  if (value === "blocked") return "Bloqueado";
  if (value === "cancelled") return "Cancelado";
  return value ?? "-";
}

function stageFromStatus(status: ProjectStatus): ProjectStage {
  if (status === "paused") return "ofertas";
  if (status === "done") return "as_built";
  return "desenvolvimento";
}

function statusFromStage(stage: ProjectStage): ProjectStatus {
  if (stage === "ofertas" || stage === "pausado") return "paused";
  if (stage === "cancelado") return "done";
  if (stage === "as_built") return "done";
  return "active";
}

function stageLabel(stage: ProjectStage) {
  if (stage === "ofertas") return "Ofertas";
  if (stage === "desenvolvimento") return "Desenvolvimento";
  if (stage === "pausado") return "Pausado";
  if (stage === "cancelado") return "Cancelado";
  return "As Built";
}

function stageClass(stage: ProjectStage) {
  if (stage === "ofertas") return "bg-amber-50 text-amber-700";
  if (stage === "desenvolvimento") return "bg-emerald-50 text-emerald-700";
  if (stage === "pausado") return "bg-orange-50 text-orange-700";
  if (stage === "cancelado") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function riskClass(value: "alto" | "medio" | "baixo") {
  if (value === "alto") return "bg-rose-50 text-rose-700";
  if (value === "medio") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(n: number) {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

function riskLevel(project: ProjectRow, summary: ProjectSummary) {
  const now = new Date();
  const end = parseDateOnly(project.end_date);
  const budget = Number(project.budget_total) || 0;
  const extras = summary.extrasPending + summary.extrasApproved + summary.extrasPaid;
  const ratio = budget > 0 ? extras / budget : 0;
  const late = project.status !== "done" && !!end && end < now && summary.progressPct < 100;

  if (late || ratio >= 0.4 || (project.status === "active" && summary.progressPct < 40)) return "alto";
  if (ratio >= 0.2 || (project.status === "active" && summary.progressPct < 70)) return "medio";
  return "baixo";
}

export default function DiretoriaProjetosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assigneeFilter = useMemo(() => {
    const raw = searchParams.get("assignee");
    return raw ? raw.trim() : "";
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ProjectClientRow[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, string>>({});
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [summaryByProjectId, setSummaryByProjectId] = useState<Record<string, ProjectSummary>>({});
  const [deliverableRows, setDeliverableRows] = useState<DeliverableRow[]>([]);
  const [extrasRows, setExtrasRows] = useState<ExtraPaymentRow[]>([]);
  const [indirectCostRows, setIndirectCostRows] = useState<IndirectCostRow[]>([]);
  const [allocationRows, setAllocationRows] = useState<ProjectAllocationRow[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [timelineRows, setTimelineRows] = useState<ProjectTimelineRow[]>([]);
  const [deliverableTimelineRows, setDeliverableTimelineRows] = useState<DeliverableTimelineRow[]>([]);
  const [deletedDeliverableRows, setDeletedDeliverableRows] = useState<DeletedDeliverableRow[]>([]);
  const [showProjectInfo, setShowProjectInfo] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [stageFilter, setStageFilter] = useState<"all" | ProjectStage>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ProjectType>("all");
  const [clientFilter, setClientFilter] = useState<"all" | string>("all");
  const [projectFilter, setProjectFilter] = useState<"all" | string>("all");
  const [rankingWindow, setRankingWindow] = useState<"30" | "90" | "365" | "all">("90");
  const [stageDraftByProject, setStageDraftByProject] = useState<Record<string, ProjectStage>>({});
  const [stageNoteByProject, setStageNoteByProject] = useState<Record<string, string>>({});
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);

  function clearAssigneeFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("assignee");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      let projectRows: ProjectRow[] = [];
      const projectResWithStage = await supabase
        .from("projects")
        .select("id,name,description,status,project_stage,start_date,end_date,budget_total,client_id,project_type,project_scopes,created_at")
        .order("created_at", { ascending: false });

      if (projectResWithStage.error) {
        const fallbackRes = await supabase
          .from("projects")
          .select("id,name,description,status,start_date,end_date,budget_total,client_id,project_type,project_scopes,created_at")
          .order("created_at", { ascending: false });
        if (fallbackRes.error) throw fallbackRes.error;
        projectRows = ((fallbackRes.data ?? []) as Array<Omit<ProjectRow, "project_stage">>).map((row) => ({
          ...row,
          project_stage: null,
        }));
      } else {
        projectRows = (projectResWithStage.data ?? []) as ProjectRow[];
      }

      setProjects(projectRows);
      const nextDraft: Record<string, ProjectStage> = {};
      for (const row of projectRows) nextDraft[row.id] = row.project_stage ?? stageFromStatus(row.status);
      setStageDraftByProject(nextDraft);
      setStageNoteByProject({});

      const projectIds = projectRows.map((p) => p.id);

      const [clientsRes, memberRes, deliverableRes, extrasRes, indirectRes, allocationRes] = await Promise.all([
        supabase.from("project_clients").select("id,name").eq("active", true).order("name", { ascending: true }),
        projectIds.length
          ? supabase.from("project_members").select("id,project_id,user_id").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase.from("project_deliverables").select("id,project_id,title,due_date,assigned_to,status,created_at").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase.from("project_extra_payments").select("id,project_id,amount,status,reference_month,created_at").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase.from("project_indirect_costs").select("id,project_id,amount,created_at").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase.from("project_member_allocations").select("project_id,user_id,allocation_pct").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (memberRes.error) throw memberRes.error;
      if (deliverableRes.error) throw deliverableRes.error;
      if (extrasRes.error) throw extrasRes.error;
      if (indirectRes.error) throw indirectRes.error;
      if (allocationRes.error) throw allocationRes.error;

      const clientsRows = (clientsRes.data ?? []) as ProjectClientRow[];
      setClients(clientsRows);
      const clientMap: Record<string, string> = {};
      for (const c of clientsRows) clientMap[c.id] = c.name;
      setClientsById(clientMap);

      const members = (memberRes.data ?? []) as MemberRow[];
      setMemberRows(members);
      const deliverables = (deliverableRes.data ?? []) as DeliverableRow[];
      setDeliverableRows(deliverables);
      const extras = (extrasRes.data ?? []) as ExtraPaymentRow[];
      setExtrasRows(extras);
      setIndirectCostRows((indirectRes.data ?? []) as IndirectCostRow[]);
      setAllocationRows((allocationRes.data ?? []) as ProjectAllocationRow[]);

      const userIds = Array.from(
        new Set(
          [...members.map((m) => m.user_id), ...deliverables.map((d) => d.assigned_to).filter(Boolean) as string[]].filter(Boolean)
        )
      );
      if (userIds.length) {
        const profileRes = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
        if (!profileRes.error) {
          const map: Record<string, string> = {};
          for (const p of (profileRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
            map[p.id] = (p.full_name ?? "").trim() || (p.email ?? "").trim() || `Colaborador ${p.id.slice(0, 8)}`;
          }
          setUserNameById(map);
        } else {
          setUserNameById({});
        }
      } else {
        setUserNameById({});
      }

      if (projectIds.length) {
        const [dTimelineRes, deletedRes] = await Promise.all([
          supabase
            .from("project_deliverable_timeline")
            .select("id,deliverable_id,project_id,event_type,status_from,status_to,comment,created_at")
            .in("project_id", projectIds)
            .order("created_at", { ascending: false })
            .limit(300),
          supabase
            .from("project_deliverable_deleted_items")
            .select("id,project_id,deliverable_ref_id,title,status,deleted_at")
            .eq("source_module", "projects")
            .in("project_id", projectIds)
            .order("deleted_at", { ascending: false })
            .limit(200),
        ]);
        if (!dTimelineRes.error) {
          setDeliverableTimelineRows((dTimelineRes.data ?? []) as DeliverableTimelineRow[]);
        } else {
          setDeliverableTimelineRows([]);
        }
        if (!deletedRes.error) {
          setDeletedDeliverableRows((deletedRes.data ?? []) as DeletedDeliverableRow[]);
        } else {
          setDeletedDeliverableRows([]);
        }
      } else {
        setDeliverableTimelineRows([]);
        setDeletedDeliverableRows([]);
      }

      if (projectIds.length) {
        const timelineRes = await supabase
          .from("project_update_timeline")
          .select("id,project_id,event_type,title,description,created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(120);
        if (timelineRes.error) {
          setTimelineRows([]);
        } else {
          setTimelineRows((timelineRes.data ?? []) as ProjectTimelineRow[]);
        }
      } else {
        setTimelineRows([]);
      }

      const nextSummary: Record<string, ProjectSummary> = {};
      for (const p of projectRows) {
        const pm = members.filter((m) => m.project_id === p.id);
        const pd = deliverables.filter((d) => d.project_id === p.id);
        const pe = extras.filter((e) => e.project_id === p.id);

        const deliverablesTotal = pd.length;
        const approved = pd.filter((d) => d.status === "approved" || d.status === "approved_with_comments").length;
        const progressPct = deliverablesTotal ? Math.round((approved / deliverablesTotal) * 100) : 0;
        const extrasPending = pe.filter((e) => e.status === "pending").reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const extrasApproved = pe.filter((e) => e.status === "approved").reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const extrasPaid = pe.filter((e) => e.status === "paid").reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

        nextSummary[p.id] = {
          members: pm.length,
          deliverables: deliverablesTotal,
          approved,
          progressPct,
          extrasPending,
          extrasApproved,
          extrasPaid,
        };
      }
      setSummaryByProjectId(nextSummary);
    } catch (e: unknown) {
      setProjects([]);
      setClients([]);
      setClientsById({});
      setMemberRows([]);
      setSummaryByProjectId({});
      setDeliverableRows([]);
      setExtrasRows([]);
      setIndirectCostRows([]);
      setAllocationRows([]);
      setUserNameById({});
      setTimelineRows([]);
      setDeliverableTimelineRows([]);
      setDeletedDeliverableRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar acompanhamento de projetos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const clientOptions = useMemo(() => {
    return clients.slice();
  }, [clients]);

  const selectedProjectForStage = useMemo(() => {
    if (projectFilter === "all") return null;
    return projects.find((p) => p.id === projectFilter) ?? null;
  }, [projects, projectFilter]);

  const selectedStageTimeline = useMemo(() => {
    if (!selectedProjectForStage) return [] as ProjectTimelineRow[];
    return timelineRows.filter((t) => t.project_id === selectedProjectForStage.id && t.event_type === "stage_update");
  }, [selectedProjectForStage, timelineRows]);

  const selectedOperationalTimeline = useMemo(() => {
    if (!selectedProjectForStage) return [] as Array<{ id: string; ts: string; title: string; description: string }>;
    const pid = selectedProjectForStage.id;

    const deliverableEvents = deliverableTimelineRows
      .filter((t) => t.project_id === pid)
      .map((t) => ({
        id: `doc-${t.id}`,
        ts: t.created_at,
        title: `${t.deliverable_id} (${deliverableEventLabel(t.event_type)})`,
        description: [
          t.status_from || t.status_to
            ? `Status: ${deliverableStatusLabel(t.status_from)} -> ${deliverableStatusLabel(t.status_to)}`
            : "",
          t.comment ?? "",
        ]
          .filter(Boolean)
          .join(" | "),
      }));

    const deletedEvents = deletedDeliverableRows
      .filter((d) => d.project_id === pid)
      .map((d) => ({
        id: `del-${d.id}`,
        ts: d.deleted_at,
        title: `Entregavel excluido: ${(d.title ?? "").trim() || d.deliverable_ref_id}`,
        description: `Status anterior: ${d.status ?? "-"}`,
      }));

    const nonStageProjectEvents = timelineRows
      .filter((t) => t.project_id === pid && t.event_type !== "stage_update")
      .map((t) => ({
        id: `proj-${t.id}`,
        ts: t.created_at,
        title: t.title,
        description: t.description ?? "Atualizacao administrativa.",
      }));

    return [...deliverableEvents, ...deletedEvents, ...nonStageProjectEvents].sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
  }, [selectedProjectForStage, deliverableTimelineRows, deletedDeliverableRows, timelineRows]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const stage = p.project_stage ?? stageFromStatus(p.status);
      if (assigneeFilter) {
        const hasAssignee = deliverableRows.some((d) => d.project_id === p.id && d.assigned_to === assigneeFilter);
        if (!hasAssignee) return false;
      }
      if (projectFilter !== "all" && p.id !== projectFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (stageFilter !== "all" && stage !== stageFilter) return false;
      if (typeFilter !== "all" && p.project_type !== typeFilter) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      return true;
    });
  }, [projects, assigneeFilter, deliverableRows, projectFilter, statusFilter, stageFilter, typeFilter, clientFilter]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => (p.project_stage ?? stageFromStatus(p.status)) === "desenvolvimento").length;
    const paused = projects.filter((p) => (p.project_stage ?? stageFromStatus(p.status)) === "ofertas").length;
    const done = projects.filter((p) => (p.project_stage ?? stageFromStatus(p.status)) === "as_built").length;
    const budget = projects.reduce((acc, p) => acc + (Number(p.budget_total) || 0), 0);
    const avgProgress = projects.length
      ? Math.round(projects.reduce((acc, p) => acc + (summaryByProjectId[p.id]?.progressPct ?? 0), 0) / projects.length)
      : 0;
    const riskHigh = projects.filter((p) => riskLevel(p, summaryByProjectId[p.id] ?? {
      members: 0,
      deliverables: 0,
      approved: 0,
      progressPct: 0,
      extrasPending: 0,
      extrasApproved: 0,
      extrasPaid: 0,
    }) === "alto").length;
    return { total, active, paused, done, budget, avgProgress, riskHigh };
  }, [projects, summaryByProjectId]);

  const rankingCutoffIso = useMemo(() => {
    if (rankingWindow === "all") return null;
    const days = Number(rankingWindow);
    if (!Number.isFinite(days) || days <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [rankingWindow]);

  const isInRankingWindow = (value?: string | null) => {
    if (!rankingCutoffIso) return true;
    if (!value) return false;
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= new Date(rankingCutoffIso).getTime();
  };

  const projectEfficiencyRows = useMemo(() => {
    const filteredIds = new Set(filtered.map((p) => p.id));
    const windowDeliverables = deliverableRows.filter((d) =>
      filteredIds.has(d.project_id) && isInRankingWindow(d.created_at ?? d.due_date)
    );

    const directByProject = new Map<string, number>();
    for (const e of extrasRows) {
      if (!filteredIds.has(e.project_id)) continue;
      if (!isInRankingWindow(e.created_at ?? e.reference_month)) continue;
      if (e.status === "rejected") continue;
      directByProject.set(e.project_id, (directByProject.get(e.project_id) ?? 0) + (Number(e.amount) || 0));
    }

    const indirectByProject = new Map<string, number>();
    for (const i of indirectCostRows) {
      if (!filteredIds.has(i.project_id)) continue;
      if (!isInRankingWindow(i.created_at)) continue;
      indirectByProject.set(i.project_id, (indirectByProject.get(i.project_id) ?? 0) + (Number(i.amount) || 0));
    }

    const rows = filtered.map((p) => {
      const scoped = windowDeliverables.filter((d) => d.project_id === p.id);
      const approvedCount = scoped.filter((d) => d.status === "approved").length;
      const productivityPct = scoped.length ? Math.round((approvedCount / scoped.length) * 100) : 0;
      const revenue = Number(p.budget_total) || 0;
      const direct = directByProject.get(p.id) ?? 0;
      const indirect = indirectByProject.get(p.id) ?? 0;
      const profit = revenue - direct - indirect;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      const profitabilityScore = Math.max(0, Math.min(100, marginPct));
      const index = Math.round(productivityPct * 0.5 + profitabilityScore * 0.5);
      return {
        projectId: p.id,
        projectName: p.name,
        productivityPct,
        marginPct,
        index,
        revenue,
        direct,
        indirect,
        profit,
      };
    });

    rows.sort((a, b) => b.index - a.index || b.marginPct - a.marginPct);
    return rows;
  }, [filtered, deliverableRows, extrasRows, indirectCostRows, rankingCutoffIso]);

  const collaboratorEfficiencyRows = useMemo(() => {
    const filteredIds = new Set(filtered.map((p) => p.id));
    const windowDeliverables = deliverableRows.filter((d) =>
      filteredIds.has(d.project_id) && isInRankingWindow(d.created_at ?? d.due_date)
    );
    const directByProject = new Map<string, number>();
    for (const e of extrasRows) {
      if (!filteredIds.has(e.project_id)) continue;
      if (!isInRankingWindow(e.created_at ?? e.reference_month)) continue;
      if (e.status === "rejected") continue;
      directByProject.set(e.project_id, (directByProject.get(e.project_id) ?? 0) + (Number(e.amount) || 0));
    }
    const indirectByProject = new Map<string, number>();
    for (const i of indirectCostRows) {
      if (!filteredIds.has(i.project_id)) continue;
      if (!isInRankingWindow(i.created_at)) continue;
      indirectByProject.set(i.project_id, (indirectByProject.get(i.project_id) ?? 0) + (Number(i.amount) || 0));
    }

    const membersByProject = new Map<string, string[]>();
    for (const m of memberRows) {
      if (!filteredIds.has(m.project_id)) continue;
      const list = membersByProject.get(m.project_id) ?? [];
      list.push(m.user_id);
      membersByProject.set(m.project_id, list);
    }

    const allocationsByProject = new Map<string, ProjectAllocationRow[]>();
    for (const a of allocationRows) {
      if (!filteredIds.has(a.project_id)) continue;
      const list = allocationsByProject.get(a.project_id) ?? [];
      list.push(a);
      allocationsByProject.set(a.project_id, list);
    }

    const metricsByUser = new Map<string, { revenue: number; cost: number; assigned: number; approved: number }>();
    const ensure = (uid: string) => {
      const row = metricsByUser.get(uid) ?? { revenue: 0, cost: 0, assigned: 0, approved: 0 };
      metricsByUser.set(uid, row);
      return row;
    };

    for (const d of windowDeliverables) {
      if (!d.assigned_to) continue;
      const row = ensure(d.assigned_to);
      row.assigned += 1;
      if (d.status === "approved") row.approved += 1;
    }

    for (const p of filtered) {
      const revenue = Number(p.budget_total) || 0;
      const cost = (directByProject.get(p.id) ?? 0) + (indirectByProject.get(p.id) ?? 0);
      const allocs = allocationsByProject.get(p.id) ?? [];
      if (allocs.length > 0) {
        for (const a of allocs) {
          const pct = Math.max(0, Number(a.allocation_pct) || 0) / 100;
          if (pct <= 0) continue;
          const row = ensure(a.user_id);
          row.revenue += revenue * pct;
          row.cost += cost * pct;
        }
      } else {
        const members = membersByProject.get(p.id) ?? [];
        if (!members.length) continue;
        const split = 1 / members.length;
        for (const uid of members) {
          const row = ensure(uid);
          row.revenue += revenue * split;
          row.cost += cost * split;
        }
      }
    }

    const rows = Array.from(metricsByUser.entries()).map(([uid, m]) => {
      const productivityPct = m.assigned > 0 ? Math.round((m.approved / m.assigned) * 100) : 0;
      const marginPct = m.revenue > 0 ? ((m.revenue - m.cost) / m.revenue) * 100 : 0;
      const profitabilityScore = Math.max(0, Math.min(100, marginPct));
      const index = Math.round(productivityPct * 0.5 + profitabilityScore * 0.5);
      return {
        userId: uid,
        userName: userNameById[uid] ?? `Colaborador ${uid.slice(0, 8)}`,
        productivityPct,
        marginPct,
        index,
        assigned: m.assigned,
        approved: m.approved,
        revenue: m.revenue,
        cost: m.cost,
      };
    });
    rows.sort((a, b) => b.index - a.index || b.productivityPct - a.productivityPct);
    return rows;
  }, [filtered, extrasRows, indirectCostRows, allocationRows, deliverableRows, memberRows, userNameById, rankingCutoffIso]);

  const monthly = useMemo(() => {
    const months = lastMonths(6);
    const createdByMonth: Record<string, number> = {};
    const doneByMonth: Record<string, number> = {};
    const extrasByMonth: Record<string, number> = {};

    for (const p of projects) {
      const created = parseDateOnly(p.created_at);
      if (created) createdByMonth[monthKey(created)] = (createdByMonth[monthKey(created)] ?? 0) + 1;
      if (p.status === "done") {
        const doneDate = parseDateOnly(p.end_date) ?? created;
        if (doneDate) doneByMonth[monthKey(doneDate)] = (doneByMonth[monthKey(doneDate)] ?? 0) + 1;
      }
    }

    for (const e of extrasRows) {
      const key = (e.reference_month ?? "").slice(0, 7);
      if (!key) continue;
      extrasByMonth[key] = (extrasByMonth[key] ?? 0) + (Number(e.amount) || 0);
    }

    return months.map((m) => ({
      month: m,
      created: createdByMonth[m] ?? 0,
      done: doneByMonth[m] ?? 0,
      extras: extrasByMonth[m] ?? 0,
    }));
  }, [projects, extrasRows]);

  function exportCsv() {
    const header = [
      "projeto",
      "cliente",
      "tipo",
      "status",
      "equipe",
      "entregaveis_total",
      "entregaveis_aprovados",
      "progresso_pct",
      "orcamento",
      "extras_pendentes",
      "extras_aprovados",
      "extras_pagos",
      "risco",
      "inicio",
      "fim",
    ];

    const rows = filtered.map((p) => {
      const s = summaryByProjectId[p.id] ?? {
        members: 0,
        deliverables: 0,
        approved: 0,
        progressPct: 0,
        extrasPending: 0,
        extrasApproved: 0,
        extrasPaid: 0,
      };
      return [
        p.name,
        p.client_id ? (clientsById[p.client_id] ?? p.client_id) : "-",
        projectTypeLabel(p.project_type),
        statusLabel(p.status),
        s.members,
        s.deliverables,
        s.approved,
        s.progressPct,
        Number(p.budget_total) || 0,
        s.extrasPending,
        s.extrasApproved,
        s.extrasPaid,
        riskLevel(p, s),
        p.start_date ?? "",
        p.end_date ?? "",
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diretoria-projetos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function saveProjectStatus(projectId: string) {
    const nextStage = stageDraftByProject[projectId];
    if (!nextStage) return;
    const note = (stageNoteByProject[projectId] ?? "").trim();
    const nextStatus = statusFromStage(nextStage);
    setSavingProjectId(projectId);
    setMsg("");
    try {
      const { error } = await supabase.from("projects").update({ status: nextStatus, project_stage: nextStage }).eq("id", projectId);
      if (error) {
        const fallback = await supabase.from("projects").update({ status: nextStatus }).eq("id", projectId);
        if (fallback.error) throw fallback.error;
      }

      const prev = projects.find((p) => p.id === projectId);
      const prevStage = prev?.project_stage ?? (prev ? stageFromStatus(prev.status) : nextStage);
      const prevStatus = prev?.status ?? nextStatus;

      const timelineInsert = await supabase.from("project_update_timeline").insert({
        project_id: projectId,
        event_type: "stage_update",
        title: "Etapa do projeto atualizada",
        description: `Etapa: ${stageLabel(prevStage)} -> ${stageLabel(nextStage)} | Status: ${statusLabel(prevStatus)} -> ${statusLabel(nextStatus)}${note ? ` | Obs: ${note}` : ""}`,
      });
      if (timelineInsert.error) {
        // tabela pode nao existir no ambiente ainda; segue sem bloquear operacao principal
      }

      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: nextStatus, project_stage: nextStage } : p)));
      setStageNoteByProject((prev) => ({ ...prev, [projectId]: "" }));
      setMsg("Etapa do projeto atualizada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar etapa do projeto.");
    } finally {
      setSavingProjectId(null);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Diretoria - Acompanhamento de projetos</h1>
            <p className="mt-1 text-sm text-slate-600">
              Visao executiva com cliente, tipo, status, progresso, equipe, orcamento e custos extras.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/diretoria/projetos/novo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Novo projeto
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setShowProjectInfo(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Ver informacoes do projeto
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || !filtered.length}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Painel Executivo</p>
        <p className="mt-1 text-sm text-slate-300">Visao consolidada dos projetos para Diretoria.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-slate-300">Projetos</p>
            <p className="text-3xl font-semibold">{stats.total}</p>
          </div>
          <div>
            <p className="text-slate-300">Orcamento total</p>
            <p className="text-3xl font-semibold">{fmtMoney(stats.budget)}</p>
          </div>
          <div>
            <p className="text-slate-300">Media progresso</p>
            <p className="text-3xl font-semibold">{stats.avgProgress}%</p>
          </div>
          <div>
            <p className="text-slate-300">Risco alto</p>
            <p className="text-3xl font-semibold">{stats.riskHigh}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Projeto
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
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
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectStatus)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="paused">Ofertas</option>
              <option value="active">Desenvolvimento</option>
              <option value="done">As Built</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Etapa (diretoria)
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as "all" | ProjectStage)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todas</option>
              <option value="ofertas">Ofertas</option>
              <option value="desenvolvimento">Desenvolvimento</option>
              <option value="as_built">As Built</option>
              <option value="pausado">Pausado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | ProjectType)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="hv">HV</option>
              <option value="rmt">RMT</option>
              <option value="basico">Basico</option>
              <option value="estrutural">Estrutural</option>
              <option value="civil">Civil</option>
              <option value="eletromecanico">Eletromecanico</option>
              <option value="eletrico">Eletrico</option>
              <option value="hidraulico">Hidraulico</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Cliente
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {assigneeFilter ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
            <span>Filtro ativo por colaborador: <b>{assigneeFilter.slice(0, 8)}</b></span>
            <button
              type="button"
              onClick={clearAssigneeFilter}
              className="rounded-lg border border-indigo-200 bg-white px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Limpar filtro
            </button>
          </div>
        ) : null}
      </div>

      {showProjectInfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Acompanhamento operacional do projeto</p>
                <p className="text-xs text-slate-500">Acoes de gestores/equipes em entregaveis e documentos</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectInfo(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            {selectedProjectForStage ? (
              <div className="mt-4 space-y-2">
                {selectedOperationalTimeline.length ? (
                  selectedOperationalTimeline.slice(0, 120).map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                        <span className="text-xs text-slate-500">{new Date(row.ts).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="text-xs text-slate-600">{row.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 px-3 py-4 text-sm text-slate-500">
                    Sem eventos operacionais registrados para este projeto.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 px-3 py-4 text-sm text-slate-500">
                Selecione um projeto no filtro para visualizar os detalhes operacionais.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-600">Fase do projeto</p>
            <p className="text-sm font-semibold text-slate-900">
              {selectedProjectForStage ? selectedProjectForStage.name : "Selecione um projeto para alterar a fase"}
            </p>
            <div className="mt-1">
              {selectedProjectForStage ? (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stageClass(
                    selectedProjectForStage.project_stage ?? stageFromStatus(selectedProjectForStage.status)
                  )}`}
                >
                  Atual: {stageLabel(selectedProjectForStage.project_stage ?? stageFromStatus(selectedProjectForStage.status))}
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Aguardando selecao de projeto
                </span>
              )}
            </div>
          </div>
          <div className="grid w-full gap-2 md:w-auto md:grid-cols-[220px_minmax(360px,1fr)_auto]">
            <select
              value={
                selectedProjectForStage
                  ? stageDraftByProject[selectedProjectForStage.id] ??
                    (selectedProjectForStage.project_stage ?? stageFromStatus(selectedProjectForStage.status))
                  : "ofertas"
              }
              onChange={(e) =>
                selectedProjectForStage
                  ? setStageDraftByProject((prev) => ({ ...prev, [selectedProjectForStage.id]: e.target.value as ProjectStage }))
                  : undefined
              }
              disabled={!selectedProjectForStage}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:opacity-60"
            >
              <option value="ofertas">Ofertas</option>
              <option value="desenvolvimento">Desenvolvimento</option>
              <option value="as_built">As Built</option>
              <option value="pausado">Pausado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <textarea
              value={selectedProjectForStage ? (stageNoteByProject[selectedProjectForStage.id] ?? "") : ""}
              onChange={(e) =>
                selectedProjectForStage
                  ? setStageNoteByProject((prev) => ({ ...prev, [selectedProjectForStage.id]: e.target.value }))
                  : undefined
              }
              disabled={!selectedProjectForStage}
              placeholder="Observacoes da alteracao (opcional). Descreva o contexto, motivo, impacto e proximo passo."
              className="min-h-[92px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => (selectedProjectForStage ? void saveProjectStatus(selectedProjectForStage.id) : undefined)}
              disabled={
                !selectedProjectForStage ||
                savingProjectId === selectedProjectForStage.id ||
                (stageDraftByProject[selectedProjectForStage.id] ??
                  (selectedProjectForStage.project_stage ?? stageFromStatus(selectedProjectForStage.status))) ===
                  (selectedProjectForStage.project_stage ?? stageFromStatus(selectedProjectForStage.status))
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 md:self-start"
            >
              <Save size={14} />
              Notificar fase
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Linha do tempo - avanco do projeto (Diretoria)</p>
          <p className="text-xs text-slate-500">Atualizacoes de fase/status realizadas pela Diretoria</p>
        </div>
        {selectedProjectForStage ? (
          <div className="mt-3 space-y-2">
            {selectedStageTimeline.length ? (
              selectedStageTimeline.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                    <span className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-xs text-slate-600">{row.description ?? "Alteracao de fase registrada."}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 px-3 py-4 text-sm text-slate-500">
                Ainda nao ha alteracoes de fase para este projeto.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-slate-200 px-3 py-4 text-sm text-slate-500">
            Selecione um projeto para visualizar a linha do tempo de avanco.
          </div>
        )}
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Indice de produtividade e lucratividade</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">Criterio: 50% produtividade + 50% margem operacional</p>
            <select
              value={rankingWindow}
              onChange={(e) => setRankingWindow(e.target.value as "30" | "90" | "365" | "all")}
              className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-900"
            >
              <option value="30">Ultimos 30 dias</option>
              <option value="90">Ultimos 90 dias</option>
              <option value="365">Ultimos 365 dias</option>
              <option value="all">Historico</option>
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Por projeto</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-600">
                  <tr>
                    <th className="py-2 pr-2">Projeto</th>
                    <th className="py-2 pr-2">Indice</th>
                    <th className="py-2 pr-2">Prod.</th>
                    <th className="py-2 pr-2">Margem</th>
                    <th className="py-2 pr-2">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {projectEfficiencyRows.slice(0, 15).map((row) => (
                    <tr key={row.projectId} className="border-t border-slate-200">
                      <td className="py-2 pr-2 font-semibold text-slate-900">{row.projectName}</td>
                      <td className="py-2 pr-2">{row.index}%</td>
                      <td className="py-2 pr-2">{row.productivityPct}%</td>
                      <td className="py-2 pr-2">{fmtPct(row.marginPct)}</td>
                      <td className="py-2 pr-2">{fmtMoney(row.profit)}</td>
                    </tr>
                  ))}
                  {!projectEfficiencyRows.length ? (
                    <tr>
                      <td className="py-2 text-slate-500" colSpan={5}>Sem dados para o filtro atual.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Por colaborador</p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-600">
                  <tr>
                    <th className="py-2 pr-2">Colaborador</th>
                    <th className="py-2 pr-2">Indice</th>
                    <th className="py-2 pr-2">Prod.</th>
                    <th className="py-2 pr-2">Margem</th>
                    <th className="py-2 pr-2">Aprov.</th>
                  </tr>
                </thead>
                <tbody>
                  {collaboratorEfficiencyRows.slice(0, 20).map((row) => (
                    <tr key={row.userId} className="border-t border-slate-200">
                      <td className="py-2 pr-2 font-semibold text-slate-900">{row.userName}</td>
                      <td className="py-2 pr-2">{row.index}%</td>
                      <td className="py-2 pr-2">{row.productivityPct}%</td>
                      <td className="py-2 pr-2">{fmtPct(row.marginPct)}</td>
                      <td className="py-2 pr-2">{row.approved}/{row.assigned}</td>
                    </tr>
                  ))}
                  {!collaboratorEfficiencyRows.length ? (
                    <tr>
                      <td className="py-2 text-slate-500" colSpan={5}>Sem dados para o filtro atual.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Comparativo mensal (ultimos 6 meses)</p>
        <div className="mt-3">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Mes</th>
                <th className="p-3">Projetos criados</th>
                <th className="p-3">Projetos concluidos</th>
                <th className="p-3">Extras (R$)</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.month} className="border-t">
                  <td className="p-3">{m.month}</td>
                  <td className="p-3">{m.created}</td>
                  <td className="p-3">{m.done}</td>
                  <td className="p-3">{fmtMoney(m.extras)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="space-y-3 xl:hidden">
          {loading ? (
            <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-500">Carregando...</div>
          ) : filtered.length ? (
            filtered.map((p) => {
              const summary = summaryByProjectId[p.id] ?? {
                members: 0,
                deliverables: 0,
                approved: 0,
                progressPct: 0,
                extrasPending: 0,
                extrasApproved: 0,
                extrasPaid: 0,
              };
              const risk = riskLevel(p, summary);
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.start_date || "-"} ate {p.end_date || "-"}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stageClass(p.project_stage ?? stageFromStatus(p.status))}`}>
                        {stageLabel(p.project_stage ?? stageFromStatus(p.status))}
                      </span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${riskClass(risk)}`}>
                        {risk}
                      </span>
                    </div>
                  </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <div>
                      <p className="text-slate-500">Cliente</p>
                      <p>{p.client_id ? (clientsById[p.client_id] ?? p.client_id) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tipo</p>
                      <p>{projectTypeLabel(p.project_type)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Equipe</p>
                      <p>{summary.members}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Entregaveis</p>
                      <p>{summary.approved}/{summary.deliverables} ({summary.progressPct}%)</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Orcamento</p>
                      <p>{fmtMoney(Number(p.budget_total) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Extras (P/A/Pg)</p>
                      <p>{fmtMoney(summary.extrasPending)} / {fmtMoney(summary.extrasApproved)} / {fmtMoney(summary.extrasPaid)}</p>
                    </div>
                    </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-500">Nenhum projeto encontrado.</div>
          )}
        </div>

        <div className="hidden xl:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-[24%] p-3">Projeto</th>
                <th className="w-[12%] p-3">Cliente</th>
                <th className="w-[10%] p-3">Tipo</th>
                <th className="w-[14%] p-3">Status</th>
                <th className="w-[8%] p-3">Risco</th>
                <th className="w-[16%] p-3">Execucao</th>
                <th className="w-[16%] p-3">Financeiro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={7}>Carregando...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((p) => {
                  const summary = summaryByProjectId[p.id] ?? {
                    members: 0,
                    deliverables: 0,
                    approved: 0,
                    progressPct: 0,
                    extrasPending: 0,
                    extrasApproved: 0,
                    extrasPaid: 0,
                  };
                  const risk = riskLevel(p, summary);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.start_date || "-"} ate {p.end_date || "-"}
                        </div>
                      </td>
                      <td className="p-3">{p.client_id ? (clientsById[p.client_id] ?? p.client_id) : "-"}</td>
                      <td className="p-3">
                        <div>{projectTypeLabel(p.project_type)}</div>
                        <div className="text-xs text-slate-500">
                          {(p.project_scopes ?? []).map((s) => projectTypeLabel(s as ProjectType)).join(", ") || "-"}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold ${stageClass(p.project_stage ?? stageFromStatus(p.status))}`}>
                          <span className="truncate">{stageLabel(p.project_stage ?? stageFromStatus(p.status))}</span>
                        </span>
                      </td>
                      <td className="p-3 align-top">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${riskClass(risk)}`}>
                          {risk}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-slate-700">{summary.members} membros</div>
                        <div className="text-xs text-slate-700">{summary.approved}/{summary.deliverables} entregaveis</div>
                        <div className="text-xs font-semibold text-slate-900">{summary.progressPct}% progresso</div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                            <span>Orcamento</span>
                            <span className="font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(Number(p.budget_total) || 0)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                            <span>Pend.</span>
                            <span className="font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(summary.extrasPending)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                            <span>Aprov.</span>
                            <span className="font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(summary.extrasApproved)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                            <span>Pago</span>
                            <span className="font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(summary.extrasPaid)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={7}>Nenhum projeto encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
