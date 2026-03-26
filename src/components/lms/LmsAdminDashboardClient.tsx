"use client";

import Link from "next/link";
import { BookOpenCheck, ClockAlert, GraduationCap, Layers3, Trophy, Users2, Zap } from "lucide-react";
import { LmsActionButton } from "@/components/lms/LmsActionButton";
import { LeaderboardTable } from "@/components/lms/LeaderboardTable";
import { LMSStatsCards } from "@/components/lms/LMSStatsCards";
import { SeasonCampaignPanel } from "@/components/lms/SeasonCampaignPanel";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
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
          { label: "XP distribuido", value: data.gamification.totalXpDistributed },
          { label: "Desafios ativos", value: data.gamification.activeChallenges },
          { label: "Learners gamificados", value: data.gamification.activeLearners },
          { label: "Streak medio", value: data.gamification.averageStreak },
        ]}
      />

      <SeasonCampaignPanel campaign={data.gamification.seasonCampaign} audience="admin" />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resumo semanal do LMS</h2>
            <p className="text-sm text-slate-600">Janela atual: {data.weeklyDigest.periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <LmsActionButton
              endpoint="/api/lms/weekly-summary/send"
              label="Receber resumo"
              pendingLabel="Enviando..."
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            />
            <LmsActionButton
              endpoint="/api/lms/admin/weekly-summary/run"
              label="Disparar semana"
              pendingLabel="Disparando..."
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Temporada</p>
              <h2 className="mt-2 text-2xl font-semibold">{data.gamification.seasonLabel}</h2>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Trophy size={20} />
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            A camada gamificada monitora XP, streak, badges, desafios e ranking para transformar conclusao em engajamento mensuravel.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Badges mais emitidos</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Reconhecimentos em alta</h2>
            </div>
            <Zap size={18} className="text-sky-500" />
          </div>
          <div className="mt-5 space-y-3">
            {data.gamification.topBadges.length ? (
              data.gamification.topBadges.map((badge) => (
                <div key={badge.title} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{badge.title}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{badge.total}</span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Os badges aparecerao aqui conforme o uso da gamificacao.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Equipes mais engajadas</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Top departamentos por XP</h2>
            </div>
            <Users2 size={18} className="text-emerald-500" />
          </div>
          <div className="mt-5 space-y-3">
            {data.gamification.topDepartments.length ? (
              data.gamification.topDepartments.map((department) => (
                <div key={department.departmentName} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-900">
                    <span>{department.departmentName}</span>
                    <span>{department.xp} XP</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Media por learner: {department.completionRate}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Assim que houver pontuacao, o ranking por area sera mostrado aqui.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <TableShell>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pessoas que exigem atencao</h2>
                <p className="text-sm text-slate-500">Treinamentos vencidos ou que vencem em ate 7 dias.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/rh/lms/interacoes" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                  Ver duvidas
                </Link>
                <LmsActionButton
                  endpoint="/api/lms/admin/reminders/run"
                  label="Disparar lembretes"
                  pendingLabel="Disparando..."
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                />
                <Link href="/rh/lms/atribuicoes" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
                  Ver atribuicoes
                </Link>
              </div>
            </div>
            <div className="space-y-3 p-6">
              {data.attentionItems.length ? (
                data.attentionItems.map((item) => (
                  <div key={`${item.user_id}-${item.course_id}`} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.full_name}</div>
                        <div className="text-sm text-slate-600">{item.course_title}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.urgency === "overdue" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.urgency === "overdue" ? "Atrasado" : "Vence em breve"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {item.department_name ?? "Sem departamento"} - Prazo {item.due_date ?? "-"} - {Math.round(item.progress_percent)}%
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhum treinamento com risco imediato neste momento.
                </div>
              )}
            </div>
          </TableShell>

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
                    {row.status === "completed" ? (
                      <BookOpenCheck size={18} />
                    ) : row.status === "overdue" ? (
                      <ClockAlert size={18} />
                    ) : row.status === "in_progress" ? (
                      <Layers3 size={18} />
                    ) : (
                      <Users2 size={18} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <LeaderboardTable
            rows={data.gamification.leaderboard}
            compact
            title="Top learners da temporada"
            subtitle="Visao rapida dos colaboradores mais consistentes em XP e streak."
          />

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
                  <div className="mt-1 text-xs text-slate-500">{row.target_label ?? row.target_id} - {row.assigned_at.slice(0, 10)}</div>
                </div>
              ))}
            </div>
          </TableShell>
        </div>
      </div>
    </div>
  );
}

