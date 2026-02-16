"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type ProjectStatus = "active" | "paused" | "done";
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
};

type DeliverableRow = {
  id: string;
  project_id: string;
  status: "pending" | "in_progress" | "sent" | "approved";
};

type ExtraPaymentRow = {
  id: string;
  project_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  reference_month: string | null;
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

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  if (value === "active") return "Ativo";
  if (value === "paused") return "Pausado";
  return "Concluido";
}

function statusClass(value: ProjectStatus) {
  if (value === "active") return "bg-emerald-50 text-emerald-700";
  if (value === "paused") return "bg-amber-50 text-amber-700";
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
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ProjectClientRow[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, string>>({});
  const [summaryByProjectId, setSummaryByProjectId] = useState<Record<string, ProjectSummary>>({});
  const [extrasRows, setExtrasRows] = useState<ExtraPaymentRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ProjectType>("all");
  const [clientFilter, setClientFilter] = useState<"all" | string>("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const projectRes = await supabase
        .from("projects")
        .select("id,name,description,status,start_date,end_date,budget_total,client_id,project_type,project_scopes,created_at")
        .order("created_at", { ascending: false });
      if (projectRes.error) throw projectRes.error;
      const projectRows = (projectRes.data ?? []) as ProjectRow[];
      setProjects(projectRows);

      const projectIds = projectRows.map((p) => p.id);

      const [clientsRes, memberRes, deliverableRes, extrasRes] = await Promise.all([
        supabase.from("project_clients").select("id,name").eq("active", true).order("name", { ascending: true }),
        projectIds.length
          ? supabase.from("project_members").select("id,project_id").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase.from("project_deliverables").select("id,project_id,status").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        projectIds.length
          ? supabase.from("project_extra_payments").select("id,project_id,amount,status,reference_month").in("project_id", projectIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (memberRes.error) throw memberRes.error;
      if (deliverableRes.error) throw deliverableRes.error;
      if (extrasRes.error) throw extrasRes.error;

      const clientsRows = (clientsRes.data ?? []) as ProjectClientRow[];
      setClients(clientsRows);
      const clientMap: Record<string, string> = {};
      for (const c of clientsRows) clientMap[c.id] = c.name;
      setClientsById(clientMap);

      const members = (memberRes.data ?? []) as MemberRow[];
      const deliverables = (deliverableRes.data ?? []) as DeliverableRow[];
      const extras = (extrasRes.data ?? []) as ExtraPaymentRow[];
      setExtrasRows(extras);

      const nextSummary: Record<string, ProjectSummary> = {};
      for (const p of projectRows) {
        const pm = members.filter((m) => m.project_id === p.id);
        const pd = deliverables.filter((d) => d.project_id === p.id);
        const pe = extras.filter((e) => e.project_id === p.id);

        const deliverablesTotal = pd.length;
        const approved = pd.filter((d) => d.status === "approved").length;
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
      setSummaryByProjectId({});
      setExtrasRows([]);
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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.project_type !== typeFilter) return false;
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (!term) return true;
      const txt = [p.name, p.description ?? "", clientsById[p.client_id ?? ""] ?? "", p.project_type ?? ""].join(" ").toLowerCase();
      return txt.includes(term);
    });
  }, [projects, statusFilter, typeFilter, clientFilter, q, clientsById]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "active").length;
    const paused = projects.filter((p) => p.status === "paused").length;
    const done = projects.filter((p) => p.status === "done").length;
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Projetos" value={stats.total} />
        <StatCard label="Ativos" value={stats.active} />
        <StatCard label="Pausados" value={stats.paused} />
        <StatCard label="Concluidos" value={stats.done} />
        <StatCard label="Orcamento total" value={fmtMoney(stats.budget)} />
        <StatCard label="Media progresso" value={`${stats.avgProgress}%`} />
        <StatCard label="Risco alto" value={stats.riskHigh} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Buscar
            <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
              <Search size={14} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
                placeholder="Projeto, cliente, tipo..."
              />
            </div>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectStatus)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="done">Concluido</option>
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
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

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
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(p.status)}`}>
                        {statusLabel(p.status)}
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
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-[24%] p-3">Projeto</th>
                <th className="w-[14%] p-3">Cliente</th>
                <th className="w-[12%] p-3">Tipo</th>
                <th className="w-[10%] p-3">Status</th>
                <th className="w-[10%] p-3">Risco</th>
                <th className="w-[14%] p-3">Execucao</th>
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
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td className="p-3">
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
                        <div className="text-xs text-slate-700">Orcamento: {fmtMoney(Number(p.budget_total) || 0)}</div>
                        <div className="text-xs text-slate-700">
                          Extras: {fmtMoney(summary.extrasPending)} / {fmtMoney(summary.extrasApproved)} / {fmtMoney(summary.extrasPaid)}
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
