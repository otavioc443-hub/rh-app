export function LMSFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  category?: string;
  onCategoryChange?: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
      <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar curso, assunto ou categoria" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
      <select value={status} onChange={(event) => onStatusChange(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
        <option value="all">Todos os status</option>
        <option value="draft">Rascunho</option>
        <option value="published">Publicado</option>
        <option value="archived">Arquivado</option>
        <option value="not_started">Nao iniciado</option>
        <option value="in_progress">Em andamento</option>
        <option value="completed">Concluido</option>
        <option value="overdue">Vencido</option>
      </select>
      <input value={category ?? ""} onChange={(event) => onCategoryChange?.(event.target.value)} placeholder="Categoria" className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
    </div>
  );
}
