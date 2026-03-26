"use client";

import { AlertTriangle, CheckCircle2, Clock3, Users2 } from "lucide-react";
import { LmsActionButton } from "@/components/lms/LmsActionButton";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { CourseStatusBadge } from "@/components/lms/CourseStatusBadge";
import { EmptyState } from "@/components/lms/EmptyState";
import { useTeamTrainings } from "@/hooks/lms/useTeamTrainings";
import type { LmsTeamTrainingsData } from "@/lib/lms/types";

export function TeamTrainingsClient({ data }: { data: LmsTeamTrainingsData }) {
  const { search, setSearch, status, setStatus, rows: filteredRows } = useTeamTrainings(data.rows);

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Treinamentos da equipe" subtitle="Acompanhe prazos, progresso e pendencias da sua equipe." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">Integrantes</div>
              <div className="mt-2 text-3xl font-bold text-slate-950">{data.summary.totalMembers}</div>
            </div>
            <Users2 className="text-slate-400" size={20} />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">Vencendo em breve</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">{data.summary.dueSoon}</div>
            </div>
            <Clock3 className="text-amber-500" size={20} />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">Em atraso</div>
              <div className="mt-2 text-3xl font-bold text-rose-600">{data.summary.overdue}</div>
            </div>
            <AlertTriangle className="text-rose-500" size={20} />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-500">Conclusao media</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">{data.summary.averageCompletion}%</div>
            </div>
            <CheckCircle2 className="text-emerald-500" size={20} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resumo semanal da equipe</h2>
            <p className="text-sm text-slate-600">Recorte atual: {data.weeklyDigest.periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <LmsActionButton
              endpoint="/api/lms/weekly-summary/send"
              label="Receber resumo"
              pendingLabel="Enviando..."
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Concluidos</div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{data.weeklyDigest.completedThisWeek}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Vencendo</div>
              <div className="mt-2 text-2xl font-bold text-amber-600">{data.weeklyDigest.dueSoon}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Em atraso</div>
              <div className="mt-2 text-2xl font-bold text-rose-600">{data.weeklyDigest.overdue}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Nao iniciados</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{data.weeklyDigest.notStarted}</div>
            </div>
          </div>
        </div>
      </div>

      {data.urgentRows.length ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Atencao imediata</h2>
              <p className="text-sm text-slate-600">Treinamentos da equipe que estao vencidos ou vencem em ate 7 dias.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {data.urgentRows.map((row) => (
              <div key={`urgent-${row.user_id}-${row.course_id}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{row.full_name}</div>
                    <div className="text-sm text-slate-600">{row.course_title}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.urgency === "overdue" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                    {row.urgency === "overdue" ? "Atrasado" : "Vence em breve"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {row.department_name ?? "Sem departamento"} - Prazo {row.due_date ?? "-"} - {Math.round(row.progress_percent)}%
                </div>
                <div className="mt-3">
                  <LmsActionButton
                    endpoint="/api/lms/reminders/send"
                    body={{ userId: row.user_id, courseId: row.course_id, courseTitle: row.course_title, dueDate: row.due_date }}
                    label="Cobrar agora"
                    pendingLabel="Enviando..."
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador, curso ou departamento" className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm text-slate-900" />
          <select value={status} onChange={(event) => setStatus(event.target.value as "all" | "overdue" | "due_soon" | "in_progress" | "completed")} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm text-slate-900">
            <option value="all">Todos os status</option>
            <option value="overdue">Em atraso</option>
            <option value="due_soon">Vencendo em breve</option>
            <option value="in_progress">Em andamento</option>
            <option value="completed">Concluidos</option>
          </select>
        </div>
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
                  <th className="px-6 py-3">Prazo</th>
                  <th className="px-6 py-3">Acao</th>
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
                    <td className="px-6 py-4 text-slate-600">
                      {row.due_date ? (
                        <div className="space-y-1">
                          <div>{row.due_date}</div>
                          <div className={`text-xs font-medium ${row.urgency === "overdue" ? "text-rose-600" : row.urgency === "due_soon" ? "text-amber-600" : "text-slate-400"}`}>
                            {row.urgency === "overdue"
                              ? "Prazo vencido"
                              : row.urgency === "due_soon"
                                ? `Faltam ${row.days_until_due ?? 0} dia(s)`
                                : "Dentro do prazo"}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <LmsActionButton
                        endpoint="/api/lms/reminders/send"
                        body={{ userId: row.user_id, courseId: row.course_id, courseTitle: row.course_title, dueDate: row.due_date }}
                        label="Cobrar"
                        pendingLabel="Enviando..."
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60"
                      />
                    </td>
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

