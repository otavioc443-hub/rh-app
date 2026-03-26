"use client";

import { GraduationCap, Timer, Trophy } from "lucide-react";
import { CourseCard } from "@/components/lms/CourseCard";
import { BadgeShelf } from "@/components/lms/BadgeShelf";
import { BattleArenaList } from "@/components/lms/BattleArenaList";
import { ChallengesRail } from "@/components/lms/ChallengesRail";
import { EmptyState } from "@/components/lms/EmptyState";
import { GamificationHero } from "@/components/lms/GamificationHero";
import { LeaderboardTable } from "@/components/lms/LeaderboardTable";
import { LMSStatsCards } from "@/components/lms/LMSStatsCards";
import type { LmsGamificationOverview, LmsMyTrainingCard } from "@/lib/lms/types";

export function LmsLearnerHomeClient({
  recommended,
  deadlines,
  keepLearning,
  dashboard,
  gamification,
}: {
  recommended: LmsMyTrainingCard[];
  deadlines: LmsMyTrainingCard[];
  keepLearning: LmsMyTrainingCard[];
  dashboard: { total: number; completed: number; inProgress: number; overdue: number };
  gamification: LmsGamificationOverview;
}) {
  return (
    <div className="space-y-6">
      <GamificationHero data={gamification} />

      <LMSStatsCards
        cards={[
          { label: "Cursos atribuídos", value: dashboard.total, helper: "Catálogo pessoal visível" },
          { label: "Concluídos", value: dashboard.completed, helper: "Treinamentos finalizados" },
          { label: "Em andamento", value: dashboard.inProgress, helper: "Itens que pedem retomada" },
          { label: "Vencidos", value: dashboard.overdue, helper: "Pendências críticas" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Continue de onde parou</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Treinamentos em andamento</h2>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <GraduationCap size={18} />
              </span>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {keepLearning.length ? (
                keepLearning.map((item) => <CourseCard key={item.course.id} item={item} />)
              ) : (
                <div className="md:col-span-2">
                  <EmptyState title="Sem cursos em andamento" description="Quando você iniciar um treinamento, ele aparecerá aqui para retomada rápida." />
                </div>
              )}
            </div>
          </section>

          <ChallengesRail items={gamification.activeChallenges} />
          <BadgeShelf items={gamification.badges.slice(0, 6)} />
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Prazos em foco</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Próximos vencimentos</h2>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Timer size={18} />
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {deadlines.length ? (
                deadlines.map((item) => (
                  <div key={item.course.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-950">{item.course.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.assignment?.due_date ? `Prazo: ${item.assignment.due_date}` : "Sem prazo definido"}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhum vencimento próximo.
                </div>
              )}
            </div>
          </section>

          <LeaderboardTable rows={gamification.leaderboard.slice(0, 5)} compact title="Top da temporada" subtitle="Seu posicionamento no ranking geral." />
          <BattleArenaList sessions={gamification.battles} title="Arena ao vivo" subtitle="Batalhas abertas para revisão rápida e competitiva." />
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recomendações</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Cursos em destaque para sua fase</h2>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Trophy size={18} />
          </span>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {recommended.length ? (
            recommended.map((item) => <CourseCard key={item.course.id} item={item} />)
          ) : (
            <div className="xl:col-span-3">
              <EmptyState title="Sem recomendações no momento" description="Quando o RH publicar novos cursos ou trilhas, eles aparecerão aqui." />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
