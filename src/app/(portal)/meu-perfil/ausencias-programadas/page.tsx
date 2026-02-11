"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function AusenciasProgramadasPage() {
  // placeholders (na próxima etapa você liga com Supabase)
  const kpis = {
    liberadas: "—",
    pendentes: "—",
    aprovadas: "—",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Ausências programadas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Solicite ausências dentro do período liberado pelo RH e acompanhe o status de aprovação.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Dias liberados" value={kpis.liberadas} icon={CalendarClock} />
        <KpiCard label="Solicitações pendentes" value={kpis.pendentes} icon={Clock3} />
        <KpiCard label="Aprovadas (30 dias)" value={kpis.aprovadas} icon={CheckCircle2} />
      </div>

      {/* Conteúdo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Solicitar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Nova solicitação</p>
              <p className="mt-1 text-sm text-slate-600">
                Em breve: calendário para escolher os dias e enviar para aprovação do gestor.
              </p>
            </div>
            <button
              disabled
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
              title="Vamos ativar no próximo passo"
            >
              Solicitar
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              Próximo passo: integrar com Supabase (limites por colaborador + fluxo de aprovação).
            </p>
          </div>
        </div>

        {/* Atalhos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Atalhos</p>

          <div className="mt-3 space-y-2">
            <Link
              href="/notificacoes"
              className="block rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50"
            >
              Ver notificações
            </Link>

            <Link
              href="/agenda"
              className="block rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 hover:bg-slate-50"
            >
              Ir para agenda
            </Link>

            <div className="block rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-400">
              Histórico (em breve)
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Minhas solicitações</p>
            <p className="mt-1 text-sm text-slate-600">
              Aqui você verá pendentes, aprovadas e recusadas.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
          Nenhuma solicitação para exibir por enquanto.
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <Clock3 size={14} /> Pendente
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <CheckCircle2 size={14} /> Aprovada
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <XCircle size={14} /> Recusada
          </span>
        </div>
      </div>
    </div>
  );
}
