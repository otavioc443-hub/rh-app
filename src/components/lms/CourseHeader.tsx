import { Award, Clock3, Layers3, PlaySquare } from "lucide-react";
import type { LmsCourseDetail } from "@/lib/lms/types";

export function CourseHeader({ detail }: { detail: LmsCourseDetail }) {
  const lessonCount = detail.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const progress = Math.round(detail.progress?.progress_percent ?? 0);

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-[#171717] text-white shadow-sm">
      <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
              {detail.course.category ?? "Treinamento"}
            </p>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold md:text-4xl">{detail.course.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72 md:text-base">
              {detail.course.short_description ?? detail.course.full_description ?? "Curso corporativo."}
            </p>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-white/60">
              <span>Progresso atual</span>
              <span>{progress}% concluido</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-white/75">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{detail.modules.length} fases</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{lessonCount} aulas</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Nota minima {detail.course.passing_score ?? 70}%</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-white/62 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                <Clock3 size={14} />
                Carga horaria
              </div>
              <div className="mt-2 font-semibold text-white">{detail.course.workload_hours ?? 0} hora(s)</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                <Layers3 size={14} />
                Fases
              </div>
              <div className="mt-2 font-semibold text-white">{detail.modules.length}</div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-white/[0.035] px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                <PlaySquare size={14} />
                Aulas
              </div>
              <div className="mt-2 font-semibold text-white">{lessonCount}</div>
            </div>
          </div>

          {detail.course.certificate_enabled ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Award size={14} />
              Certificado habilitado
            </div>
          ) : null}
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[#101010]">
          {detail.course.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.course.banner_url} alt={detail.course.title} className="absolute inset-0 h-full w-full object-cover opacity-80" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
          <div className="relative flex h-full min-h-[260px] flex-col justify-between p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-[22px] border border-white/15 bg-white/10 backdrop-blur">
                {detail.course.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.course.thumbnail_url} alt={detail.course.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white/75">
                {progress}% concluido
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Jornada do curso</div>
              <div className="mt-2 max-w-sm text-lg font-semibold text-white">
                {detail.modules.length > 1 ? "Siga as fases da trilha para manter o ritmo de aprendizado." : "Comece pela primeira aula e avance no fluxo da trilha."}
              </div>
              <div className="mt-3 text-sm text-white/60">
                {detail.course.sequence_required ? "A ordem das aulas ajuda a manter a experiencia mais simples para o colaborador." : "As aulas podem ser exploradas no ritmo de cada pessoa."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
