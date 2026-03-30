import { Award, Clock3 } from "lucide-react";
import { ProgressBar } from "@/components/lms/ProgressBar";
import type { LmsCourseDetail } from "@/lib/lms/types";

export function CourseHeader({ detail }: { detail: LmsCourseDetail }) {
  const lessonCount = detail.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const progress = Math.round(detail.progress?.progress_percent ?? 0);

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-[#171717] text-white shadow-sm">
      <div className="relative h-72 bg-slate-900">
        {detail.course.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.course.banner_url} alt={detail.course.title} className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-[24px] border border-white/15 bg-white/10 shadow-xl backdrop-blur">
              {detail.course.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.course.thumbnail_url} alt={detail.course.title} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">
                {detail.course.category ?? "Treinamento"}
              </p>
              <h1 className="mt-2 text-3xl font-bold">{detail.course.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                {detail.course.short_description ?? detail.course.full_description ?? "Curso corporativo."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/75">
                <span className="rounded-full bg-white/10 px-3 py-1.5">{detail.modules.length} fases</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">{lessonCount} aulas</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">{progress}% concluido</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 border-t border-slate-800 p-6 md:grid-cols-4">
        <div className="rounded-2xl bg-white/5 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Carga horaria</div>
          <div className="mt-2 text-lg font-semibold">{detail.course.workload_hours ?? 0} hora(s)</div>
        </div>
        <div className="rounded-2xl bg-white/5 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Fases</div>
          <div className="mt-2 text-lg font-semibold">{detail.modules.length}</div>
        </div>
        <div className="rounded-2xl bg-white/5 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Aulas</div>
          <div className="mt-2 text-lg font-semibold">{lessonCount}</div>
        </div>
        <div className="rounded-2xl bg-white/5 px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Clock3 size={16} />
            {detail.course.workload_hours ?? 0} hora(s)
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
            <Award size={16} />
            Nota minima: {detail.course.passing_score ?? 70}%
          </div>
          <div className="mt-4">
            <ProgressBar value={detail.progress?.progress_percent ?? 0} />
          </div>
          <div className="mt-2 text-sm text-white/70">{progress}% concluido</div>
        </div>
      </div>
    </div>
  );
}
