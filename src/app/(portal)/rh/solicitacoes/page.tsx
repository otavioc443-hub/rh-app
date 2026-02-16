"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "implemented"
  | "cancelled";
type AssignedArea = "rh" | "financeiro";

type RequestType = "financial" | "personal" | "contractual" | "avatar" | "other";

type ProfileRequestRow = {
  id: string;
  requester_user_id: string;
  collaborator_id: string | null;
  request_type: RequestType;
  title: string;
  details: string;
  requested_changes: Record<string, unknown> | null;
  status: RequestStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type CollaboratorRow = {
  id: string;
  nome: string | null;
  empresa: string | null;
  departamento: string | null;
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

function statusLabel(status: RequestStatus) {
  if (status === "pending") return "Pendente";
  if (status === "in_review") return "Em analise";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "implemented") return "Implementada";
  return "Cancelada";
}

function statusClass(status: RequestStatus) {
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "in_review") return "bg-sky-50 text-sky-700";
  if (status === "approved" || status === "implemented") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function typeLabel(type: RequestType) {
  if (type === "financial") return "Financeiro";
  if (type === "personal") return "Pessoal";
  if (type === "contractual") return "Contratual";
  if (type === "avatar") return "Foto";
  return "Outro";
}

function fmtDate(dateIso: string | null) {
  if (!dateIso) return "-";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleString("pt-BR");
}

function hoursDiff(fromIso: string, toIso: string) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, (to - from) / (1000 * 60 * 60));
}

function deriveAssignedArea(row: Pick<ProfileRequestRow, "request_type" | "requested_changes">): AssignedArea {
  const explicit = row.requested_changes?.assigned_area;
  if (explicit === "rh" || explicit === "financeiro") return explicit;
  return row.request_type === "financial" ? "financeiro" : "rh";
}

export default function RhSolicitacoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [msg, setMsg] = useState("");
  const [slaHours, setSlaHours] = useState(72);

  const [rows, setRows] = useState<ProfileRequestRow[]>([]);
  const [colabById, setColabById] = useState<Record<string, CollaboratorRow>>({});
  const [profileById, setProfileById] = useState<Record<string, ProfileRow>>({});

  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | RequestType>("all");
  const [companyFilter, setCompanyFilter] = useState<"all" | string>("all");
  const [q, setQ] = useState("");

  const [selectedId, setSelectedId] = useState<string>("");
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [decisionStatus, setDecisionStatus] = useState<RequestStatus>("in_review");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [redirectArea, setRedirectArea] = useState<AssignedArea>("financeiro");
  const [redirectNotes, setRedirectNotes] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [reqRes, slaRes] = await Promise.all([
        supabase
          .from("profile_update_requests")
          .select(
            "id,requester_user_id,collaborator_id,request_type,title,details,requested_changes,status,review_notes,reviewed_by,reviewed_at,created_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("request_sla_settings")
          .select("sla_hours")
          .eq("config_key", "profile_update_requests")
          .maybeSingle<{ sla_hours: number }>(),
      ]);
      if (reqRes.error) throw new Error(reqRes.error.message);
      if (!slaRes.error && typeof slaRes.data?.sla_hours === "number") {
        setSlaHours(slaRes.data.sla_hours);
      }

      const nextRows = (reqRes.data ?? []) as ProfileRequestRow[];
      setRows(nextRows);

      const collaboratorIds = Array.from(
        new Set(nextRows.map((r) => (r.collaborator_id ? r.collaborator_id : "")).filter(Boolean))
      );
      const profileIds = Array.from(
        new Set(
          nextRows
            .flatMap((r) => [r.requester_user_id, r.reviewed_by ?? ""])
            .filter(Boolean)
        )
      );

      const [colabRes, profRes] = await Promise.all([
        collaboratorIds.length
          ? supabase.from("colaboradores").select("id,nome,empresa,departamento").in("id", collaboratorIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (colabRes.error) throw new Error(colabRes.error.message);
      if (profRes.error) throw new Error(profRes.error.message);

      const colabMap: Record<string, CollaboratorRow> = {};
      for (const c of (colabRes.data ?? []) as CollaboratorRow[]) colabMap[c.id] = c;
      setColabById(colabMap);

      const profileMap: Record<string, ProfileRow> = {};
      for (const p of (profRes.data ?? []) as ProfileRow[]) profileMap[p.id] = p;
      setProfileById(profileMap);

      const first = nextRows.find((r) => deriveAssignedArea(r) === "rh")?.id ?? "";
      setSelectedId((prev) => (prev && nextRows.some((r) => r.id === prev) ? prev : first));
    } catch (e: unknown) {
      setRows([]);
      setColabById({});
      setProfileById({});
      setSelectedId("");
      setMsg(e instanceof Error ? e.message : "Erro ao carregar solicitacoes.");
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
      .from("profile_update_request_audit")
      .select("id,request_id,actor_user_id,actor_role,status_from,status_to,notes,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (res.error) {
      const text = res.error.message.toLowerCase();
      const missing = text.includes("does not exist") || text.includes("relation") || text.includes("schema cache");
      if (missing) {
        setMsg(
          "Auditoria ainda nao disponivel. Rode supabase/sql/2026-02-16_create_profile_update_request_audit.sql."
        );
        setAuditRows([]);
      } else {
        setMsg(res.error.message);
        setAuditRows([]);
      }
      return;
    }
    setAuditRows((res.data ?? []) as AuditRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAuditRows([]);
      return;
    }
    const selected = rows.find((r) => r.id === selectedId);
    if (!selected) return;
    setDecisionStatus(selected.status);
    setDecisionNotes(selected.review_notes ?? "");
    setRedirectArea("financeiro");
    setRedirectNotes("");
    void loadAudit(selectedId);
  }, [selectedId, rows]);

  const scopedRows = useMemo(
    () => rows.filter((r) => deriveAssignedArea(r) === "rh"),
    [rows]
  );

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of scopedRows) {
      if (!r.collaborator_id) continue;
      const c = colabById[r.collaborator_id];
      const name = (c?.empresa ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [scopedRows, colabById]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scopedRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.request_type !== typeFilter) return false;
      const company = r.collaborator_id ? (colabById[r.collaborator_id]?.empresa ?? "") : "";
      if (companyFilter !== "all" && company !== companyFilter) return false;
      if (!term) return true;

      const requester = profileById[r.requester_user_id];
      const requesterName = requester?.full_name ?? requester?.email ?? "";
      const searchText = [
        r.title,
        r.details,
        requesterName,
        company,
        r.request_type,
        r.status,
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(term);
    });
  }, [scopedRows, statusFilter, typeFilter, companyFilter, q, profileById, colabById]);

  const selected = useMemo(() => scopedRows.find((r) => r.id === selectedId) ?? null, [scopedRows, selectedId]);

  const stats = useMemo(() => {
    const nowIso = new Date().toISOString();
    const overdue = scopedRows.filter((r) => {
      if (r.status !== "pending" && r.status !== "in_review") return false;
      return hoursDiff(r.created_at, nowIso) > slaHours;
    }).length;

    const resolved = scopedRows.filter((r) => r.reviewed_at && (r.status === "approved" || r.status === "rejected" || r.status === "implemented" || r.status === "cancelled"));
    const avgHours = resolved.length
      ? resolved.reduce((acc, r) => acc + hoursDiff(r.created_at, r.reviewed_at as string), 0) / resolved.length
      : 0;

    return {
      total: scopedRows.length,
      pending: scopedRows.filter((r) => r.status === "pending").length,
      in_review: scopedRows.filter((r) => r.status === "in_review").length,
      done: scopedRows.filter((r) => r.status === "approved" || r.status === "implemented").length,
      rejected: scopedRows.filter((r) => r.status === "rejected").length,
      overdue,
      avgHours,
    };
  }, [scopedRows, slaHours]);

  function exportCsv() {
    const header = ["id", "titulo", "tipo", "status", "colaborador", "empresa", "criada_em", "revisada_em"];
    const lines = filtered.map((r) => {
      const requester = profileById[r.requester_user_id];
      const requesterLabel = requester?.full_name || requester?.email || r.requester_user_id;
      const company = r.collaborator_id ? (colabById[r.collaborator_id]?.empresa || "") : "";
      return [
        r.id,
        r.title,
        typeLabel(r.request_type),
        statusLabel(r.status),
        requesterLabel,
        company,
        fmtDate(r.created_at),
        fmtDate(r.reviewed_at),
      ];
    });

    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rh-solicitacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function decide() {
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/rh/profile-update-requests/${selected.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: decisionStatus,
          review_notes: decisionNotes.trim() || null,
        }),
      });
      const text = await res.text();
      let json: { error?: string } = {};
      try {
        json = JSON.parse(text) as { error?: string };
      } catch {}
      if (!res.ok) throw new Error(json.error ?? text ?? "Falha ao salvar decisao.");

      setMsg("Decisao registrada.");
      await load();
      await loadAudit(selected.id);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar decisao.");
    } finally {
      setSaving(false);
    }
  }

  async function redirectRequest() {
    if (!selected) return;
    setRedirecting(true);
    setMsg("");
    try {
      const res = await fetch(`/api/rh/profile-update-requests/${selected.id}/redirect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assigned_area: redirectArea,
          notes: redirectNotes.trim() || null,
        }),
      });
      const text = await res.text();
      let json: { error?: string } = {};
      try {
        json = JSON.parse(text) as { error?: string };
      } catch {}
      if (!res.ok) throw new Error(json.error ?? text ?? "Falha ao redirecionar.");

      setMsg("Solicitacao redirecionada.");
      await load();
      setSelectedId("");
      setAuditRows([]);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao redirecionar solicitacao.");
    } finally {
      setRedirecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Solicitacoes de adequacao</h1>
            <p className="mt-1 text-sm text-slate-600">
              Fila do RH (dados pessoais, contratuais e outros), com trilha de auditoria e redirecionamento.
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

      <div className="grid gap-4 md:grid-cols-7">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pendentes" value={stats.pending} />
        <StatCard label="Em analise" value={stats.in_review} />
        <StatCard label="Concluidas" value={stats.done} />
        <StatCard label="Recusadas" value={stats.rejected} />
        <StatCard label="Atrasadas (SLA)" value={stats.overdue} />
        <StatCard label="Tempo medio analise" value={`${stats.avgHours.toFixed(1)}h`} />
      </div>

      {stats.overdue > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Existem {stats.overdue} solicitacoes da fila RH acima de {slaHours}h.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Buscar
            <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <Search size={14} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
                placeholder="Titulo, colaborador, empresa..."
              />
            </div>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | RequestStatus)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="in_review">Em analise</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Recusada</option>
              <option value="implemented">Implementada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | RequestType)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="financial">Financeiro</option>
              <option value="personal">Pessoal</option>
              <option value="contractual">Contratual</option>
              <option value="avatar">Foto</option>
              <option value="other">Outro</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Empresa
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todas</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-3">Solicitacao</th>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-3 text-slate-500">Carregando...</td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((r) => {
                    const requester = profileById[r.requester_user_id];
                    const colab = r.collaborator_id ? colabById[r.collaborator_id] : null;
                    const requesterLabel = requester?.full_name || requester?.email || r.requester_user_id;
                    const company = colab?.empresa || "-";
                    return (
                      <tr
                        key={r.id}
                        className={`cursor-pointer border-t ${selectedId === r.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <td className="p-3">
                          <p className="font-semibold text-slate-900">{r.title}</p>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-1">{r.details}</p>
                        </td>
                        <td className="p-3">{requesterLabel}</td>
                        <td className="p-3">{company}</td>
                        <td className="p-3">{typeLabel(r.request_type)}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td className="p-3">{fmtDate(r.created_at)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-3 text-slate-500">Nenhuma solicitacao encontrada.</td>
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
                  <p className="mt-1 text-slate-700">{selected.details}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Tipo: {typeLabel(selected.request_type)} | Criada em: {fmtDate(selected.created_at)}
                  </p>
                  {selected.requested_changes ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 text-xs text-slate-700">
{JSON.stringify(selected.requested_changes, null, 2)}
                    </pre>
                  ) : null}
                </div>

                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                  Novo status
                  <select
                    value={decisionStatus}
                    onChange={(e) => setDecisionStatus(e.target.value as RequestStatus)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_review">Em analise</option>
                    <option value="approved">Aprovada</option>
                    <option value="rejected">Recusada</option>
                    <option value="implemented">Implementada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                  Observacoes da analise
                  <textarea
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void decide()}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Registrar decisao"}
                </button>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-700">Redirecionar solicitacao</p>
                  <div className="mt-2 grid gap-2">
                    <select
                      value={redirectArea}
                      onChange={(e) => setRedirectArea(e.target.value as AssignedArea)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="financeiro">Financeiro</option>
                      <option value="rh">RH</option>
                    </select>
                    <textarea
                      value={redirectNotes}
                      onChange={(e) => setRedirectNotes(e.target.value)}
                      className="min-h-[70px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
                      placeholder="Motivo do redirecionamento (opcional)"
                    />
                    <button
                      type="button"
                      onClick={() => void redirectRequest()}
                      disabled={redirecting}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {redirecting ? "Redirecionando..." : "Redirecionar"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Selecione uma solicitacao para analisar.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Auditoria</p>
            <div className="mt-3 space-y-2">
              {auditRows.length ? (
                auditRows.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {a.status_from ?? "-"} {"->"} {a.status_to}
                    </p>
                    <p className="mt-1">
                      por {(profileById[a.actor_user_id]?.full_name || profileById[a.actor_user_id]?.email || a.actor_user_id)} ({a.actor_role ?? "-"})
                    </p>
                    <p className="mt-1">{fmtDate(a.created_at)}</p>
                    {a.notes ? <p className="mt-1">{a.notes}</p> : null}
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
