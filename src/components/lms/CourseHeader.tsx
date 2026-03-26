import { Award, Clock3 } from "lucide-react";
import { ProgressBar } from "@/components/lms/ProgressBar";
import type { LmsCourseDetail } from "@/lib/lms/types";

export function CourseHeader({ detail }: { detail: LmsCourseDetail }) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      <div className="relative h-60 bg-slate-100">
        {detail.course.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.course.banner_url} alt={detail.course.title} className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />
      </div>
      <div className="grid gap-8 p-6 lg:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              {detail.course.category ?? "Treinamento"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{detail.course.title}</h1>
          </div>
          <p className="text-sm leading-7 text-slate-600">
            {detail.course.full_description ?? detail.course.short_description ?? "Curso corporativo."}
          </p>
          <div className="flex flex-wrap gap-2">
            {detail.course.required ? (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                Obrigatorio
              </span>
            ) : null}
            {detail.course.certificate_enabled ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Certificado habilitado
              </span>
            ) : null}
            {detail.course.sequence_required ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Sequencia por fases
              </span>
            ) : null}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock3 size={16} />
              {detail.course.workload_hours ?? 0} hora(s)
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Award size={16} />
              Nota minima: {detail.course.passing_score ?? 70}
            </div>
            <ProgressBar value={detail.progress?.progress_percent ?? 0} />
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Modulos</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{detail.modules.length}</div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Aulas</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {detail.modules.reduce((sum, module) => sum + module.lessons.length, 0)}
                </div>
              </div>
              <div className="rounded-2xl bg-white px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Progresso</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {Math.round(detail.progress?.progress_percent ?? 0)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
