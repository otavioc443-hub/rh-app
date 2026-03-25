"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import type { LmsReportRow } from "@/lib/lms/types";

export function LmsReportsClient({ rows }: { rows: LmsReportRow[] }) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => `${row.user_name} ${row.course_title} ${row.department_name ?? ""}`.toLowerCase().includes(normalized));
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Relatorios LMS" subtitle="Conclusao por curso, area e desempenho em avaliacoes." />
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por colaborador, curso ou area" className="h-11 flex-1 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
        <a href="/api/lms/admin/reports/export" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          <Download size={16} />
          Exportar CSV
        </a>
      </div>
      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Colaborador</th>
                <th className="px-6 py-3">Departamento</th>
                <th className="px-6 py-3">Curso</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Progresso</th>
                <th className="px-6 py-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`${row.user_name}-${row.course_title}-${index}`} className="border-t border-slate-100">
                  <td className="px-6 py-4 font-medium text-slate-900">{row.user_name}</td>
                  <td className="px-6 py-4 text-slate-600">{row.department_name ?? "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{row.course_title}</td>
                  <td className="px-6 py-4 text-slate-600">{row.status}</td>
                  <td className="px-6 py-4 text-slate-600">{Math.round(row.progress_percent)}%</td>
                  <td className="px-6 py-4 text-slate-600">{row.score ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
