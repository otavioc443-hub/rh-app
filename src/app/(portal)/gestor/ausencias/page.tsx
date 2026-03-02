"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCcw, Users, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Colaborador = {
  id: string;
  user_id: string | null;
  nome: string | null;
  is_active: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  manager_id: string | null;
  active: boolean | null;
};

type AllowanceRow = {
  id: string;
  user_id: string | null;
  collaborator_id: string | null;
  valid_from: string;
  valid_to: string;
  max_days: number | null;
  window_start: string | null;
  window_end: string | null;
  days_allowed: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
};

type AbsenceRequestRow = {
  id: string;
  user_id: string;
  manager_id: string;
  allowance_id: string | null;
  start_date: string;
  end_date: string;
  days_count: number | null;
  reason: string | null;
  status: "pending_manager" | "approved" | "rejected" | "cancelled";
  manager_comment: string | null;
  created_at: string;
  updated_at: string | null;
};

type ProjectMemberRow = {
  project_id: string;
  user_id: string;
  member_role: "gestor" | "coordenador" | "colaborador" | string;
};

type TeamAvailabilityRow = {
  user_id: string;
  collaborator_id: string | null;
  nome: string;
  allowanceId: string;
  windowStart: string;
  windowEnd: string;
  daysAllowed: number;
  approvedUsed: number;
  pendingDays: number;
  remaining: number;
  isActive: boolean;
  lastUpdatedAt: string | null;
};

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function fmtDateBR(iso: string | null | undefined) {
  if (!iso) return "-";
  const raw = String(iso).slice(0, 10);
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

function fmtDateTimeBR(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function statusLabel(status: AbsenceRequestRow["status"]) {
  if (status === "pending_manager") return "Pendente";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "cancelled") return "Cancelada";
  return status;
}

function statusClass(status: AbsenceRequestRow["status"]) {
  if (status === "pending_manager") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function GestorAusenciasPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string | null>(null);

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [allowances, setAllowances] = useState<AllowanceRow[]>([]);
  const [requests, setRequests] = useState<AbsenceRequestRow[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberRow[]>([]);
  const [decisionCommentById, setDecisionCommentById] = useState<Record<string, string>>({});
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | AbsenceRequestRow["status"]>("all");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      const userId = authData.user.id;
      setMeId(userId);

      const [profilesRes, collabRes, allowancesRes, requestsRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,role,manager_id,active"),
        supabase.from("colaboradores").select("id,user_id,nome,is_active").eq("is_active", true).order("nome", { ascending: true }),
        supabase
          .from("absence_allowances")
          .select("id,user_id,collaborator_id,valid_from,valid_to,max_days,window_start,window_end,days_allowed,is_active,created_at,updated_at,created_by")
          .order("created_at", { ascending: false }),
        supabase
          .from("absence_requests")
          .select("id,user_id,manager_id,allowance_id,start_date,end_date,days_count,reason,status,manager_comment,created_at,updated_at")
          .order("created_at", { ascending: false }),
        supabase.from("project_members").select("project_id,user_id,member_role"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (collabRes.error) throw collabRes.error;
      if (allowancesRes.error) throw allowancesRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (membersRes.error) throw membersRes.error;

      setProfiles((profilesRes.data ?? []) as ProfileRow[]);
      setColaboradores((collabRes.data ?? []) as Colaborador[]);
      setAllowances((allowancesRes.data ?? []) as AllowanceRow[]);
      setRequests((requestsRes.data ?? []) as AbsenceRequestRow[]);
      setProjectMembers((membersRes.data ?? []) as ProjectMemberRow[]);
      const myProfile = ((profilesRes.data ?? []) as ProfileRow[]).find((p) => p.id === userId) ?? null;
      setMeRole(myProfile?.role ?? null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar ausencias da equipe.");
      setProfiles([]);
      setColaboradores([]);
      setAllowances([]);
      setRequests([]);
      setProjectMembers([]);
      setMeRole(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const directReportUserIds = useMemo(() => {
    if (!meId) return new Set<string>();
    return new Set(
      profiles
        .filter((p) => p.active !== false && p.manager_id === meId)
        .map((p) => p.id)
    );
  }, [profiles, meId]);

  const collabByUserId = useMemo(() => {
    const map = new Map<string, Colaborador>();
    for (const c of colaboradores) {
      if (c.user_id) map.set(c.user_id, c);
    }
    return map;
  }, [colaboradores]);

  const collabById = useMemo(() => {
    const map = new Map<string, Colaborador>();
    for (const c of colaboradores) map.set(c.id, c);
    return map;
  }, [colaboradores]);

  const profileNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      const n = (p.full_name ?? "").trim();
      map.set(p.id, n && !n.includes("@") ? n : "Usuario sem nome");
    }
    return map;
  }, [profiles]);

  const teamUserIds = useMemo(() => {
    const ids = new Set<string>();
    const projectIdsByMeAsGestor = new Set<string>();
    const isWideViewer = meRole === "admin" || meRole === "rh" || meRole === "diretoria";
    for (const pm of projectMembers) {
      if (
        meId &&
        pm.user_id === meId &&
        (pm.member_role === "gestor" || pm.member_role === "coordenador")
      ) {
        projectIdsByMeAsGestor.add(pm.project_id);
      }
    }
    if (isWideViewer && projectIdsByMeAsGestor.size === 0) {
      for (const pm of projectMembers) {
        if (pm.member_role === "colaborador" || pm.member_role === "coordenador") ids.add(pm.user_id);
      }
    }
    for (const pm of projectMembers) {
      if (!projectIdsByMeAsGestor.has(pm.project_id)) continue;
      if (pm.user_id === meId) continue;
      if (pm.member_role === "colaborador" || pm.member_role === "coordenador") {
        ids.add(pm.user_id);
      }
    }
    for (const uid of directReportUserIds) ids.add(uid);
    for (const r of requests) {
      if (meId && r.manager_id === meId) ids.add(r.user_id);
    }
    for (const a of allowances) {
      if (!a.user_id) continue;
      if (directReportUserIds.has(a.user_id)) ids.add(a.user_id);
    }
    return ids;
  }, [directReportUserIds, requests, allowances, meId, meRole, projectMembers]);

  const teamCollaboratorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const uid of teamUserIds) {
      const c = collabByUserId.get(uid);
      if (c?.id) ids.add(c.id);
    }
    return ids;
  }, [teamUserIds, collabByUserId]);

  const scopedRequests = useMemo(() => {
    if (!meId) return [] as AbsenceRequestRow[];
    return requests.filter((r) => r.manager_id === meId || teamUserIds.has(r.user_id));
  }, [requests, meId, teamUserIds]);

  const pendingRequests = useMemo(
    () => scopedRequests.filter((r) => r.status === "pending_manager"),
    [scopedRequests]
  );
  const filteredRequests = useMemo(() => {
    const base = requestStatusFilter === "all"
      ? scopedRequests
      : scopedRequests.filter((r) => r.status === requestStatusFilter);
    return [...base].sort((a, b) => {
      const statusOrder = (s: AbsenceRequestRow["status"]) =>
        s === "pending_manager" ? 0 : s === "rejected" ? 1 : s === "approved" ? 2 : 3;
      const diff = statusOrder(a.status) - statusOrder(b.status);
      if (diff !== 0) return diff;
      return (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at);
    });
  }, [scopedRequests, requestStatusFilter]);

  const today = useMemo(() => new Date(), []);
  const plus30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }, []);

  const approved30 = useMemo(() => {
    return scopedRequests.filter((r) => {
      if (r.status !== "approved") return false;
      const start = new Date(`${r.start_date}T00:00:00`);
      return start <= plus30;
    }).length;
  }, [scopedRequests, plus30]);

  const rejected30 = useMemo(() => {
    return scopedRequests.filter((r) => {
      if (r.status !== "rejected") return false;
      const created = new Date(r.created_at);
      const diff = (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 30;
    }).length;
  }, [scopedRequests, today]);

  const availabilityRows = useMemo<TeamAvailabilityRow[]>(() => {
    const latestAllowanceByUser = new Map<string, AllowanceRow>();
    for (const a of allowances) {
      const belongsToTeam =
        (!!a.user_id && teamUserIds.has(a.user_id)) ||
        (!!a.collaborator_id && teamCollaboratorIds.has(a.collaborator_id));
      if (!belongsToTeam) continue;
      if (!a.is_active) continue;
      const allowanceUserId = a.user_id ?? collabById.get(a.collaborator_id ?? "")?.user_id ?? null;
      if (!allowanceUserId) continue;
      if (!latestAllowanceByUser.has(allowanceUserId)) latestAllowanceByUser.set(allowanceUserId, a);
    }

    const rows: TeamAvailabilityRow[] = [];
    for (const [userId, a] of latestAllowanceByUser.entries()) {
      const userRequests = scopedRequests.filter((r) => r.user_id === userId);
      const approvedUsed = userRequests
        .filter((r) => r.status === "approved")
        .reduce((acc, r) => acc + (Number(r.days_count) || 0), 0);
      const pendingDays = userRequests
        .filter((r) => r.status === "pending_manager")
        .reduce((acc, r) => acc + (Number(r.days_count) || 0), 0);
      const daysAllowed = Number(a.days_allowed ?? a.max_days ?? 0) || 0;
      const collab = collabByUserId.get(userId);
      const nome =
        (collab?.nome ?? "").trim() ||
        profileNameById.get(userId) ||
        "Colaborador sem nome";
      rows.push({
        user_id: userId,
        collaborator_id: a.collaborator_id ?? collab?.id ?? null,
        nome,
        allowanceId: a.id,
        windowStart: (a.window_start ?? a.valid_from ?? "").slice(0, 10),
        windowEnd: (a.window_end ?? a.valid_to ?? "").slice(0, 10),
        daysAllowed,
        approvedUsed,
        pendingDays,
        remaining: Math.max(0, daysAllowed - approvedUsed),
        isActive: !!a.is_active,
        lastUpdatedAt: a.updated_at ?? a.created_at,
      });
    }

    return rows.sort((a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining; // menor saldo primeiro
      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });
  }, [allowances, teamUserIds, teamCollaboratorIds, scopedRequests, collabByUserId, collabById, profileNameById]);

  const totalAvailableCollaborators = availabilityRows.length;

  async function handleDecision(requestId: string, nextStatus: "approved" | "rejected") {
    setMsg("");
    setActingRequestId(requestId);
    try {
      const manager_comment = (decisionCommentById[requestId] ?? "").trim() || null;
      const { error } = await supabase
        .from("absence_requests")
        .update({ status: nextStatus, manager_comment, decided_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("status", "pending_manager");
      if (error) throw error;
      const reqRow = pendingRequests.find((r) => r.id === requestId);
      if (reqRow) {
        await fetch("/api/ausencias/requests/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: nextStatus === "approved" ? "approved" : "rejected",
            requests: [{ ...reqRow, manager_comment }],
          }),
        }).catch(() => null);
      }
      setDecisionCommentById((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setMsg(nextStatus === "approved" ? "Solicitacao aprovada com sucesso." : "Solicitacao recusada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao decidir solicitacao.");
    } finally {
      setActingRequestId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Ausências (Gestor)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Acompanhe solicitações da equipe e colaboradores com período de ausência liberado pelo RH.
            </p>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Pendentes" value={loading ? "..." : String(pendingRequests.length)} icon={Clock3} />
        <KpiCard label="Aprovadas (30 dias)" value={loading ? "..." : String(approved30)} icon={CheckCircle2} />
        <KpiCard label="Recusadas (30 dias)" value={loading ? "..." : String(rejected30)} icon={XCircle} />
        <KpiCard
          label="Colaboradores com dias disponíveis"
          value={loading ? "..." : String(totalAvailableCollaborators)}
          icon={Users}
          hint="Com liberação ativa cadastrada pelo RH"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Solicitacoes da equipe</p>
            <p className="mt-1 text-sm text-slate-600">
              Lista unica com pendentes, aprovadas, recusadas e canceladas. Acoes ficam disponiveis apenas nas pendentes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={requestStatusFilter}
              onChange={(e) => setRequestStatusFilter(e.target.value as "all" | AbsenceRequestRow["status"])}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos status</option>
              <option value="pending_manager">Pendentes</option>
              <option value="rejected">Recusadas</option>
              <option value="approved">Aprovadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
              <Users size={18} />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Período</th>
                <th className="p-3">Dias</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Comentario</th>
                <th className="p-3">Status</th>
                <th className="p-3">Criada em</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length ? (
                filteredRequests.map((r) => {
                  const nome =
                    collabByUserId.get(r.user_id)?.nome?.trim() ||
                    profileNameById.get(r.user_id) ||
                    "Colaborador sem nome";
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 font-medium text-slate-900">{nome}</td>
                      <td className="p-3">{fmtDateBR(r.start_date)} até {fmtDateBR(r.end_date)}</td>
                      <td className="p-3">{Number(r.days_count ?? 0) || 0}</td>
                      <td className="p-3 text-slate-700">{(r.reason ?? "").trim() || "-"}</td>
                      <td className="p-3">
                        {r.status === "pending_manager" ? (
                          <input
                            type="text"
                            value={decisionCommentById[r.id] ?? ""}
                            onChange={(e) => setDecisionCommentById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder="Comentario do gestor (opcional)"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                          />
                        ) : (
                          <span className={r.status === "rejected" ? "inline-flex rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700" : "text-slate-600"}>
                            {(r.manager_comment ?? "").trim() || "-"}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">{fmtDateTimeBR(r.created_at)}</td>
                      <td className="p-3">
                        {r.status === "pending_manager" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={actingRequestId === r.id}
                              onClick={() => void handleDecision(r.id, "approved")}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              disabled={actingRequestId === r.id}
                              onClick={() => void handleDecision(r.id, "rejected")}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              Recusar
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-4 text-slate-500">
                    Nenhuma solicitação pendente no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Colaboradores com dias disponíveis</p>
            <p className="mt-1 text-sm text-slate-600">
              Liberações ativas de ausência programada e saldo disponível por colaborador da equipe.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Janela liberada</th>
                <th className="p-3 text-right">Dias liberados</th>
                <th className="p-3 text-right">Usados (aprov.)</th>
                <th className="p-3 text-right">Pendentes</th>
                <th className="p-3 text-right">Disponíveis</th>
                <th className="p-3">Status</th>
                <th className="p-3">Última atualização</th>
              </tr>
            </thead>
            <tbody>
              {availabilityRows.length ? (
                availabilityRows.map((row) => (
                  <tr key={row.allowanceId} className="border-t">
                    <td className="p-3 font-medium text-slate-900">{row.nome}</td>
                    <td className="p-3">{fmtDateBR(row.windowStart)} até {fmtDateBR(row.windowEnd)}</td>
                    <td className="p-3 text-right">{row.daysAllowed}</td>
                    <td className="p-3 text-right">{row.approvedUsed}</td>
                    <td className="p-3 text-right">{row.pendingDays}</td>
                    <td className={`p-3 text-right font-semibold ${row.remaining <= 0 ? "text-rose-700" : row.remaining <= 1 ? "text-amber-700" : "text-emerald-700"}`}>
                      {row.remaining}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {row.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">{fmtDateTimeBR(row.lastUpdatedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-4 text-slate-500">
                    Nenhum colaborador da sua equipe possui liberação ativa de ausência no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}
    </div>
  );
}
