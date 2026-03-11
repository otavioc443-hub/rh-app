"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type QueueRow = {
  id: string;
  project_id: string;
  effective_date: string;
  title: string;
  description: string | null;
  additional_amount: number | null;
  from_budget_total: number | null;
  to_budget_total: number | null;
  status: "registrado" | "em_analise" | "aprovado" | "rejeitado" | "executado" | "cancelado";
  apply_on_approval: boolean;
  created_at: string;
  requested_by: string | null;
  finance_decision_note: string | null;
  finance_decided_at: string | null;
};

type ProjectRow = { id: string; name: string };
type ProfileRow = { id: string; full_name: string | null; email: string | null };
const CEO_SLA_CONFIG_KEY = "project_contract_events_ceo_approval";
const CEO_SLA_LEGACY_CONFIG_KEY = "project_contract_events_finance_approval";

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusClass(value: QueueRow["status"]) {
  if (value === "aprovado" || value === "executado") return "bg-emerald-50 text-emerald-700";
  if (value === "em_analise" || value === "registrado") return "bg-amber-50 text-amber-700";
  if (value === "rejeitado") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function CeoAditivosContratuaisPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [slaHours, setSlaHours] = useState(48);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [projectById, setProjectById] = useState<Record<string, ProjectRow>>({});
  const [profileById, setProfileById] = useState<Record<string, ProfileRow>>({});
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | "cancelled">("approved");
  const [decisionNote, setDecisionNote] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [eventsRes, slaRes] = await Promise.all([
        supabase
          .from("project_contract_events")
          .select("id,project_id,effective_date,title,description,additional_amount,from_budget_total,to_budget_total,status,apply_on_approval,created_at,requested_by,finance_decision_note,finance_decided_at,event_type")
          .eq("event_type", "aditivo_valor")
          .order("effective_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("request_sla_settings")
          .select("config_key,sla_hours")
          .in("config_key", [CEO_SLA_CONFIG_KEY, CEO_SLA_LEGACY_CONFIG_KEY]),
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (!slaRes.error) {
        const slaRows = (slaRes.data ?? []) as Array<{ config_key: string; sla_hours: number }>;
        const preferred =
          slaRows.find((x) => x.config_key === CEO_SLA_CONFIG_KEY) ??
          slaRows.find((x) => x.config_key === CEO_SLA_LEGACY_CONFIG_KEY);
        if (preferred && typeof preferred.sla_hours === "number") setSlaHours(preferred.sla_hours);
      }

      const data = ((eventsRes.data ?? []) as Array<QueueRow & { event_type: string }>).map((x) => ({
        id: x.id,
        project_id: x.project_id,
        effective_date: x.effective_date,
        title: x.title,
        description: x.description,
        additional_amount: x.additional_amount,
        from_budget_total: x.from_budget_total,
        to_budget_total: x.to_budget_total,
        status: x.status,
        apply_on_approval: x.apply_on_approval,
        created_at: x.created_at,
        requested_by: x.requested_by,
        finance_decision_note: x.finance_decision_note,
        finance_decided_at: x.finance_decided_at,
      }));
      setRows(data);

      const projectIds = Array.from(new Set(data.map((r) => r.project_id).filter(Boolean)));
      const requesterIds = Array.from(new Set(data.map((r) => r.requested_by).filter(Boolean) as string[]));

      const [projectRes, profileRes] = await Promise.all([
        projectIds.length
          ? supabase.from("projects").select("id,name").in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        requesterIds.length
          ? supabase.from("profiles").select("id,full_name,email").in("id", requesterIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (profileRes.error) throw profileRes.error;

      const pMap: Record<string, ProjectRow> = {};
      for (const p of (projectRes.data ?? []) as ProjectRow[]) pMap[p.id] = p;
      setProjectById(pMap);

      const uMap: Record<string, ProfileRow> = {};
      for (const u of (profileRes.data ?? []) as ProfileRow[]) uMap[u.id] = u;
      setProfileById(uMap);

      setSelectedId((prev) => (prev && data.some((r) => r.id === prev) ? prev : data[0]?.id ?? ""));
    } catch (e: unknown) {
      setRows([]);
      setProjectById({});
      setProfileById({});
      setSelectedId("");
      setMsg(e instanceof Error ? e.message : "Erro ao carregar fila de aditivos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const pendingCount = useMemo(() => rows.filter((r) => r.status === "em_analise").length, [rows]);
  const totalPendingValue = useMemo(
    () => rows.filter((r) => r.status === "em_analise").reduce((acc, r) => acc + (Number(r.additional_amount) || 0), 0),
    [rows]
  );
  const overdueCount = useMemo(() => {
    const now = new Date().getTime();
    return rows.filter((r) => {
      if (r.status !== "em_analise") return false;
      const created = new Date(r.created_at).getTime();
      if (Number.isNaN(created)) return false;
      const hours = (now - created) / (1000 * 60 * 60);
      return hours > slaHours;
    }).length;
  }, [rows, slaHours]);

  async function applyDecision() {
    if (!selected) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/ceo/project-contract-events/${selected.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: decision,
          note: decisionNote.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao registrar decisao.");

      setMsg("Decisao registrada.");
      setDecisionNote("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao decidir aditivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">CEO - Aprovacao de aditivos contratuais</h1>
            <p className="mt-1 text-sm text-slate-600">Aprova??o exclusiva dos aditivos de valor enviados pela Diretoria.</p>
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

      {overdueCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Existem {overdueCount} aditivos acima do SLA de {slaHours}h.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total de aditivos" value={rows.length} />
        <StatCard label="Pendentes de aprova??o" value={pendingCount} />
        <StatCard label="Valor pendente" value={fmtMoney(totalPendingValue)} />
        <StatCard label="Atrasados (SLA)" value={overdueCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-3">Projeto</th>
                  <th className="p-3">Titulo</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={5}>Carregando...</td>
                  </tr>
                ) : rows.length ? (
                  rows.map((r) => {
                    const requester = r.requested_by ? profileById[r.requested_by] : null;
                    const requesterLabel = requester?.full_name || requester?.email || "-";
                    return (
                      <tr
                        key={r.id}
                        className={`cursor-pointer border-t ${selectedId === r.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <td className="p-3">{projectById[r.project_id]?.name ?? "-"}</td>
                        <td className="p-3">{r.title}</td>
                        <td className="p-3">{fmtMoney(Number(r.additional_amount) || 0)}</td>
                        <td className="p-3">{requesterLabel}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={5}>Sem aditivos de valor registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Decisao do CEO</p>
          {selected ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{selected.title}</p>
                <p className="mt-1 text-slate-700">{selected.description || "-"}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Projeto: {projectById[selected.project_id]?.name ?? "-"} | Vigencia: {selected.effective_date}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Orcamento: {fmtMoney(Number(selected.from_budget_total) || 0)} -&gt; {fmtMoney(Number(selected.to_budget_total) || 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Aplicar ao aprovar: {selected.apply_on_approval ? "Sim" : "N?o"}
                </p>
              </div>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Decisao
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as "approved" | "rejected" | "cancelled")}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  disabled={selected.status !== "em_analise"}
                >
                  <option value="approved">Aprovar</option>
                  <option value="rejected">Rejeitar</option>
                  <option value="cancelled">Cancelar</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold text-slate-700">
                Observa??o
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="min-h-[90px] rounded-xl border border-slate-200 p-3 text-sm"
                  disabled={selected.status !== "em_analise"}
                />
              </label>

              <button
                type="button"
                onClick={() => void applyDecision()}
                disabled={saving || selected.status !== "em_analise"}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Registrar decisao"}
              </button>

              {selected.finance_decision_note ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  ?ltima observa??o: {selected.finance_decision_note}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Selecione um aditivo para decidir.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
