"use client";

import Link from "next/link";
import { Flame, Medal, Sparkles, Swords, Trophy } from "lucide-react";
import type { LmsGamificationOverview } from "@/lib/lms/types";

export function GamificationHero({ data }: { data: LmsGamificationOverview }) {
  const xp = data.xp?.total_xp ?? 0;
  const level = data.xp?.level ?? 1;
  const streak = data.streak?.current_streak ?? 0;
  const nextLevelXp = data.nextLevelXp;
  const levelProgress = nextLevelXp > 0 ? Math.min(100, Math.round(((xp % nextLevelXp) / nextLevelXp) * 100)) : 0;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eff6ff_28%,#ffffff_65%),linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 shadow-sm lg:p-7">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Aprender jogando</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950">
            Evolua com XP, streak, conquistas e desafios conectados ao seu aprendizado.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Cada aula concluida, quiz aprovado e curso finalizado fortalece sua posicao na temporada e ajuda a manter sua rotina de evolucao.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/lms/ranking" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Ver ranking
            </Link>
            <Link href="/lms/desafios" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
              Explorar desafios
            </Link>
            <Link href="/lms/batalhas" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
              Abrir arena
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] bg-slate-950 p-5 text-white shadow-sm sm:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">Temporada atual</p>
                <h3 className="mt-2 text-2xl font-semibold">{data.seasonLabel}</h3>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Trophy size={20} />
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lime-400" style={{ width: `${levelProgress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-white/80">
              <span>{xp} XP acumulado</span>
              <span>Proximo nivel em {nextLevelXp} XP</span>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Nivel atual</span>
              <Medal size={18} className="text-amber-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{level}</div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Streak</span>
              <Flame size={18} className="text-orange-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{streak}</div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Badges</span>
              <Sparkles size={18} className="text-sky-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{data.badges.length}</div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Batalhas vivas</span>
              <Swords size={18} className="text-rose-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{data.battles.length}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
