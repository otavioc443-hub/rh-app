"use client";

import Link from "next/link";
import { BookOpenCheck, ClockAlert, GraduationCap, Layers3, Users2 } from "lucide-react";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { LMSStatsCards } from "@/components/lms/LMSStatsCards";
import { useLmsDashboard } from "@/hooks/lms/useLmsDashboard";
import type { LmsAdminDashboardData } from "@/lib/lms/types";

export function LmsAdminDashboardClient({ data }: { data: LmsAdminDashboardData }) {
  const { cards } = useLmsDashboard(data);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<GraduationCap size={24} />}
        title="Treinamentos"
        subtitle="Gerencie cursos, trilhas, atribuicoes e o acompanhamento do aprendizado corporativo."
      />

      <LMSStatsCards
        cards={[
          ...cards,
          { label: "Vencimentos proximos", value: data.dueSoon },
          { label: "Acesso recente", value: data.mostAccessedCourses[0]?.accessCount ?? 0, helper: data.mostAccessedCourses[0]?.title ?? "Sem dados" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <TableShell>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Cursos com maior acesso</h2>
                <p className="text-sm text-slate-500">Monitore o catalogo mais consumido e a taxa de abandono.</p>
              </div>
              <Link href="/rh/lms/cursos" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                Ver cursos
              </Link>
            </div>
            <TableWrap>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Curso</th>
                    <th className="px-6 py-3">Acessos</th>
                    <th className="px-6 py-3">Abandono</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mostAccessedCourses.map((row) => {
                    const drop = data.highestDropOffCourses.find((item) => item.courseId === row.courseId)?.incompleteUsers ?? 0;
                    return (
                      <tr key={row.courseId} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-medium text-slate-900">{row.title}</td>
                        <td className="px-6 py-4 text-slate-600">{row.accessCount}</td>
                        <td className="px-6 py-4 text-slate-600">{drop}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </TableShell>

          <div className="grid gap-4 md:grid-cols-3">
            {data.completionByStatus.map((row) => (
              <div key={row.status} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-500">{row.status}</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{row.total}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    {row.status === "completed" ? <BookOpenCheck size={18} /> : row.status === "overdue" ? <ClockAlert size={18} /> : row.status === "in_progress" ? <Layers3 size={18} /> : <Users2 size={18} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <TableShell>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Ranking por departamento</h2>
            </div>
            <div className="space-y-3 p-6">
              {data.departmentRanking.map((row) => (
                <div key={row.departmentName} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>{row.departmentName}</span>
                    <span>{row.completionRate}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${row.completionRate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </TableShell>

          <TableShell>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Atribuicoes recentes</h2>
            </div>
            <div className="space-y-3 p-6">
              {data.recentAssignments.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="text-sm font-semibold text-slate-900">{row.course_title ?? row.learning_path_title ?? "Atribuicao"}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.target_label ?? row.target_id} · {row.assigned_at.slice(0, 10)}</div>
                </div>
              ))}
            </div>
          </TableShell>
        </div>
      </div>
    </div>
  );
}
