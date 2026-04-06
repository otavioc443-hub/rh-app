"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCcw, TrendingUp, Users, ShieldAlert, BrainCircuit } from "lucide-react";

type OverviewRow = {
  id: string;
  collaborator_name: string;
  created_at: string;
  predominant: string;
  demand: string;
  top_gap_label: string;
  top_gap_value: number;
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
  rows: OverviewRow[];
};

export default function RhMapaComportamentalAnalisesPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<OverviewResponse | null>(null);

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

  const recentRows = useMemo(() => data?.rows.slice(0, 12) ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Mapa comportamental</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Análises para RH</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Uma leitura gerencial consolidada para acompanhar predominâncias mais frequentes, demandas do contexto e
              principais gaps que merecem acompanhamento.
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

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewStatCard icon={<Users size={18} />} label="Leituras analisadas" value={String(data?.summary.total_assessments ?? 0)} />
        <OverviewStatCard icon={<BrainCircuit size={18} />} label="Predominância mais comum" value={data?.summary.top_axis ?? "-"} />
        <OverviewStatCard icon={<TrendingUp size={18} />} label="Demanda mais recorrente" value={data?.summary.top_demand ?? "-"} />
        <OverviewStatCard icon={<ShieldAlert size={18} />} label="Gap mais recorrente" value={data?.summary.top_gap ?? "-"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard title="Predominâncias recorrentes" items={data?.top_axis ?? []} />
        <RankingCard title="Demandas do ambiente" items={data?.top_demand ?? []} />
        <RankingCard title="Gaps que merecem atenção" items={data?.top_gaps ?? []} />
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Leituras recentes</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Últimos perfis analisados</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use esta grade para identificar padrões de contexto, entender onde o time mais está sendo pressionado e
            levar isso para PDI, feedback e conversas de alinhamento.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {recentRows.length ? (
            recentRows.map((row) => (
              <div key={row.id} className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{row.collaborator_name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {new Date(row.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Gap principal: {row.top_gap_label}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-950">Predominância:</span> {row.predominant}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Exigência do meio:</span> {row.demand}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-950">Intensidade do gap:</span> {row.top_gap_value.toFixed(2)} p.p.
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
