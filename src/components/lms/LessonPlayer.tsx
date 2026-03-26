"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, FileDown, FileText, PlayCircle } from "lucide-react";
import type { LmsLesson } from "@/lib/lms/types";

function lessonTypeLabel(type: LmsLesson["lesson_type"]) {
  if (type === "video") return "Video";
  if (type === "pdf") return "PDF";
  if (type === "arquivo") return "Arquivo";
  if (type === "link") return "Link";
  if (type === "avaliacao") return "Avaliacao";
  return "Texto";
}

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
  const [autoMarked, setAutoMarked] = useState(false);
  const isVideo = lesson.lesson_type === "video";
  const isPdf = lesson.lesson_type === "pdf";
  const isLink = lesson.lesson_type === "link" || lesson.lesson_type === "arquivo";

  async function handleAutoComplete() {
    if (!onComplete || autoMarked) return;
    setAutoMarked(true);
    await onComplete();
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{lessonTypeLabel(lesson.lesson_type)}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{lesson.title}</h2>
          {lesson.description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{lesson.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Clock3 size={14} />
              {lesson.duration_minutes ?? 0} min
            </span>
          </span>
          {lesson.is_required ? <span className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Obrigatoria</span> : null}
        </div>
      </div>

      {isVideo && lesson.content_url ? (
        <div className="space-y-3">
          <video controls className="aspect-video w-full rounded-3xl bg-slate-900" src={lesson.content_url} onEnded={() => void handleAutoComplete()} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Ao assistir o video ate o final, a aula sera marcada como concluida automaticamente.
          </div>
        </div>
      ) : null}

      {isPdf && lesson.content_url ? (
        <div className="space-y-3">
          <iframe src={lesson.content_url} title={lesson.title} className="h-[620px] w-full rounded-3xl border border-slate-200" />
          <a href={lesson.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
            <FileDown size={16} />
            Baixar PDF
          </a>
        </div>
      ) : null}

      {isLink && lesson.content_url ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700">
              <FileText size={18} />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Material da aula</div>
              <div className="mt-1 text-sm text-slate-600">Abra o arquivo ou link principal para consumir este conteudo.</div>
            </div>
          </div>
          <a href={lesson.content_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
            <FileDown size={16} />
            Abrir material
          </a>
        </div>
      ) : null}

      {lesson.lesson_type === "texto" && lesson.content_text ? (
        <article className="prose prose-slate max-w-none rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <div dangerouslySetInnerHTML={{ __html: lesson.content_text }} />
        </article>
      ) : null}

      {lesson.lesson_type === "avaliacao" && !lesson.content_url && !lesson.content_text ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Esta etapa funciona como avaliacao. O questionario correspondente aparece logo abaixo quando estiver configurado.
        </div>
      ) : null}

      {!lesson.content_url && !lesson.content_text && lesson.lesson_type !== "avaliacao" ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          O conteudo principal desta aula ainda nao foi configurado pelo RH.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {onComplete ? (
          <button type="button" onClick={() => void onComplete()} disabled={completing} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <PlayCircle size={16} />
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
