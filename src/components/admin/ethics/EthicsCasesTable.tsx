"use client";

import { ArrowDownUp, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { EthicsRiskBadge } from "@/components/admin/ethics/EthicsRiskBadge";
import { EthicsStatusBadge } from "@/components/admin/ethics/EthicsStatusBadge";
import type { EthicsCaseRecord, EthicsCasesSortKey, EthicsCasesSortState } from "@/lib/ethicsCases/types";

type EthicsCasesTableProps = {
  cases: EthicsCaseRecord[];
  page: number;
  pageCount: number;
  sort: EthicsCasesSortState;
  onSort: (key: EthicsCasesSortKey) => void;
  onPageChange: (page: number) => void;
  onView: (item: EthicsCaseRecord) => void;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function SortButton({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: EthicsCasesSortKey;
  current: EthicsCasesSortState;
  onSort: (key: EthicsCasesSortKey) => void;
}) {
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
      <span>{label}</span>
      <ArrowDownUp size={12} className={current.key === sortKey ? "text-slate-900" : "text-slate-300"} />
    </button>
  );
}

export function EthicsCasesTable({ cases, page, pageCount, sort, onSort, onPageChange, onView }: EthicsCasesTableProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left"><SortButton label="Protocolo" sortKey="protocol" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Data de abertura" sortKey="created_at" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Assunto" sortKey="subject" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Tipo" sortKey="category" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Status" sortKey="status" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Risco" sortKey="risk_level" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Origem" sortKey="origin" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Responsável" sortKey="assigned_to_name" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-left"><SortButton label="Última atualização" sortKey="last_update_at" current={sort} onSort={onSort} /></th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.protocol}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(item.created_at)}</td>
                <td className="px-4 py-4 text-sm text-slate-800">{item.subject}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{item.category}</td>
                <td className="px-4 py-4 text-sm"><EthicsStatusBadge status={item.status} /></td>
                <td className="px-4 py-4 text-sm"><EthicsRiskBadge risk={item.risk_level} /></td>
                <td className="px-4 py-4 text-sm text-slate-600">{item.is_anonymous ? "Anônima" : "Identificada"}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{item.assigned_to_name ?? "Não atribuído"}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(item.last_update_at)}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onView(item)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Eye size={16} />
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Página {page} de {pageCount}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
