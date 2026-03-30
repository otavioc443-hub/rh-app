import { Award, Clock3, Layers3, PlaySquare } from "lucide-react";
import type { LmsCourseDetail } from "@/lib/lms/types";

export function CourseHeader({ detail }: { detail: LmsCourseDetail }) {
  const lessonCount = detail.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const progress = Math.round(detail.progress?.progress_percent ?? 0);

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-[#171717] text-white shadow-sm">
      <div className="relative min-h-[320px] bg-slate-900">
        {detail.course.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.course.banner_url} alt={detail.course.title} className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060606] via-[#060606]/78 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <div className="flex flex-wrap items-end gap-5">
            <div className="h-20 w-20 overflow-hidden rounded-[24px] border border-white/15 bg-white/10 shadow-xl backdrop-blur md:h-24 md:w-24">
              {detail.course.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.course.thumbnail_url} alt={detail.course.title} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">
                {detail.course.category ?? "Treinamento"}
              </p>
              <h1 className="mt-2 max-w-4xl text-3xl font-bold md:text-4xl">{detail.course.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 md:text-base">
                {detail.course.short_description ?? detail.course.full_description ?? "Curso corporativo."}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-white/75">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{detail.modules.length} fases</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{lessonCount} aulas</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{progress}% concluido</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 border-t border-slate-800 bg-[#121212] p-5 md:grid-cols-[1fr_1fr_1fr_1.2fr]">
        <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
            <Clock3 size={14} />
            Carga horaria
          </div>
          <div className="mt-3 text-2xl font-semibold">{detail.course.workload_hours ?? 0} hora(s)</div>
          <div className="mt-1 text-sm text-white/45">Tempo total previsto para concluir.</div>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
            <Layers3 size={14} />
            Fases
          </div>
          <div className="mt-3 text-2xl font-semibold">{detail.modules.length}</div>
          <div className="mt-1 text-sm text-white/45">Jornada dividida em etapas curtas.</div>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
            <PlaySquare size={14} />
            Aulas
          </div>
          <div className="mt-3 text-2xl font-semibold">{lessonCount}</div>
          <div className="mt-1 text-sm text-white/45">Conteudos disponiveis nesta trilha.</div>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Award size={16} />
            Nota minima: {detail.course.passing_score ?? 70}%
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-white/60">
            <span>Progresso total</span>
            <span>{progress}% concluido</span>
          </div>
        </div>
      </div>
    </div>
  );
}
