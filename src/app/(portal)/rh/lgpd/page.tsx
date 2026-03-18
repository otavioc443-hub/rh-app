"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestType = "access" | "correction" | "deletion" | "opposition" | "portability" | "review" | "information" | "other";
type RequestStatus = "pending" | "in_review" | "approved" | "rejected" | "implemented" | "cancelled";

type LgpdRequestRow = {
  id: string;
  requester_user_id: string;
  request_type: RequestType;
  title: string;
  details: string;
  status: RequestStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AuditRow = {
  id: string;
  request_id: string;
  actor_user_id: string;
  actor_role: string | null;
  status_from: string | null;
  status_to: string;
  notes: string | null;
  created_at: string;
};

function requestTypeLabel(value: RequestType) {
  if (value === "access") return "Acesso";
  if (value === "correction") return "Correcao";
  if (value === "deletion") return "Eliminacao";
  if (value === "opposition") return "Oposicao";
  if (value === "portability") return "Portabilidade";
  if (value === "review") return "Revisao";
  if (value === "information") return "Informacoes";
  return "Outro";
}

function statusLabel(status: RequestStatus) {
  if (status === "pending") return "Pendente";
  if (status === "in_review") return "Em analise";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "implemented") return "Concluida";
  return "Cancelada";
}

function statusClass(status: RequestStatus) {
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "in_review") return "bg-sky-50 text-sky-700";
  if (status === "approved" || status === "implemented") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export default function RhLgpdPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<LgpdRequestRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");
  const [decisionStatus, setDecisionStatus] = useState<RequestStatus>("in_review");
  const [decisionNotes, setDecisionNotes] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const res = await supabase
        .from("lgpd_requests")
        .select("id,requester_user_id,request_type,title,details,status,review_notes,reviewed_by,reviewed_at,created_at")
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);

      const nextRows = (res.data ?? []) as LgpdRequestRow[];
      setRows(nextRows);

      const ids = Array.from(new Set(nextRows.flatMap((row) => [row.requester_user_id, row.reviewed_by ?? ""]).filter(Boolean)));
      if (ids.length) {
        const profileRes = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        if (profileRes.error) throw new Error(profileRes.error.message);
        const nextProfiles: Record<string, ProfileRow> = {};
        for (const row of (profileRes.data ?? []) as ProfileRow[]) nextProfiles[row.id] = row;
        setProfiles(nextProfiles);
      } else {
        setProfiles({});
      }

      setSelectedId((prev) => (prev && nextRows.some((row) => row.id === prev) ? prev : nextRows[0]?.id ?? ""));
    } catch (error) {
      setRows([]);
      setProfiles({});
      setSelectedId("");
      setMessage(error instanceof Error ? error.message : "Erro ao carregar fila LGPD.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAudit(requestId: string) {
    if (!requestId) {
      setAuditRows([]);
      return;
    }
    const res = await supabase
      .from("lgpd_request_audit")
      .select("id,request_id,actor_user_id,actor_role,status_from,status_to,notes,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    if (res.error) {
      setAuditRows([]);
      setMessage(res.error.message);
      return;
    }
    setAuditRows((res.data ?? []) as AuditRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const selected = rows.find((row) => row.id === selectedId);
    if (!selected) {
      setAuditRows([]);
      return;
    }
    setDecisionStatus(selected.status === "cancelled" ? "in_review" : selected.status);
    setDecisionNotes(selected.review_notes ?? "");
    void loadAudit(selected.id);
  }, [rows, selectedId]);

  const filteredRows = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter)),
    [rows, statusFilter]
  );

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  async function saveDecision() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const authRes = await supabase.auth.getUser();
      const actor = authRes.data.user;
      if (!actor) throw new Error("Sessao invalida. Faca login novamente.");

      const roleRes = await supabase.rpc("current_role");
      const actorRole = roleRes.error ? null : String(roleRes.data ?? "");

      const updateRes = await supabase
        .from("lgpd_requests")
        .update({
          status: decisionStatus,
          review_notes: decisionNotes.trim() || null,
          reviewed_by: actor.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (updateRes.error) throw new Error(updateRes.error.message);

      const auditRes = await supabase.from("lgpd_request_audit").insert({
        request_id: selected.id,
        requester_user_id: selected.requester_user_id,
        actor_user_id: actor.id,
        actor_role: actorRole,
        status_from: selected.status,
        status_to: decisionStatus,
        notes: decisionNotes.trim() || null,
      });
      if (auditRes.error) throw new Error(auditRes.error.message);

      setMessage("Analise LGPD registrada.");
      await load();
      await loadAudit(selected.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar analise.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Fila LGPD</h1>
            <p className="mt-1 text-sm text-slate-600">Acompanhe e registre a analise de solicitacoes de titulares.</p>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="grid max-w-xs gap-1 text-xs font-semibold text-slate-700">
          Filtrar por status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | RequestStatus)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="in_review">Em analise</option>
            <option value="approved">Aprovada</option>
            <option value="rejected">Recusada</option>
            <option value="implemented">Concluida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
      </div>

      {message ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-3">Solicitacao</th>
                  <th className="p-3">Titular</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-slate-500">Carregando...</td>
                  </tr>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => {
                    const requester = profiles[row.requester_user_id];
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-t ${selectedId === row.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="p-3">
                          <p className="font-semibold text-slate-900">{row.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-slate-600">{row.details}</p>
                        </td>
                        <td className="p-3">{requester?.full_name || requester?.email || row.requester_user_id}</td>
                        <td className="p-3">{requestTypeLabel(row.request_type)}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="p-3">{formatDate(row.created_at)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-3 text-slate-500">Nenhuma solicitacao LGPD encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck size={16} />
              Analise da solicitacao
            </div>

            {selected ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{selected.title}</p>
                  <p className="mt-2 text-slate-700">{selected.details}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Titular: {profiles[selected.requester_user_id]?.full_name || profiles[selected.requester_user_id]?.email || selected.requester_user_id}
                  </p>
                </div>

                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                  Novo status
                  <select
                    value={decisionStatus}
                    onChange={(event) => setDecisionStatus(event.target.value as RequestStatus)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="in_review">Em analise</option>
                    <option value="approved">Aprovada</option>
                    <option value="rejected">Recusada</option>
                    <option value="implemented">Concluida</option>
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                  Notas da analise
                  <textarea
                    value={decisionNotes}
                    onChange={(event) => setDecisionNotes(event.target.value)}
                    className="min-h-[120px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void saveDecision()}
                  disabled={saving}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Registrar analise"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Selecione uma solicitacao para analisar.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Auditoria</p>
            <div className="mt-3 space-y-2">
              {auditRows.length ? (
                auditRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {row.status_from ?? "-"} {"->"} {row.status_to}
                    </p>
                    <p className="mt-1">{profiles[row.actor_user_id]?.full_name || profiles[row.actor_user_id]?.email || row.actor_user_id}</p>
                    <p className="mt-1">{formatDate(row.created_at)}</p>
                    {row.notes ? <p className="mt-1">{row.notes}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">Sem eventos de auditoria para esta solicitacao.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
