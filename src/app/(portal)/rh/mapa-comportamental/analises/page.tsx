"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BrainCircuit, RefreshCcw, ShieldAlert, TrendingUp, Users } from "lucide-react";

type OverviewRow = {
  id: string;
  collaborator_name: string;
  created_at: string;
  predominant: string;
  demand: string;
  top_gap_label: string;
  top_gap_value: number;
  role: string;
  department_name: string | null;
  company_name: string | null;
  job_title: string | null;
  fit_summary: string;
};

type OverviewResponse = {
  summary: {
    total_assessments: number;
    top_axis: string | null;
    top_demand: string | null;
    top_gap: string | null;
  };
  top_axis: Array<{ label: string; count: number }>;
  top_demand: Array<{ label: string; count: number }>;
  top_gaps: Array<{ label: string; count: number }>;
  top_roles: Array<{ label: string; count: number }>;
  top_departments: Array<{ label: string; count: number }>;
  top_job_titles: Array<{ label: string; count: number }>;
  fit_buckets: Array<{ label: string; count: number }>;
  rows: OverviewRow[];
};

export default function RhMapaComportamentalAnalisesPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedFit, setSelectedFit] = useState("all");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/behavior/admin/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json()) as OverviewResponse & { error?: string };
      if (!res.ok) throw new Error(body.error || "Erro ao carregar análises.");
      setData(body);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao carregar análises.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    return (data?.rows ?? []).filter((row) => {
      if (selectedRole !== "all" && row.role !== selectedRole) return false;
      if (selectedDepartment !== "all" && (row.department_name ?? "Sem área") !== selectedDepartment) return false;
      if (selectedFit !== "all" && row.fit_summary !== selectedFit) return false;
      return true;
    });
  }, [data, selectedRole, selectedDepartment, selectedFit]);

  const recentRows = useMemo(() => filteredRows.slice(0, 12), [filteredRows]);
  const executiveHighlights = useMemo(() => {
    if (!filteredRows.length) return [];

    const fitCounts = new Map<string, number>();
    const gapCounts = new Map<string, number>();
    const roleCounts = new Map<string, number>();

    for (const row of filteredRows) {
      fitCounts.set(row.fit_summary, (fitCounts.get(row.fit_summary) ?? 0) + 1);
      gapCounts.set(row.top_gap_label, (gapCounts.get(row.top_gap_label) ?? 0) + 1);
      roleCounts.set(row.role, (roleCounts.get(row.role) ?? 0) + 1);
    }

    const topFit = [...fitCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topGap = [...gapCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topRole = [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    return [
      {
        title: "Recorte que mais exige atenção",
        text: topFit
          ? `A leitura mais recorrente neste recorte é ${topFit[0].toLowerCase()}. Isso sugere observar aderência, clareza de contexto e expectativa de entrega com mais proximidade.`
          : "Ainda não há volume suficiente para consolidar um padrão de aderência.",
      },
      {
        title: "Onde vale concentrar feedback e PDI",
        text: topGap
          ? `O gap mais recorrente aparece em ${topGap[0].toLowerCase()}, então esse eixo tende a gerar mais retorno quando vira pauta de feedback, PDI e combinados de gestão.`
          : "Ainda não há gaps recorrentes suficientes para eleger um eixo prioritário.",
      },
      {
        title: "Público dominante neste recorte",
        text: topRole
          ? `O papel mais frequente neste grupo é ${topRole[0].toLowerCase()}. Vale cruzar essa leitura com contexto, senioridade e distribuição de responsabilidade.`
          : "Ainda não há concentração suficiente em um papel específico.",
      },
    ];
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Mapa comportamental</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Análises para RH e liderança</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Uma leitura gerencial consolidada para acompanhar predominâncias, demandas do contexto, aderência ao papel atual
              e sinais que podem orientar PDI, feedback e distribuição de responsabilidades.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewStatCard icon={<Users size={18} />} label="Leituras analisadas" value={String(data?.summary.total_assessments ?? 0)} />
        <OverviewStatCard icon={<BrainCircuit size={18} />} label="Predominância mais comum" value={data?.summary.top_axis ?? "-"} />
        <OverviewStatCard icon={<TrendingUp size={18} />} label="Demanda mais recorrente" value={data?.summary.top_demand ?? "-"} />
        <OverviewStatCard icon={<ShieldAlert size={18} />} label="Gap mais recorrente" value={data?.summary.top_gap ?? "-"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <RankingCard title="Predominâncias recorrentes" items={data?.top_axis ?? []} />
        <RankingCard title="Demandas do ambiente" items={data?.top_demand ?? []} />
        <RankingCard title="Gaps de gestão" items={data?.top_gaps ?? []} />
        <RankingCard title="Papéis mais mapeados" items={data?.top_roles ?? []} />
        <RankingCard title="Áreas com mais leituras" items={data?.top_departments ?? []} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard title="Cargos mais mapeados" items={data?.top_job_titles ?? []} />
        <RankingCard title="Aderência ao contexto" items={data?.fit_buckets ?? []} />
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-950">Filtros gerenciais</div>
          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Papel</span>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-300">
                <option value="all">Todos</option>
                {(data?.top_roles ?? []).map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Área</span>
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-300">
                <option value="all">Todas</option>
                {(data?.top_departments ?? []).map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Aderência</span>
              <select value={selectedFit} onChange={(e) => setSelectedFit(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-300">
                <option value="all">Todas</option>
                {(data?.fit_buckets ?? []).map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      {executiveHighlights.length ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {executiveHighlights.map((item, index) => (
            <div
              key={item.title}
              className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
            >
              <div className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                Insight {index + 1}
              </div>
              <div className="mt-4 text-base font-semibold text-slate-950">{item.title}</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Leituras recentes</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Últimos perfis analisados</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use esta grade para entender o papel atual da pessoa, a demanda do contexto e o ponto de ajuste mais relevante
            para PDI, feedback e calibração de gestão.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {recentRows.length ? (
            recentRows.map((row) => (
              <div key={row.id} className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{row.collaborator_name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {new Date(row.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {row.fit_summary}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <p><span className="font-semibold text-slate-950">Predominância:</span> {row.predominant}</p>
                  <p><span className="font-semibold text-slate-950">Exigência do meio:</span> {row.demand}</p>
                  <p><span className="font-semibold text-slate-950">Papel:</span> {row.role}</p>
                  <p><span className="font-semibold text-slate-950">Área:</span> {row.department_name ?? "Sem área"}</p>
                  <p><span className="font-semibold text-slate-950">Cargo:</span> {row.job_title ?? "Não informado"}</p>
                  <p><span className="font-semibold text-slate-950">Empresa:</span> {row.company_name ?? "Sem empresa"}</p>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Leitura de aderência ao contexto</p>
                  <p className="mt-1">
                    Gap principal em <b>{row.top_gap_label}</b> com intensidade de <b>{row.top_gap_value.toFixed(2)} p.p.</b>.
                    Esse é o melhor ponto para orientar acompanhamento de liderança, ajustes de rotina e próximos passos no PDI.
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhuma leitura recente encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewStatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold leading-tight text-slate-950">{value}</div>
    </div>
  );
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <span className="text-sm text-slate-700">{item.label}</span>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{item.count}</span>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">Sem dados suficientes no período.</div>
        )}
      </div>
    </div>
  );
}
