export default function GestorPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Área do Gestor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visão rápida do time, pendências e indicadores do seu departamento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Pendências</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Avaliações em andamento</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Solicitações</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
        </div>
      </div>
    </div>
  );
}
