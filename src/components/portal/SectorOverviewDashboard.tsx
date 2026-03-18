"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";

type SectorKey = "coordenador" | "gestor" | "pd" | "rh" | "financeiro" | "diretoria";

type TicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "cancelled";

type TicketRow = {
  id: string;
  status: TicketStatus;
  due_at: string | null;
  resolved_at: string | null;
  requester_user_id: string;
  assigned_to: string | null;
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
  status: DeliverableStatus;
  due_date: string | null;
  assigned_to: string | null;
  review_due_at?: string | null;
  approved_at?: string | null;
  approved_on_time?: boolean | null;
  approved_without_rework?: boolean | null;
  rework_count?: number | null;
};

type PdDeliverableRow = {
  id: string;
  project_id: string;
  status: DeliverableStatus;
  due_date: string | null;
  assigned_to: string | null;
  review_due_at?: string | null;
  approved_at?: string | null;
  approved_on_time?: boolean | null;
  approved_without_rework?: boolean | null;
  rework_count?: number | null;
};

type ProjectStatus = "planning" | "active" | "paused" | "done" | "cancelled";

type ProjectRow = {
  id: string;
  status: ProjectStatus;
  owner_user_id: string;
  budget_total?: number | null;
};

type PdProjectRow = {
  id: string;
  status: ProjectStatus;
};

type RequestStatus = "pending" | "in_review" | "approved" | "rejected" | "implemented" | "cancelled";
type RequestType = "financial" | "personal" | "contractual" | "avatar" | "other";
type AssignedArea = "rh" | "financeiro";

type ProfileRequestRow = {
  id: string;
  request_type: RequestType;
  requested_changes: Record<string, unknown> | null;
  status: RequestStatus;
  created_at: string;
};

type AbsenceRequestRow = {
  id: string;
  status: "pending_manager" | "approved" | "rejected" | "cancelled";
  manager_id: string;
  start_date: string;
};

type Stat = {
  label: string;
  value: string;
  hint: string;
  lines?: Array<{ text: string; href?: string }>;
  tone?: "neutral" | "good" | "warn" | "danger";
};

type RankingItem = {
  uid: string;
  name: string;
  avatarUrl: string | null;
  finalScore: number | null;
  hasProductivityBase: boolean;
  productivityPct: number;
  qualityPct: number;
  totalDocs: number;
  cleanApprovedDocs: number;
  reworkDocs: number;
  href: string;
};

type ExtraPaymentRow = {
  id: string;
  project_id: string;
  user_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
};

type IndirectCostRow = {
  id: string;
  project_id: string;
  cost_type?: "monthly" | "one_time" | "percentage_payroll" | null;
  amount: number;
  notes?: string | null;
};

type DeliverableAssigneeRow = {
  deliverable_id: string;
  user_id: string;
  contribution_value: number | null;
};

type DeliverableTimelineRow = {
  deliverable_id: string;
  event_type: string | null;
  status_from: DeliverableStatus | null;
  status_to: DeliverableStatus | null;
  created_at: string;
};

type ProjectAllocationRow = {
  project_id: string;
  user_id: string;
  allocation_pct: number;
};

type LinkItem = {
  href: string;
  label: string;
};

type ToneThreshold = { goodMin: number; warnMin: number };

type SectorKpiRules = {
  weights: {
    tickets: number;
    deliveries: number;
    requests: number;
    absences: number;
  };
  ticketSla: ToneThreshold;
  deliverySla: ToneThreshold;
  requestOverdue: {
    warnFrom: number;
    dangerFrom: number;
  };
  absencePending: {
    warnFrom: number;
    dangerFrom: number;
  };
  approvedDeliverableStatuses: DeliverableStatus[];
  pendingRequestStatuses: RequestStatus[];
};

function deriveAssignedArea(row: Pick<ProfileRequestRow, "request_type" | "requested_changes">): AssignedArea {
  const explicit = row.requested_changes?.assigned_area;
  if (explicit === "rh" || explicit === "financeiro") return explicit;
  return row.request_type === "financial" ? "financeiro" : "rh";
}

function isResolvedStatus(status: TicketStatus) {
  return status === "resolved";
}

function toneFromPercent(value: number, threshold: ToneThreshold): Stat["tone"] {
  if (value >= threshold.goodMin) return "good";
  if (value >= threshold.warnMin) return "warn";
  return "danger";
}

function toneFromCount(value: number, warnFrom: number, dangerFrom: number): Stat["tone"] {
  if (value >= dangerFrom) return "danger";
  if (value >= warnFrom) return "warn";
  return "good";
}

function hoursDiff(fromIso: string, toIso: string) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, (to - from) / (1000 * 60 * 60));
}

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(value: number) {
  return `${Math.round(value)}%`;
}

function endOfDayIso(dateYmd: string) {
  return `${dateYmd}T23:59:59.999Z`;
}

function toneClass(tone: Stat["tone"]) {
  if (tone === "good") return "border-emerald-200 bg-emerald-50/70";
  if (tone === "warn") return "border-amber-200 bg-amber-50/70";
  if (tone === "danger") return "border-rose-200 bg-rose-50/70";
  return "border-slate-200 bg-white";
}

function financeToneClass(tone: Stat["tone"]) {
  if (tone === "good") return "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50";
  if (tone === "warn") return "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50";
  if (tone === "danger") return "border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50";
  return "border-slate-200 bg-gradient-to-br from-white to-slate-50";
}

function initialsFromName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function isEmailLike(value: string) {
  return value.includes("@");
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

function isLegacyAbsolutePercentageValue(amount: number) {
  return amount > 100;
}

const DASHBOARD_CONFIG: Record<SectorKey, { title: string; subtitle: string; links: LinkItem[] }> = {
  coordenador: {
    title: "Painel do Coordenador",
    subtitle: "SLA de chamados, entregas, projetos, solicitações e acompanhamento da equipe.",
    links: [
      { href: "/coordenador/projetos", label: "Projetos" },
      { href: "/coordenador/feedback", label: "Feedbacks" },
      { href: "/coordenador/feedback?tab=pdi", label: "Gestao de PDI" },
      { href: "/p-d/chamados", label: "Chamados P&D" },
      { href: "/agenda", label: "Agenda e Ausências" },
    ],
  },
  gestor: {
    title: "Painel do Gestor",
    subtitle: "Visão consolidada dos indicadores críticos do setor e aprovações pendentes.",
    links: [
      { href: "/gestor/projetos", label: "Projetos" },
      { href: "/gestor/feedback?tab=pdi", label: "Gestao de PDI" },
      { href: "/gestor/pagamentos-extras", label: "Pagamentos extras" },
      { href: "/gestor/ausencias", label: "Aprovar ausências" },
      { href: "/p-d/chamados", label: "Chamados P&D" },
    ],
  },
  pd: {
    title: "Painel P&D",
    subtitle: "Monitoramento de chamados, entregas técnicas, ações internas e projetos de P&D.",
    links: [
      { href: "/p-d/chamados", label: "Fila de chamados" },
      { href: "/p-d/projetos", label: "Projetos P&D" },
      { href: "/gestor/projetos", label: "Projetos operacionais" },
    ],
  },
  rh: {
    title: "Painel RH",
    subtitle: "SLA das solicitações, ausências programadas, chamados e saúde da operação de pessoas.",
    links: [
      { href: "/rh/solicitacoes", label: "Solicitações RH" },
      { href: "/rh/ausencias", label: "Ausências programadas" },
      { href: "/rh/dashboard", label: "Dashboard RH" },
      { href: "/rh/colaboradores", label: "Colaboradores" },
    ],
  },
  financeiro: {
    title: "Painel Financeiro",
    subtitle: "Indicadores de SLA, custos, solicitações financeiras e acompanhamento de projetos.",
    links: [
      { href: "/financeiro/solicitacoes", label: "Solicitações financeiras" },
      { href: "/financeiro/custos-indiretos", label: "Custos indiretos" },
      { href: "/financeiro/remessas", label: "Remessas (boleto + CNAB)" },
      { href: "/financeiro/notas-fiscais", label: "Notas fiscais" },
      { href: "/diretoria/medicoes", label: "Medições e boletins" },
    ],
  },
  diretoria: {
    title: "Painel da Diretoria",
    subtitle: "Visão executiva de SLA, pipeline de projetos, contratos, medições e aprovações.",
    links: [
      { href: "/diretoria/projetos", label: "Projetos" },
      { href: "/diretoria/medicoes", label: "Medições" },
      { href: "/diretoria/contratos", label: "Contratos e aditivos" },
      { href: "/diretoria/clientes", label: "Clientes" },
    ],
  },
};

const KPI_RULES: Record<SectorKey, SectorKpiRules> = {
  coordenador: {
    weights: { tickets: 20, deliveries: 45, requests: 20, absences: 15 },
    ticketSla: { goodMin: 90, warnMin: 75 },
    deliverySla: { goodMin: 88, warnMin: 70 },
    requestOverdue: { warnFrom: 1, dangerFrom: 4 },
    absencePending: { warnFrom: 1, dangerFrom: 4 },
    approvedDeliverableStatuses: ["approved", "approved_with_comments"],
    pendingRequestStatuses: ["pending", "in_review"],
  },
  gestor: {
    weights: { tickets: 25, deliveries: 40, requests: 20, absences: 15 },
    ticketSla: { goodMin: 92, warnMin: 78 },
    deliverySla: { goodMin: 90, warnMin: 72 },
    requestOverdue: { warnFrom: 1, dangerFrom: 5 },
    absencePending: { warnFrom: 2, dangerFrom: 6 },
    approvedDeliverableStatuses: ["approved", "approved_with_comments"],
    pendingRequestStatuses: ["pending", "in_review"],
  },
  pd: {
    weights: { tickets: 35, deliveries: 45, requests: 10, absences: 10 },
    ticketSla: { goodMin: 90, warnMin: 75 },
    deliverySla: { goodMin: 88, warnMin: 70 },
    requestOverdue: { warnFrom: 1, dangerFrom: 3 },
    absencePending: { warnFrom: 1, dangerFrom: 4 },
    approvedDeliverableStatuses: ["approved", "approved_with_comments"],
    pendingRequestStatuses: ["pending", "in_review"],
  },
  rh: {
    weights: { tickets: 20, deliveries: 20, requests: 45, absences: 15 },
    ticketSla: { goodMin: 90, warnMin: 75 },
    deliverySla: { goodMin: 85, warnMin: 65 },
    requestOverdue: { warnFrom: 1, dangerFrom: 6 },
    absencePending: { warnFrom: 2, dangerFrom: 8 },
    approvedDeliverableStatuses: ["approved", "approved_with_comments"],
    pendingRequestStatuses: ["pending", "in_review"],
  },
  financeiro: {
    weights: { tickets: 25, deliveries: 20, requests: 40, absences: 15 },
    ticketSla: { goodMin: 90, warnMin: 75 },
    deliverySla: { goodMin: 85, warnMin: 65 },
    requestOverdue: { warnFrom: 1, dangerFrom: 5 },
    absencePending: { warnFrom: 1, dangerFrom: 4 },
    approvedDeliverableStatuses: ["approved", "approved_with_comments"],
    pendingRequestStatuses: ["pending", "in_review"],
  },
  diretoria: {
    weights: { tickets: 20, deliveries: 35, requests: 25, absences: 20 },
    ticketSla: { goodMin: 92, warnMin: 78 },
    deliverySla: { goodMin: 90, warnMin: 72 },
    requestOverdue: { warnFrom: 1, dangerFrom: 4 },
    absencePending: { warnFrom: 1, dangerFrom: 3 },
    approvedDeliverableStatuses: ["approved", "approved_with_comments"],
    pendingRequestStatuses: ["pending", "in_review"],
  },
};

export default function SectorOverviewDashboard({ sector }: { sector: SectorKey }) {
  const cfg = DASHBOARD_CONFIG[sector];
  const rules = KPI_RULES[sector];

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState<Stat[]>([]);
  const [rankingItems, setRankingItems] = useState<RankingItem[]>([]);
  const [rankingWindowDays, setRankingWindowDays] = useState<"30" | "90" | "365" | "all">("30");

  async function load() {
    setLoading(true);
    setMsg("");
    setRankingItems([]);

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const todayIso = nowIso.slice(0, 10);
      const rankingStartIso =
        rankingWindowDays === "all"
          ? null
          : new Date(now.getTime() - Number(rankingWindowDays) * 24 * 60 * 60 * 1000).toISOString();
      const returnsStartIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      const userId = authData.user.id;
      let currentRole: string | null = null;
      try {
        const profileRes = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: string | null }>();
        if (!profileRes.error) currentRole = profileRes.data?.role ?? null;
      } catch {}
      const isAdmin = currentRole === "admin";

      let slaHours = 72;
      try {
        const slaRes = await supabase
          .from("request_sla_settings")
          .select("sla_hours")
          .eq("config_key", "profile_update_requests")
          .maybeSingle<{ sla_hours: number }>();
        if (!slaRes.error && typeof slaRes.data?.sla_hours === "number") slaHours = slaRes.data.sla_hours;
      } catch {}

      let tickets: TicketRow[] = [];
      try {
        const ticketRes = await supabase
          .from("pd_tickets")
          .select("id,status,due_at,resolved_at,requester_user_id,assigned_to")
          .order("created_at", { ascending: false });
        if (!ticketRes.error) {
          tickets = (ticketRes.data ?? []) as TicketRow[];
        } else if (sector === "coordenador" || sector === "gestor" || sector === "pd") {
          const fallback = await supabase
            .from("pd_tickets")
            .select("id,status,due_at,resolved_at,requester_user_id,assigned_to")
            .or(`requester_user_id.eq.${userId},assigned_to.eq.${userId}`)
            .order("created_at", { ascending: false });
          if (!fallback.error) tickets = (fallback.data ?? []) as TicketRow[];
        }
      } catch {}

      let projectIds: string[] = [];
      let scopedProjects: ProjectRow[] = [];
      let projectCountActive = 0;
      let projectCountPaused = 0;
      let projectCountDone = 0;

      let deliverables: Array<DeliverableRow | PdDeliverableRow> = [];

      if (sector === "pd") {
        try {
          const [pr, dr] = await Promise.all([
            supabase.from("pd_projects").select("id,status"),
            supabase
              .from("pd_project_deliverables")
              .select("id,project_id,status,due_date,assigned_to,review_due_at,approved_at,approved_on_time,approved_without_rework,rework_count"),
          ]);
          const projects = (pr.data ?? []) as PdProjectRow[];
          const filteredProjects = projects;
          projectIds = filteredProjects.map((p) => p.id);
          projectCountActive = filteredProjects.filter((p) => p.status === "active").length;
          projectCountPaused = filteredProjects.filter((p) => p.status === "paused").length;
          projectCountDone = filteredProjects.filter((p) => p.status === "done").length;
          if (!dr.error) {
            const all = (dr.data ?? []) as PdDeliverableRow[];
            const set = new Set(projectIds);
            deliverables = all.filter((d) => set.has(d.project_id));
          }
        } catch {}
      } else {
        try {
          const [pr, mr] = await Promise.all([
            supabase.from("projects").select("id,status,owner_user_id,budget_total"),
            supabase.from("project_members").select("project_id,user_id,member_role").eq("user_id", userId),
          ]);
          const projects = (pr.data ?? []) as ProjectRow[];
          const memberships = (mr.data ?? []) as Array<{ project_id: string; user_id: string; member_role: string }>;

          if (isAdmin) {
            projectIds = projects.map((p) => p.id);
          } else if (sector === "gestor" || sector === "coordenador") {
            const ids = new Set(memberships.map((m) => m.project_id));
            if (sector === "gestor") {
              for (const p of projects) if (p.owner_user_id === userId) ids.add(p.id);
            }
            projectIds = Array.from(ids);
          } else {
            projectIds = projects.map((p) => p.id);
          }

          const set = new Set(projectIds);
          const scoped = projects.filter((p) => set.has(p.id));
          scopedProjects = scoped;
          projectCountActive = scoped.filter((p) => p.status === "active").length;
          projectCountPaused = scoped.filter((p) => p.status === "paused").length;
          projectCountDone = scoped.filter((p) => p.status === "done").length;

          if (projectIds.length > 0) {
            const dr = await supabase
              .from("project_deliverables")
              .select("id,project_id,status,due_date,assigned_to,review_due_at,approved_at,approved_on_time,approved_without_rework,rework_count")
              .in("project_id", projectIds);
            if (!dr.error) deliverables = (dr.data ?? []) as DeliverableRow[];
          }
        } catch {}
      }

      let extraPayments: ExtraPaymentRow[] = [];
      if ((sector === "gestor" || sector === "diretoria") && projectIds.length > 0) {
        try {
          const ep = await supabase
            .from("project_extra_payments")
            .select("id,project_id,user_id,amount,status")
            .in("project_id", projectIds);
          if (!ep.error) extraPayments = (ep.data ?? []) as ExtraPaymentRow[];
        } catch {}
      }

      let requests: ProfileRequestRow[] = [];
      try {
        const rr = await supabase
          .from("profile_update_requests")
          .select("id,request_type,requested_changes,status,created_at")
          .order("created_at", { ascending: false });
        if (!rr.error) {
          let scoped = (rr.data ?? []) as ProfileRequestRow[];
          if (sector === "rh") scoped = scoped.filter((r) => deriveAssignedArea(r) === "rh");
          if (sector === "financeiro") scoped = scoped.filter((r) => deriveAssignedArea(r) === "financeiro");
          requests = scoped;
        }
      } catch {}

      let absences: AbsenceRequestRow[] = [];
      try {
        const ar = await supabase
          .from("absence_requests")
          .select("id,status,manager_id,start_date")
          .order("created_at", { ascending: false });
        if (!ar.error) {
          let scoped = (ar.data ?? []) as AbsenceRequestRow[];
          if (sector === "gestor" || sector === "coordenador") scoped = scoped.filter((x) => x.manager_id === userId);
          absences = scoped;
        }
      } catch {}

      let extraLabel = "Indicador do setor";
      let extraValue = "0";
      let extraHint = "Sem leitura";
      let extraTone: Stat["tone"] = "neutral";
      const dynamicStats: Stat[] = [];
      const nextRankingItems: RankingItem[] = [];

      if (sector === "coordenador") {
        extraLabel = "Entregas da coordenação";
        const mine = (deliverables as DeliverableRow[]).filter(
          (d) => !rules.approvedDeliverableStatuses.includes(d.status) && d.due_date && d.due_date <= todayIso
        ).length;
        extraValue = String(mine);
        extraHint = "Itens em atraso no escopo acompanhado";
        extraTone = mine > 0 ? "warn" : "good";
      }

      if (sector === "pd") {
        extraLabel = "Ações bloqueadas";
        let blocked = 0;
        try {
          const ar = await supabase.from("pd_project_actions").select("id,status");
          if (!ar.error) blocked = ((ar.data ?? []) as Array<{ status: string }>).filter((x) => x.status === "blocked").length;
        } catch {}
        extraValue = String(blocked);
        extraHint = "Demandas internas bloqueadas no fluxo";
        extraTone = blocked > 0 ? "warn" : "good";
      }

      if (sector === "gestor") {
        const directCost = extraPayments
          .filter((x) => x.status === "approved" || x.status === "paid")
          .reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
        const pendingExtras = extraPayments.filter((x) => x.status === "pending").length;
        extraLabel = "Custo direto consolidado";
        extraValue = fmtMoney(directCost);
        extraHint = `Somente custos diretos aprovados/pagos. Pendencias financeiras: ${pendingExtras}.`;
        extraTone = pendingExtras > 0 ? "warn" : "neutral";
      }

      if (sector === "rh") {
        extraLabel = "Colaboradores ativos";
        let activeProfiles = 0;
        try {
          const ur = await supabase.from("profiles").select("id,active");
          if (!ur.error) activeProfiles = ((ur.data ?? []) as Array<{ active: boolean | null }>).filter((x) => x.active).length;
        } catch {}
        extraValue = String(activeProfiles);
        extraHint = "Base ativa para gestão de pessoas";
        extraTone = activeProfiles > 0 ? "good" : "neutral";
      }

      if (sector === "financeiro") {
        extraLabel = "Remessas pendentes";
        let pendingRemittances = 0;
        try {
          const rr = await supabase.from("collaborator_invoice_remittances").select("id,status");
          if (!rr.error) {
            pendingRemittances = ((rr.data ?? []) as Array<{ status: string }>).filter(
              (x) => x.status === "draft" || x.status === "payment_pending"
            ).length;
          }
        } catch {}
        extraValue = String(pendingRemittances);
        extraHint = "Lotes aguardando boleto/pagamento";
        extraTone = pendingRemittances > 0 ? "warn" : "good";
      }

      if (sector === "diretoria") {
        extraLabel = "Aditivos em análise";
        let contracts = 0;
        try {
          const cr = await supabase.from("project_contract_events").select("id,status");
          if (!cr.error) contracts = ((cr.data ?? []) as Array<{ status: string }>).filter((x) => x.status === "em_analise").length;
        } catch {}
        extraValue = String(contracts);
        extraHint = "Contratos/aditivos aguardando decisão";
        extraTone = contracts > 0 ? "warn" : "good";
      }

      if ((sector === "coordenador" || sector === "gestor" || sector === "diretoria") && projectIds.length > 0) {
        const scopedDeliverablesAll = (deliverables as DeliverableRow[]).filter((d) => projectIds.includes(d.project_id));
        const scopedDeliverables = scopedDeliverablesAll.filter((d) => {
          if (!rankingStartIso) return true;
          if (d.approved_at) return d.approved_at >= rankingStartIso;
          if (d.due_date) return d.due_date >= rankingStartIso.slice(0, 10);
          return true;
        });
        const deliverableIds = scopedDeliverablesAll.map((d) => d.id);
        const assigneeMap = new Map<string, string[]>();
        const timelineByDeliverable = new Map<string, DeliverableTimelineRow[]>();
        const participantIds = new Set<string>();
        for (const p of scopedProjects) participantIds.add(p.owner_user_id);
        try {
          const membersRes = await supabase.from("project_members").select("user_id").in("project_id", projectIds);
          if (!membersRes.error) {
            for (const m of (membersRes.data ?? []) as Array<{ user_id: string }>) {
              participantIds.add(m.user_id);
            }
          }
        } catch {}

        if (deliverableIds.length > 0) {
          try {
            const [asg, tl] = await Promise.all([
              supabase
                .from("project_deliverable_assignees")
                .select("deliverable_id,user_id,contribution_value")
                .in("deliverable_id", deliverableIds),
              supabase
                .from("project_deliverable_timeline")
                .select("deliverable_id,event_type,status_from,status_to,created_at")
                .in("deliverable_id", deliverableIds)
                .order("created_at", { ascending: true }),
            ]);
            if (!asg.error) {
              for (const row of (asg.data ?? []) as DeliverableAssigneeRow[]) {
                const prev = assigneeMap.get(row.deliverable_id) ?? [];
                prev.push(row.user_id);
                assigneeMap.set(row.deliverable_id, prev);
              }
            }
            if (!tl.error) {
              for (const row of (tl.data ?? []) as DeliverableTimelineRow[]) {
                const prev = timelineByDeliverable.get(row.deliverable_id) ?? [];
                prev.push(row);
                timelineByDeliverable.set(row.deliverable_id, prev);
              }
            }
          } catch {}
        }

        type RankAgg = {
          docs: number;
          quality: number;
          productivity: number;
          cleanApprovedDocs: number;
          reworkDocs: number;
        };
        const rankByUser = new Map<string, RankAgg>();
        for (const d of scopedDeliverables) {
          const assignedUsers = [...new Set([...(assigneeMap.get(d.id) ?? []), ...(d.assigned_to ? [d.assigned_to] : [])])];
          if (!assignedUsers.length) continue;
          const split = 1 / assignedUsers.length;
          const timeline = timelineByDeliverable.get(d.id) ?? [];
          const hasReturnForFix = timeline.some(
            (e) =>
              e.event_type === "returned_for_rework" ||
              ((e.status_to === "pending" || e.status_to === "in_progress") &&
                (e.status_from === "sent" || e.status_from === "approved_with_comments"))
          );
          const hadApprovalWithComments =
            d.status === "approved_with_comments" || timeline.some((e) => e.status_to === "approved_with_comments");
          const approvedAt = d.approved_at ?? [...timeline].reverse().find((e) => e.status_to === "approved")?.created_at ?? null;
          const qualityOk =
            (d.approved_without_rework ?? null) !== null
              ? !!d.approved_without_rework
              : d.status === "approved" && !hasReturnForFix && !hadApprovalWithComments;
          const onTime =
            (d.approved_on_time ?? null) !== null
              ? !!d.approved_on_time
              : (!d.due_date || (!!approvedAt && approvedAt <= endOfDayIso(d.due_date)));
          const productiveOk = qualityOk && onTime;
          const q = qualityOk ? 1 : 0;
          const p = productiveOk ? 1 : 0;
          const reworkDocs = (d.rework_count ?? 0) > 0 || hasReturnForFix ? 1 : 0;
          for (const uid of assignedUsers) {
            const prev = rankByUser.get(uid) ?? {
              docs: 0,
              quality: 0,
              productivity: 0,
              cleanApprovedDocs: 0,
              reworkDocs: 0,
            };
            prev.docs += split;
            prev.quality += q * split;
            prev.productivity += p * split;
            prev.cleanApprovedDocs += q * split;
            prev.reworkDocs += reworkDocs * split;
            rankByUser.set(uid, prev);
          }
        }
        for (const uid of participantIds) {
          if (!rankByUser.has(uid)) {
            rankByUser.set(uid, { docs: 0, quality: 0, productivity: 0, cleanApprovedDocs: 0, reworkDocs: 0 });
          }
        }

        const rankedUsers = Array.from(rankByUser.entries())
          .map(([uid, agg]) => {
            const hasProductivityBase = agg.docs > 0;
            const docs = Math.max(agg.docs, 1);
            const qualityPct = (agg.quality / docs) * 100;
            const productivityPct = (agg.productivity / docs) * 100;
            const finalScore = hasProductivityBase ? (qualityPct + productivityPct) / 2 : null;
            return {
              uid,
              docs,
              hasProductivityBase,
              qualityPct,
              productivityPct,
              finalScore,
              cleanApprovedDocs: agg.cleanApprovedDocs,
              reworkDocs: agg.reworkDocs,
            };
          })
          .sort((a, b) => (Number(b.finalScore ?? -1) - Number(a.finalScore ?? -1)));

        const profileById: Record<string, { name: string; avatarUrl: string | null }> = {};
        try {
          const ids = rankedUsers.map((x) => x.uid);
          if (ids.length) {
            const collaboratorByUserId: Record<string, string> = {};
            const collabsRes = await supabase.from("colaboradores").select("user_id,nome").in("user_id", ids);
            if (!collabsRes.error) {
              for (const c of (collabsRes.data ?? []) as Array<{ user_id: string | null; nome: string | null }>) {
                const uid = (c.user_id ?? "").trim();
                const nome = (c.nome ?? "").trim();
                if (uid && nome && !isEmailLike(nome)) collaboratorByUserId[uid] = nome;
              }
            }
            const pr = await supabase.from("profiles").select("id,full_name,email,avatar_url").in("id", ids);
            if (!pr.error) {
              for (const p of (pr.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; avatar_url?: string | null }>) {
                const full = (p.full_name ?? "").trim();
                const fromCollaborator = collaboratorByUserId[p.id] ?? "";
                const safeName =
                  (full && !isEmailLike(full) ? full : "") ||
                  (fromCollaborator && !isEmailLike(fromCollaborator) ? fromCollaborator : "") ||
                  "Colaborador sem nome";
                profileById[p.id] = {
                  name: safeName,
                  avatarUrl: resolvePortalAvatarUrl(p.avatar_url ?? null),
                };
              }
            }
          }
        } catch {}

        const rankingRoute =
          sector === "coordenador" ? "/coordenador/projetos" : sector === "gestor" ? "/gestor/projetos" : "/diretoria/projetos";
        for (const r of rankedUsers) {
          const profile = profileById[r.uid];
          nextRankingItems.push({
            uid: r.uid,
            name: profile?.name ?? "Colaborador sem nome",
            avatarUrl: profile?.avatarUrl ?? null,
            finalScore: r.finalScore,
            hasProductivityBase: r.hasProductivityBase,
            productivityPct: r.productivityPct,
            qualityPct: r.qualityPct,
            totalDocs: Math.round(r.docs),
            cleanApprovedDocs: Math.round(r.cleanApprovedDocs),
            reworkDocs: Math.round(r.reworkDocs),
            href: `${rankingRoute}?assignee=${encodeURIComponent(r.uid)}`,
          });
        }

        const reviewedDeliverables = scopedDeliverablesAll.filter((d) => !!d.approved_at);
        const approvalsOnTime = reviewedDeliverables.filter((d) => !!d.approved_on_time).length;
        const approvalSlaRate = reviewedDeliverables.length
          ? Math.round((approvalsOnTime / reviewedDeliverables.length) * 100)
          : 100;
        dynamicStats.push({
          label: "SLA de aprovacao",
          value: `${approvalSlaRate}%`,
          hint: `${approvalsOnTime}/${reviewedDeliverables.length} aprovados dentro do prazo de revisao`,
          tone: toneFromPercent(approvalSlaRate, { goodMin: 90, warnMin: 75 }),
        });

        const returnsLast7 = Array.from(timelineByDeliverable.values())
          .flat()
          .filter((e) => e.event_type === "returned_for_rework" && e.created_at >= returnsStartIso).length;
        const atRiskDeliverables = scopedDeliverablesAll.filter((d) => {
          if (d.status === "approved" || d.status === "approved_with_comments" || d.status === "cancelled") return false;
          if (!d.due_date) return false;
          const dueTs = new Date(endOfDayIso(d.due_date)).getTime();
          const nowTs = now.getTime();
          const diffDays = (dueTs - nowTs) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 2;
        }).length;
        dynamicStats.push({
          label: "Alertas operacionais",
          value: String(returnsLast7 + atRiskDeliverables),
          hint: `${returnsLast7} retornos para ajuste (7d) | ${atRiskDeliverables} entregaveis em risco (<=2 dias)`,
          tone: toneFromCount(returnsLast7 + atRiskDeliverables, 1, 5),
        });

        if (sector === "diretoria") {
          let indirectCosts: IndirectCostRow[] = [];
          let allocations: ProjectAllocationRow[] = [];
          const salaryByCollaboratorName = new Map<string, number>();
          try {
            const [indRes, allocRes, collabRes] = await Promise.all([
              supabase.from("project_indirect_costs").select("id,project_id,cost_type,amount,notes").in("project_id", projectIds),
              supabase.from("project_member_allocations").select("project_id,user_id,allocation_pct").in("project_id", projectIds),
              supabase.from("colaboradores").select("nome,salario,is_active"),
            ]);
            if (!indRes.error) indirectCosts = (indRes.data ?? []) as IndirectCostRow[];
            if (!allocRes.error) allocations = (allocRes.data ?? []) as ProjectAllocationRow[];
            if (!collabRes.error) {
              for (const row of (collabRes.data ?? []) as Array<{ nome?: string | null; salario?: number | null; is_active?: boolean | null }>) {
                if (row.is_active === false) continue;
                const name = String(row.nome ?? "").trim().toLowerCase();
                if (!name) continue;
                salaryByCollaboratorName.set(name, Number(row.salario ?? 0) || 0);
              }
            }
          } catch {}

          const budgetByProject = new Map(scopedProjects.map((p) => [p.id, Number(p.budget_total) || 0]));
          const directByProject = new Map<string, number>();
          for (const ep of extraPayments) {
            if (ep.status === "rejected") continue;
            directByProject.set(ep.project_id, (directByProject.get(ep.project_id) ?? 0) + (Number(ep.amount) || 0));
          }
          const indirectByProject = new Map<string, number>();
          for (const ic of indirectCosts) {
            const amount = Number(ic.amount) || 0;
            if (amount <= 0) continue;
            let value = amount;
            if (ic.cost_type === "percentage_payroll" && !isLegacyAbsolutePercentageValue(amount)) {
              const collaboratorName = parseIndirectCollaboratorName(ic.notes);
              const salary = collaboratorName ? (salaryByCollaboratorName.get(collaboratorName.toLowerCase()) ?? 0) : 0;
              value =
                salary > 0
                  ? (isIntegralSingleProjectIndirect(ic.notes) || scopedProjects.filter((p) => p.status === "active").length <= 1
                      ? salary
                      : salary * (amount / 100))
                  : 0;
            }
            indirectByProject.set(ic.project_id, (indirectByProject.get(ic.project_id) ?? 0) + value);
          }

          let revenueTotal = 0;
          let directTotal = 0;
          let indirectTotal = 0;
          for (const pid of projectIds) {
            revenueTotal += budgetByProject.get(pid) ?? 0;
            directTotal += directByProject.get(pid) ?? 0;
            indirectTotal += indirectByProject.get(pid) ?? 0;
          }
          const marginPct = revenueTotal > 0 ? ((revenueTotal - directTotal - indirectTotal) / revenueTotal) * 100 : 0;

          dynamicStats.push({
            label: "Margem operacional do portfolio",
            value: fmtPct(marginPct),
            hint: `Receita ${fmtMoney(revenueTotal)} | Diretos ${fmtMoney(directTotal)} | Indiretos ${fmtMoney(indirectTotal)}`,
            tone: toneFromPercent(marginPct, { goodMin: 30, warnMin: 15 }),
          });

          const collabProfit = new Map<string, { revenue: number; cost: number }>();
          for (const a of allocations) {
            const pct = Math.max(0, Number(a.allocation_pct) || 0) / 100;
            if (pct <= 0) continue;
            const rev = (budgetByProject.get(a.project_id) ?? 0) * pct;
            const cst = ((directByProject.get(a.project_id) ?? 0) + (indirectByProject.get(a.project_id) ?? 0)) * pct;
            const prev = collabProfit.get(a.user_id) ?? { revenue: 0, cost: 0 };
            prev.revenue += rev;
            prev.cost += cst;
            collabProfit.set(a.user_id, prev);
          }

          const collabIndex = Array.from(rankByUser.entries()).map(([uid, agg]) => {
            const hasProductivityBase = agg.docs > 0;
            const docs = Math.max(agg.docs, 1);
            const productivityPct = (agg.productivity / docs) * 100;
            const p = collabProfit.get(uid);
            const margin = p && p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0;
            const idx = hasProductivityBase ? (p ? productivityPct * 0.5 + margin * 0.5 : productivityPct) : null;
            return { uid, idx, productivityPct, margin, hasProductivityBase };
          });

          collabIndex.sort((a, b) => Number(b.idx ?? -1) - Number(a.idx ?? -1));
          const bestCollab = collabIndex[0];
          if (bestCollab) {
            dynamicStats.push({
              label: "Top performer (produtividade + margem)",
              value: bestCollab.hasProductivityBase ? fmtPct(bestCollab.idx ?? 0) : "Sem base",
              hint: bestCollab.hasProductivityBase
                ? `${profileById[bestCollab.uid]?.name ?? "Colaborador sem nome"} | Prod ${fmtPct(
                    bestCollab.productivityPct
                  )} | Lucr ${fmtPct(bestCollab.margin)}`
                : "Sem base de produtividade no recorte para compor ranking.",
              tone: bestCollab.hasProductivityBase ? toneFromPercent(bestCollab.idx ?? 0, { goodMin: 75, warnMin: 60 }) : "neutral",
            });
          }
        }
      }

      const resolvedTickets = tickets.filter((t) => isResolvedStatus(t.status));
      const overdueOpenTickets = tickets.filter((t) => {
        if (t.status === "resolved" || t.status === "cancelled") return false;
        return !!t.due_at && t.due_at < nowIso;
      }).length;
      const onTimeTickets = resolvedTickets.filter((t) => !t.due_at || (t.resolved_at && t.resolved_at <= t.due_at)).length;
      const slaRate = resolvedTickets.length ? Math.round((onTimeTickets / resolvedTickets.length) * 100) : 100;

      const totalDeliverables = deliverables.length;
      const approvedDeliverables = deliverables.filter((d) => rules.approvedDeliverableStatuses.includes(d.status)).length;
      const overdueDeliverables = deliverables.filter(
        (d) => !rules.approvedDeliverableStatuses.includes(d.status) && !!d.due_date && d.due_date < todayIso
      ).length;
      const deliveryRate = totalDeliverables ? Math.round((approvedDeliverables / totalDeliverables) * 100) : 0;

      const pendingRequests = requests.filter((r) => rules.pendingRequestStatuses.includes(r.status)).length;
      const overdueRequests = requests.filter(
        (r) =>
          rules.pendingRequestStatuses.includes(r.status) &&
          hoursDiff(r.created_at, nowIso) > slaHours
      ).length;

      const pendingAbsences = absences.filter((a) => a.status === "pending_manager").length;
      const approvedUpcomingAbsences = absences.filter((a) => a.status === "approved" && a.start_date >= todayIso).length;

      const projectTotal = projectCountActive + projectCountPaused + projectCountDone;
      const requestScore = pendingRequests > 0 ? Math.max(0, Math.round((1 - overdueRequests / pendingRequests) * 100)) : 100;
      const absenceBase = pendingAbsences + approvedUpcomingAbsences;
      const absenceScore = absenceBase > 0 ? Math.max(0, Math.round((approvedUpcomingAbsences / absenceBase) * 100)) : 100;
      const totalWeight =
        rules.weights.tickets + rules.weights.deliveries + rules.weights.requests + rules.weights.absences;
      const weightedScore = Math.round(
        (slaRate * rules.weights.tickets +
          deliveryRate * rules.weights.deliveries +
          requestScore * rules.weights.requests +
          absenceScore * rules.weights.absences) /
          Math.max(1, totalWeight)
      );

      setStats([
        {
          label: "SLA de chamados",
          value: `${slaRate}%`,
          hint: `${overdueOpenTickets} em atraso na fila · score ponderado ${weightedScore}%`,
          tone: toneFromPercent(slaRate, rules.ticketSla),
        },
        {
          label: "Entregas",
          value: `${deliveryRate}%`,
          hint: `${approvedDeliverables}/${totalDeliverables} aprovadas · ${overdueDeliverables} atrasadas`,
          tone: toneFromPercent(deliveryRate, rules.deliverySla),
        },
        {
          label: "Projetos acompanhados",
          value: String(projectTotal),
          hint: `${projectCountActive} ativos · ${projectCountPaused} pausados · ${projectCountDone} concluídos`,
        },
        {
          label: "Solicitações",
          value: String(pendingRequests),
          hint: `${overdueRequests} acima do SLA de ${slaHours}h`,
          tone: toneFromCount(overdueRequests, rules.requestOverdue.warnFrom, rules.requestOverdue.dangerFrom),
        },
        {
          label: "Ausências programadas",
          value: String(pendingAbsences),
          hint: `${approvedUpcomingAbsences} aprovações futuras já confirmadas`,
          tone: toneFromCount(pendingAbsences, rules.absencePending.warnFrom, rules.absencePending.dangerFrom),
        },
        {
          label: extraLabel,
          value: extraValue,
          hint: extraHint,
          tone: extraTone,
        },
        ...dynamicStats,
      ]);
      setRankingItems(nextRankingItems);
    } catch (e: unknown) {
      setStats([]);
      setRankingItems([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector, rankingWindowDays]);

  const hasStats = useMemo(() => stats.length > 0, [stats]);
  const isFinance = sector === "financeiro";

  return (
    <div className="space-y-6">
      <div className={isFinance ? "rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-900 p-6 text-white shadow-sm" : "rounded-2xl border border-slate-200 bg-white p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {isFinance ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">Financeiro</p> : null}
            <h1 className={`text-xl font-semibold ${isFinance ? "text-white" : "text-slate-900"}`}>{cfg.title}</h1>
            <p className={`mt-1 text-sm ${isFinance ? "text-blue-100/90" : "text-slate-600"}`}>{cfg.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={isFinance ? "inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60" : "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"}
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hasStats
          ? stats.map((s) => (
              <div key={s.label} className={`rounded-2xl border p-5 ${isFinance ? financeToneClass(s.tone) : toneClass(s.tone)} ${isFinance ? "shadow-sm" : ""}`}>
                {isFinance ? (
                  <div
                    className={`mb-3 h-1.5 rounded-full ${
                      s.tone === "good"
                        ? "bg-emerald-500"
                        : s.tone === "warn"
                          ? "bg-amber-500"
                          : s.tone === "danger"
                            ? "bg-rose-500"
                            : "bg-indigo-500"
                    }`}
                  />
                ) : null}
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{s.value}</p>
                {s.hint ? <p className="mt-1 text-sm text-slate-600">{s.hint}</p> : null}
                {s.lines?.length ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    {s.lines.map((line) => (
                      line.href ? (
                        <Link key={line.text} href={line.href} className="block hover:underline">
                          {line.text}
                        </Link>
                      ) : (
                        <p key={line.text}>{line.text}</p>
                      )
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                <p className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-200" />
                <p className="mt-3 h-3 w-40 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
      </div>

      <div className={isFinance ? "rounded-3xl border border-indigo-200 bg-gradient-to-b from-white to-indigo-50/40 p-6" : "rounded-2xl border border-slate-200 bg-white p-6"}>
        <p className="text-sm font-semibold text-slate-900">Acessos rápidos</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cfg.links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isFinance ? "rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-950 transition hover:border-indigo-300 hover:bg-indigo-50" : "rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {sector === "coordenador" || sector === "gestor" || sector === "diretoria" ? (
          <details className="mt-4 rounded-xl border border-slate-200">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">
              Ranking de colaboradores (produtividade + qualidade)
            </summary>
            <div className="space-y-2 border-t border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="px-1 text-xs text-slate-500">Janela do ranking</p>
                <select
                  value={rankingWindowDays}
                  onChange={(e) => setRankingWindowDays(e.target.value as "30" | "90" | "365" | "all")}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                >
                  <option value="30">Ultimos 30 dias</option>
                  <option value="90">Ultimos 90 dias</option>
                  <option value="365">Ultimos 12 meses</option>
                  <option value="all">Todo o historico</option>
                </select>
              </div>
              <p className="px-1 text-xs text-slate-500">
                Critério: aprovado no prazo, sem retorno para ajuste e sem aprovação com comentários.
              </p>
              {rankingItems.length ? (
                rankingItems.map((item, index) => (
                  <Link
                    key={item.uid}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      {item.avatarUrl ? (
                        <Image
                          src={item.avatarUrl}
                          alt={item.name}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                          {initialsFromName(item.name)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {index + 1}. {item.name}
                        </p>
                        <p className="text-xs text-slate-600">
                          P: {fmtPct(item.productivityPct)} | Q: {fmtPct(item.qualityPct)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Sem retrabalho: {item.cleanApprovedDocs}/{item.totalDocs} | Retrabalho: {item.reworkDocs}
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-sm font-semibold text-slate-900"
                      title={item.hasProductivityBase ? undefined : "Sem base de entregaveis avaliados no periodo para calcular o indice."}
                    >
                      {item.hasProductivityBase ? fmtPct(item.finalScore ?? 0) : "Sem base"}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                      00
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">1. Sem dados</p>
                      <p className="text-xs text-slate-600">P: 0% | Q: 0%</p>
                      <p className="text-xs text-slate-500">Sem retrabalho: 0/0 | Retrabalho: 0</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">0%</p>
                </div>
              )}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}


