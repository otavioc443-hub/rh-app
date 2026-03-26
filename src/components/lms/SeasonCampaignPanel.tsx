"use client";

import { Target, Trophy, Zap } from "lucide-react";
import type { LmsSeasonCampaign } from "@/lib/lms/types";

export function SeasonCampaignPanel({
  campaign,
  audience = "learner",
}: {
  campaign: LmsSeasonCampaign;
  audience?: "learner" | "admin";
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {audience === "learner" ? "Campanha da temporada" : "Campanha mensal"}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{campaign.missionTitle}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{campaign.missionDescription}</p>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{campaign.seasonLabel}</span>
        </div>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">XP da temporada</span>
              <Zap size={16} className="text-sky-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{campaign.totalXp}</div>
          </article>

          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Desafios fechados</span>
              <Target size={16} className="text-emerald-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">
              {campaign.completedChallenges}/{campaign.totalChallenges}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">
                {audience === "learner" ? "Ritmo atual" : "Indicador de consistencia"}
              </span>
              <Trophy size={16} className="text-amber-500" />
            </div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{campaign.streakDays}</div>
            <div className="mt-1 text-xs text-slate-500">{audience === "learner" ? "dias de streak" : "dias de media"}</div>
          </article>
        </div>

        <div className="space-y-3">
          {campaign.goals.map((goal) => (
            <article key={goal.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{goal.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {goal.current}/{goal.target} {goal.unit}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {goal.completionPercent}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${goal.completionPercent}%` }} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
