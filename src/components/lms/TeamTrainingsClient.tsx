"use client";

import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { CourseStatusBadge } from "@/components/lms/CourseStatusBadge";
import { EmptyState } from "@/components/lms/EmptyState";
import { useTeamTrainings } from "@/hooks/lms/useTeamTrainings";
import type { LmsTeamTrainingRow } from "@/lib/lms/types";

export function TeamTrainingsClient({ rows }: { rows: LmsTeamTrainingRow[] }) {
  const { search, setSearch, rows: filteredRows } = useTeamTrainings(rows);

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Treinamentos da equipe" subtitle="Acompanhe prazos, progresso e pendencias da sua equipe." />
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador ou curso" className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
      </div>
      {filteredRows.length ? (
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
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.user_id}-${row.course_id}`} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-medium text-slate-900">{row.full_name}</td>
                    <td className="px-6 py-4 text-slate-600">{row.department_name ?? "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{row.course_title}</td>
                    <td className="px-6 py-4"><CourseStatusBadge status={row.status} /></td>
                    <td className="px-6 py-4 text-slate-600">{Math.round(row.progress_percent)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </TableShell>
      ) : (
        <EmptyState title="Nenhum dado de equipe" description="Nenhum colaborador liderado possui registros de treinamento no momento." />
      )}
    </div>
  );
}
