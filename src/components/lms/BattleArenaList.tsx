"use client";

import { Swords, TimerReset, UsersRound } from "lucide-react";
import type { LmsGameSession } from "@/lib/lms/types";

export function BattleArenaList({
  sessions,
  title = "Batalhas de conhecimento",
  subtitle = "Sessões competitivas para revisar conteúdo com urgência e foco.",
}: {
  sessions: LmsGameSession[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Arena</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="space-y-4 p-5">
        {sessions.length ? (
          sessions.map((session) => (
            <article key={session.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-5 text-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <Swords size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{session.title}</h3>
                    <p className="text-sm text-slate-300">{session.description ?? "Sessão competitiva de revisão."}</p>
                  </div>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                  {session.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-200">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <UsersRound size={14} />
                  até {session.max_participants ?? 10} pessoas
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                  <TimerReset size={14} />
                  {session.started_at
                    ? `início ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(session.started_at))}`
                    : "aguardando início"}
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            Nenhuma batalha ativa agora. O módulo já está preparado para receber sessões em tempo determinado.
          </div>
        )}
      </div>
    </section>
  );
}
