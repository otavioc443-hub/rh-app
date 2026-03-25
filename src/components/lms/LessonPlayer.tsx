import Link from "next/link";
import { ArrowRight, FileDown } from "lucide-react";
import type { LmsLesson } from "@/lib/lms/types";

export function LessonPlayer({
  lesson,
  nextLessonHref,
  onComplete,
  completing,
}: {
  lesson: LmsLesson;
  nextLessonHref?: string | null;
  onComplete?: () => Promise<void> | void;
  completing?: boolean;
}) {
  const isVideo = lesson.lesson_type === "video";
  const isPdf = lesson.lesson_type === "pdf";
  const isLink = lesson.lesson_type === "link";

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{lesson.lesson_type}</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{lesson.title}</h2>
        {lesson.description ? <p className="mt-3 text-sm leading-7 text-slate-600">{lesson.description}</p> : null}
      </div>
      {isVideo && lesson.content_url ? (
        <video controls className="aspect-video w-full rounded-3xl bg-slate-900" src={lesson.content_url} />
      ) : null}
      {isPdf && lesson.content_url ? (
        <iframe src={lesson.content_url} title={lesson.title} className="h-[620px] w-full rounded-3xl border border-slate-200" />
      ) : null}
      {isLink && lesson.content_url ? (
        <a href={lesson.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
          <FileDown size={16} />
          Abrir material
        </a>
      ) : null}
      {lesson.lesson_type === "texto" && lesson.content_text ? (
        <article className="prose prose-slate max-w-none rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div dangerouslySetInnerHTML={{ __html: lesson.content_text }} />
        </article>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {onComplete ? (
          <button type="button" onClick={() => void onComplete()} disabled={completing} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {completing ? "Salvando..." : "Marcar como concluida"}
          </button>
        ) : null}
        {nextLessonHref ? (
          <Link href={nextLessonHref} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
            Proxima aula
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
