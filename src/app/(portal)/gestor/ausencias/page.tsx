"use client";

import { CheckCircle2, Clock3, Users, XCircle } from "lucide-react";

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

export default function GestorAusenciasPage() {
  const kpis = {
    pendentes: "—",
    aprovadas: "—",
    recusadas: "—",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Ausências (Gestor)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Aprovação de solicitações de ausências programadas da sua equipe.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Pendentes" value={kpis.pendentes} icon={Clock3} />
        <KpiCard label="Aprovadas (30 dias)" value={kpis.aprovadas} icon={CheckCircle2} />
        <KpiCard label="Recusadas (30 dias)" value={kpis.recusadas} icon={XCircle} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Solicitações pendentes</p>
            <p className="mt-1 text-sm text-slate-600">
              Em breve: lista com datas, motivo (opcional), e botões de Aprovar/Recusar.
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
            <Users size={18} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
          Nenhuma solicitação pendente no momento.
        </div>
      </div>
    </div>
  );
}
