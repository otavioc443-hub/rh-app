"use client";

import { Crown, Flame, Medal } from "lucide-react";
import type { LmsLeaderboardRow } from "@/lib/lms/types";

function rankTone(rank: number) {
  if (rank === 1) return "border-amber-200 bg-amber-50 text-amber-800";
  if (rank === 2) return "border-slate-200 bg-slate-100 text-slate-700";
  if (rank === 3) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function LeaderboardTable({
  rows,
  title = "Ranking de aprendizagem",
  subtitle = "Quem mais acumulou XP e constancia nesta temporada.",
  compact = false,
}: {
  rows: LmsLeaderboardRow[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Leaderboard</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="space-y-3 p-5">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.user_id}
              className={`grid gap-3 rounded-[24px] border px-4 py-4 ${rankTone(row.rank)} ${
                compact ? "md:grid-cols-[auto,1fr,auto]" : "md:grid-cols-[auto,1.2fr,0.8fr,auto]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                  #{row.rank}
                </span>
                {row.rank <= 3 ? (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                    {row.rank === 1 ? <Crown size={18} /> : <Medal size={18} />}
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{row.full_name}</div>
                <div className="mt-1 text-xs text-slate-500">{row.department_name ?? "Sem departamento"}</div>
              </div>

              {!compact ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">XP</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{row.xp}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Nivel</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{row.level}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Badges</div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{row.badges}</div>
                  </div>
                </div>
              ) : null}

              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-medium text-slate-700">
                <Flame size={16} className="text-orange-500" />
                {row.streak} dias
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            O ranking sera preenchido assim que a gamificacao comecar a registrar XP.
          </div>
        )}
      </div>
    </section>
  );
}
