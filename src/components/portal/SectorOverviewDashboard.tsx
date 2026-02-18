"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
};

type PdDeliverableRow = {
  id: string;
  project_id: string;
  status: DeliverableStatus;
  due_date: string | null;
};

type ProjectStatus = "planning" | "active" | "paused" | "done" | "cancelled";

type ProjectRow = {
  id: string;
  status: ProjectStatus;
  owner_user_id: string;
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
  tone?: "neutral" | "good" | "warn" | "danger";
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

function toneClass(tone: Stat["tone"]) {
  if (tone === "good") return "border-emerald-200 bg-emerald-50/70";
  if (tone === "warn") return "border-amber-200 bg-amber-50/70";
  if (tone === "danger") return "border-rose-200 bg-rose-50/70";
  return "border-slate-200 bg-white";
}

const DASHBOARD_CONFIG: Record<SectorKey, { title: string; subtitle: string; links: LinkItem[] }> = {
  coordenador: {
    title: "Painel do Coordenador",
    subtitle: "SLA de chamados, entregas, projetos, solicitações e acompanhamento da equipe.",
    links: [
      { href: "/coordenador/projetos", label: "Projetos" },
      { href: "/coordenador/feedback", label: "Feedbacks" },
      { href: "/p-d/chamados", label: "Chamados P&D" },
      { href: "/agenda", label: "Agenda e Ausências" },
    ],
  },
  gestor: {
    title: "Painel do Gestor",
    subtitle: "Visão consolidada dos indicadores críticos do setor e aprovações pendentes.",
    links: [
      { href: "/gestor/projetos", label: "Projetos" },
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

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const todayIso = nowIso.slice(0, 10);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      const userId = authData.user.id;

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
      let projectCountActive = 0;
      let projectCountPaused = 0;
      let projectCountDone = 0;

      let deliverables: Array<DeliverableRow | PdDeliverableRow> = [];

      if (sector === "pd") {
        try {
          const [pr, dr] = await Promise.all([
            supabase.from("pd_projects").select("id,status"),
            supabase.from("pd_project_deliverables").select("id,project_id,status,due_date"),
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
            supabase.from("projects").select("id,status,owner_user_id"),
            supabase.from("project_members").select("project_id,user_id,member_role").eq("user_id", userId),
          ]);
          const projects = (pr.data ?? []) as ProjectRow[];
          const memberships = (mr.data ?? []) as Array<{ project_id: string; user_id: string; member_role: string }>;

          if (sector === "gestor" || sector === "coordenador") {
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
          projectCountActive = scoped.filter((p) => p.status === "active").length;
          projectCountPaused = scoped.filter((p) => p.status === "paused").length;
          projectCountDone = scoped.filter((p) => p.status === "done").length;

          if (projectIds.length > 0) {
            const dr = await supabase
              .from("project_deliverables")
              .select("id,project_id,status,due_date")
              .in("project_id", projectIds);
            if (!dr.error) deliverables = (dr.data ?? []) as DeliverableRow[];
          }
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

      if (sector === "coordenador") {
        extraLabel = "Entregas da coordenação";
        const mine = (deliverables as DeliverableRow[]).filter(
          (d) => !rules.approvedDeliverableStatuses.includes(d.status) && d.due_date && d.due_date <= todayIso
        ).length;
        extraValue = String(mine);
        extraHint = "Itens em atraso no escopo acompanhado";
        extraTone = mine > 0 ? "warn" : "good";
      }

      if (sector === "gestor") {
        extraLabel = "Pagamentos extras pendentes";
        let pending = 0;
        try {
          const pr = projectIds.length
            ? await supabase
                .from("project_extra_payments")
                .select("id,status,project_id")
                .in("project_id", projectIds)
            : { data: [], error: null };
          if (!pr.error) pending = ((pr.data ?? []) as Array<{ status: string }>).filter((x) => x.status === "pending").length;
        } catch {}
        extraValue = String(pending);
        extraHint = "Aguardando decisão do gestor";
        extraTone = pending > 0 ? "warn" : "good";
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
      ]);
    } catch (e: unknown) {
      setStats([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);

  const hasStats = useMemo(() => stats.length > 0, [stats]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{cfg.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{cfg.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
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
              <div key={s.label} className={`rounded-2xl border p-5 ${toneClass(s.tone)}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{s.value}</p>
                {s.hint ? <p className="mt-1 text-sm text-slate-600">{s.hint}</p> : null}
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Acessos rápidos</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cfg.links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
