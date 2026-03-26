"use client";

import { CalendarClock, Flame, Trophy } from "lucide-react";
import type { LmsChallenge, LmsChallengeParticipant } from "@/lib/lms/types";

type ChallengeWithParticipant = LmsChallenge & { participant: LmsChallengeParticipant | null };

export function ChallengesRail({
  items,
  title = "Desafios ativos",
  subtitle = "Missões diárias e semanais para aprender jogando.",
}: {
  items: ChallengeWithParticipant[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Desafios</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        {items.length ? (
          items.map((item) => {
            const progress = item.participant?.progress_value ?? 0;
            const target = item.target_value ?? 0;
            const completion = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
            return (
              <article key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    {item.challenge_type}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    <CalendarClock size={14} />
                    até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(item.ends_at))}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description ?? "Desafio ativo da temporada."}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${completion}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold text-slate-700">
                    <Flame size={14} className="text-orange-500" />
                    {progress}/{target || "livre"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                    <Trophy size={14} />
                    +{item.xp_reward} XP
                  </span>
                  {item.reward_label ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">{item.reward_label}</span>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className="lg:col-span-2 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            Nenhum desafio ativo no momento. O RH pode abrir novas temporadas e missões diretamente no módulo.
          </div>
        )}
      </div>
    </section>
  );
}
