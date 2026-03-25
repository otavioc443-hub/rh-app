import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import type { LmsMyTrainingCard } from "@/lib/lms/types";
import { CourseStatusBadge } from "@/components/lms/CourseStatusBadge";
import { ProgressBar } from "@/components/lms/ProgressBar";

export function CourseCard({ item }: { item: LmsMyTrainingCard }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-40 bg-slate-100">
        {item.course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.course.thumbnail_url} alt={item.course.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Sem capa</div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CourseStatusBadge status={item.status} />
          {item.course.required ? <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Obrigatorio</span> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{item.course.category ?? "Treinamento"}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.course.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{item.course.short_description ?? item.course.full_description ?? "Conteudo disponivel para desenvolvimento profissional."}</p>
        </div>
        <ProgressBar value={item.progress?.progress_percent ?? 0} />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} />
            {item.course.workload_hours ?? 0}h
          </span>
          <span>{item.assignment?.due_date ? `Prazo: ${item.assignment.due_date}` : "Sem prazo"}</span>
        </div>
        <Link
          href={`/lms/cursos/${item.course.id}`}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Abrir treinamento
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
