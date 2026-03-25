import { Award, Clock3 } from "lucide-react";
import type { LmsCourseDetail } from "@/lib/lms/types";
import { ProgressBar } from "@/components/lms/ProgressBar";

export function CourseHeader({ detail }: { detail: LmsCourseDetail }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-56 bg-slate-100">
        {detail.course.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.course.banner_url} alt={detail.course.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="grid gap-8 p-6 lg:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{detail.course.category ?? "Treinamento"}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{detail.course.title}</h1>
          </div>
          <p className="text-sm leading-7 text-slate-600">{detail.course.full_description ?? detail.course.short_description ?? "Curso corporativo."}</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
