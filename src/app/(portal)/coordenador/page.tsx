export default function CoordenadorPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Área do Coordenador</h1>
        <p className="mt-1 text-sm text-slate-600">
          Acompanhe rotinas, agenda do setor e ações com a equipe.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Agenda do setor</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Comunicados</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Ações pendentes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
        </div>
      </div>
    </div>
  );
}
