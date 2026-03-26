"use client";

import { Award, Sparkles, ShieldCheck, Target } from "lucide-react";
import type { LmsUserBadge } from "@/lib/lms/types";

function iconForBadge(slug: string | undefined) {
  if (!slug) return Award;
  if (slug.includes("quiz")) return Target;
  if (slug.includes("maraton")) return Sparkles;
  if (slug.includes("curso")) return ShieldCheck;
  return Award;
}

export function BadgeShelf({
  items,
  title = "Conquistas desbloqueadas",
  subtitle = "Badges reconhecem consistência, domínio e impacto no aprendizado.",
}: {
  items: LmsUserBadge[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Conquistas</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {items.length ? (
          items.map((item) => {
            const Icon = iconForBadge(item.badge?.slug);
            return (
              <article key={item.id} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <span
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: item.badge?.accent_color ?? "#0f172a" }}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(item.awarded_at))}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{item.badge?.title ?? "Badge"}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.badge?.description ?? "Conquista registrada na sua jornada."}</p>
              </article>
            );
          })
        ) : (
          <div className="md:col-span-2 xl:col-span-3 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            Ainda não há badges conquistados. Concluir aulas, quizzes e desafios começará a preencher esta vitrine.
          </div>
        )}
      </div>
    </section>
  );
}
