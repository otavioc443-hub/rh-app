"use client";

import type { EthicsCaseFiltersState } from "@/lib/ethicsCases/types";

type EthicsFiltersProps = {
  filters: EthicsCaseFiltersState;
  categories: string[];
  onChange: (patch: Partial<EthicsCaseFiltersState>) => void;
  onReset: () => void;
};

function fieldClassName() {
  return "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300";
}

export function EthicsFilters({ filters, categories, onChange, onReset }: EthicsFiltersProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filtros</h2>
          <p className="mt-1 text-sm text-slate-500">Busque rapidamente por protocolo, responsável, origem ou fase de tratamento.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Limpar filtros
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Protocolo, nome ou assunto</span>
          <input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Buscar..."
            className={fieldClassName()}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</span>
          <select value={filters.status} onChange={(event) => onChange({ status: event.target.value })} className={fieldClassName()}>
            <option value="all">Todos</option>
            <option value="Recebido">Recebido</option>
            <option value="Em triagem">Em triagem</option>
            <option value="Em análise">Em análise</option>
            <option value="Em investigação">Em investigação</option>
            <option value="Concluído">Concluído</option>
            <option value="Encerrado">Encerrado</option>
            <option value="Reaberto">Reaberto</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo de ocorrência</span>
          <select value={filters.category} onChange={(event) => onChange({ category: event.target.value })} className={fieldClassName()}>
            <option value="all">Todos</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Classificação de risco</span>
          <select value={filters.risk} onChange={(event) => onChange({ risk: event.target.value })} className={fieldClassName()}>
            <option value="all">Todos</option>
            <option value="Baixo">Baixo</option>
            <option value="Médio">Médio</option>
            <option value="Alto">Alto</option>
            <option value="Crítico">Crítico</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Abertos a partir de</span>
          <input type="date" value={filters.openedFrom} onChange={(event) => onChange({ openedFrom: event.target.value })} className={fieldClassName()} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Abertos até</span>
          <input type="date" value={filters.openedTo} onChange={(event) => onChange({ openedTo: event.target.value })} className={fieldClassName()} />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Origem do relato</span>
          <select value={filters.origin} onChange={(event) => onChange({ origin: event.target.value as EthicsCaseFiltersState["origin"] })} className={fieldClassName()}>
            <option value="all">Todas</option>
            <option value="anonymous">Anônimas</option>
            <option value="identified">Identificadas</option>
          </select>
        </label>
      </div>
    </section>
  );
}
