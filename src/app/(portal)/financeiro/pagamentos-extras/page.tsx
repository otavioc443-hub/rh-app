"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type PaymentStatus = "pending" | "approved" | "rejected" | "paid";

type ExtraPayment = {
  id: string;
  project_id: string;
  user_id: string;
  amount: number;
  reference_month: string;
  description: string | null;
  status: PaymentStatus;
  requested_by: string;
  finance_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

type ProjectRow = { id: string; name: string };
type ProfileRow = { id: string; full_name: string | null; email: string | null };

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(s: PaymentStatus) {
  if (s === "pending") return "Pendente";
  if (s === "approved") return "Aprovado";
  if (s === "rejected") return "Recusado";
  return "Pago";
}

function statusClass(s: PaymentStatus) {
  if (s === "pending") return "bg-amber-50 text-amber-700";
  if (s === "approved") return "bg-emerald-50 text-emerald-700";
  if (s === "paid") return "bg-sky-50 text-sky-700";
  return "bg-rose-50 text-rose-700";
}

export default function FinanceiroPagamentosExtrasPage() {
  const { loading: roleLoading, role, active } = useUserRole();
  const canAccess = active && (role === "financeiro" || role === "admin");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [rows, setRows] = useState<ExtraPayment[]>([]);
  const [projectsById, setProjectsById] = useState<Record<string, string>>({});
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("pending");
  const [projectFilter, setProjectFilter] = useState<"all" | string>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [decisionStatus, setDecisionStatus] = useState<PaymentStatus>("approved");
  const [decisionNote, setDecisionNote] = useState("");

  const personLabel = useCallback((uid: string) => {
    const p = profilesById[uid];
    const n = (p?.full_name ?? "").trim();
    if (n && !n.includes("@")) return n;
    const e = (p?.email ?? "").trim();
    if (e) return e;
    return `Usuario ${uid.slice(0, 8)}`;
  }, [profilesById]);

  async function load() {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("N?o autenticado.");
      setMeId(authData.user.id);

      const res = await supabase
        .from("project_extra_payments")
        .select("id,project_id,user_id,amount,reference_month,description,status,requested_by,finance_note,decided_by,decided_at,created_at")
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      const next = (res.data ?? []) as ExtraPayment[];
      setRows(next);

      const projectIds = Array.from(new Set(next.map((r) => r.project_id)));
      const userIds = Array.from(new Set(next.flatMap((r) => [r.user_id, r.requested_by, r.decided_by ?? ""]).filter(Boolean)));

      const [pRes, uRes] = await Promise.all([
        projectIds.length
          ? supabase.from("projects").select("id,name").in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabase.from("profiles").select("id,full_name,email").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (pRes.error) throw new Error(pRes.error.message);
      if (uRes.error) throw new Error(uRes.error.message);

      const pMap: Record<string, string> = {};
      for (const p of (pRes.data ?? []) as ProjectRow[]) pMap[p.id] = p.name;
      setProjectsById(pMap);

      const uMap: Record<string, ProfileRow> = {};
      for (const u of (uRes.data ?? []) as ProfileRow[]) uMap[u.id] = u;
      setProfilesById(uMap);

      setSelectedId((prev) => (prev && next.some((r) => r.id === prev) ? prev : next[0]?.id ?? ""));
    } catch (e: unknown) {
      setRows([]);
      setProjectsById({});
      setProfilesById({});
      setSelectedId("");
      setMsg(e instanceof Error ? e.message : "Erro ao carregar pagamentos extras.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleLoading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, canAccess]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
      if (!term) return true;
      const text = [
        projectsById[r.project_id] ?? "",
        personLabel(r.user_id),
        personLabel(r.requested_by),
        r.description ?? "",
        r.reference_month,
        statusLabel(r.status),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [rows, statusFilter, projectFilter, q, projectsById, personLabel]);

  const selected = useMemo(() => filtered.find((r) => r.id === selectedId) ?? null, [filtered, selectedId]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const paid = rows.filter((r) => r.status === "paid").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    const pendingAmount = rows
      .filter((r) => r.status === "pending")
      .reduce((acc, r) => acc + (Number(r.amount ?? 0) || 0), 0);
    return { pending, approved, paid, rejected, pendingAmount };
  }, [rows]);

  async function decide() {
    if (!selected) return;
    if (decisionStatus === "rejected" && !decisionNote.trim()) {
      setMsg("Informe observa??o ao recusar.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const upd = await supabase
        .from("project_extra_payments")
        .update({
          status: decisionStatus,
          finance_note: decisionNote.trim() || null,
          decided_by: meId || null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (upd.error) throw new Error(upd.error.message);
      setMsg("Decisao registrada.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar decisao.");
    } finally {
      setSaving(false);
    }
  }

  if (!canAccess && !roleLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Acesso restrito ao Financeiro/Admin.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Aprova??o de pagamentos extras</h1>
            <p className="mt-1 text-sm text-slate-600">Fila gerada pelos gestores em pagamentos extras.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
        {msg ? <p className="mt-3 text-sm text-rose-600">{msg}</p> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Pendentes</p><p className="mt-1 text-xl font-semibold text-amber-700">{stats.pending}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Aprovados</p><p className="mt-1 text-xl font-semibold text-emerald-700">{stats.approved}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Pagos</p><p className="mt-1 text-xl font-semibold text-sky-700">{stats.paid}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Recusados</p><p className="mt-1 text-xl font-semibold text-rose-700">{stats.rejected}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Valor pendente</p><p className="mt-1 text-xl font-semibold text-slate-900">{money(stats.pendingAmount)}</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-2 md:grid-cols-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | PaymentStatus)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="all">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="paid">Pago</option>
            <option value="rejected">Recusado</option>
          </select>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value as "all" | string)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="all">Todos projetos</option>
            {Object.entries(projectsById).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar colaborador, gestor ou descricao..."
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3 text-left">Projeto</th>
                <th className="p-3 text-left">Colaborador</th>
                <th className="p-3 text-left">Mes</th>
                <th className="p-3 text-left">Valor</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`cursor-pointer border-t border-slate-100 ${selectedId === r.id ? "bg-slate-50" : "hover:bg-slate-50/60"}`}
                >
                  <td className="p-3 text-slate-900">{projectsById[r.project_id] ?? r.project_id}</td>
                  <td className="p-3 text-slate-700">{personLabel(r.user_id)}</td>
                  <td className="p-3 text-slate-700">{new Date(r.reference_month).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</td>
                  <td className="p-3 text-slate-700">{money(Number(r.amount ?? 0) || 0)}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-slate-500">Nenhuma solicita??o encontrada.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {selected ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Detalhe da solicita??o</p>
              <p className="text-sm text-slate-700"><b>Projeto:</b> {projectsById[selected.project_id] ?? selected.project_id}</p>
              <p className="text-sm text-slate-700"><b>Colaborador:</b> {personLabel(selected.user_id)}</p>
              <p className="text-sm text-slate-700"><b>Solicitado por:</b> {personLabel(selected.requested_by)}</p>
              <p className="text-sm text-slate-700"><b>Valor:</b> {money(Number(selected.amount ?? 0) || 0)}</p>
              <p className="text-sm text-slate-700"><b>Descricao:</b> {selected.description?.trim() || "-"}</p>

              <div className="h-px bg-slate-200" />
              <p className="text-sm font-semibold text-slate-900">Decisao do financeiro</p>
              <select value={decisionStatus} onChange={(e) => setDecisionStatus(e.target.value as PaymentStatus)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="pending">Pendente</option>
                <option value="approved">Aprovar</option>
                <option value="rejected">Recusar</option>
                <option value="paid">Marcar como pago</option>
              </select>
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Observa??o do financeiro..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void decide()}
                disabled={saving}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Salvar decisao
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Selecione uma solicita??o para revisar.</p>
          )}
        </div>
      </section>
    </div>
  );
}
