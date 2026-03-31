"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, FileDown, FileText, PlayCircle } from "lucide-react";
import type { LmsLesson } from "@/lib/lms/types";
import { parseStorageRef } from "@/lib/lms/utils";

function lessonTypeLabel(type: LmsLesson["lesson_type"]) {
  if (type === "video") return "Video";
  if (type === "pdf") return "PDF";
  if (type === "arquivo") return "Arquivo";
  if (type === "link") return "Link";
  if (type === "avaliacao") return "Avaliacao";
  return "Texto";
}

function getEmbeddedVideoUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (host.includes("youtu.be")) {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (host.includes("vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (!videoId) return null;
      return `https://player.vimeo.com/video/${videoId}`;
    }

    return null;
  } catch {
    return null;
  }
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
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(lesson.content_url ?? null);
  const isVideo = lesson.lesson_type === "video";
  const isPdf = lesson.lesson_type === "pdf";
  const isLink = lesson.lesson_type === "link" || lesson.lesson_type === "arquivo";
  const embeddedVideoUrl = isVideo ? getEmbeddedVideoUrl(resolvedUrl) : null;

  useEffect(() => {
    let active = true;
    const currentUrl = lesson.content_url ?? null;
    const parsed = parseStorageRef(currentUrl);
    if (!parsed) {
      setResolvedUrl(currentUrl);
      return () => {
        active = false;
      };
    }

    async function resolve() {
      try {
        const params = new URLSearchParams({ ref: currentUrl ?? "" });
        const response = await fetch(`/api/lms/storage/resolve?${params.toString()}`);
        const data = (await response.json()) as { signedUrl?: string | null };
        if (active) setResolvedUrl(data.signedUrl ?? null);
      } catch {
        if (active) setResolvedUrl(null);
      }
    }

    void resolve();

    return () => {
      active = false;
    };
  }, [lesson.content_url]);

  async function handleAutoComplete() {
    if (!onComplete || autoMarked) return;
    setAutoMarked(true);
    await onComplete();
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-800 bg-[#171717] p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">{lessonTypeLabel(lesson.lesson_type)}</p>
          <h2 className="mt-2 text-2xl font-bold text-white">{lesson.title}</h2>
          {lesson.description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{lesson.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/75">
            <span className="inline-flex items-center gap-2">
              <Clock3 size={14} />
              {lesson.duration_minutes ?? 0} min
            </span>
          </span>
          {lesson.is_required ? <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-950">Obrigatoria</span> : null}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 rounded-full bg-white/75" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-slate-800 py-3 text-xs text-white/60">
        <span className="rounded-full bg-white/5 px-3 py-2">{lessonTypeLabel(lesson.lesson_type)}</span>
        <span className="rounded-full bg-white/5 px-3 py-2">
          {lesson.lesson_type === "video" ? "Assistir ate o final" : lesson.lesson_type === "avaliacao" ? "Responder o questionario" : "Consumir e concluir"}
        </span>
        {nextLessonHref ? <span className="rounded-full bg-white/5 px-3 py-2">Ha uma proxima aula</span> : null}
      </div>

      {isVideo && resolvedUrl ? (
        <div className="space-y-3">
          {embeddedVideoUrl ? (
            <div className="overflow-hidden rounded-3xl bg-slate-900">
              <iframe
                src={embeddedVideoUrl}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="aspect-video w-full"
              />
            </div>
          ) : (
            <video
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-3xl bg-slate-900"
              src={resolvedUrl}
              onEnded={() => void handleAutoComplete()}
            />
          )}
          <div className="rounded-2xl border border-slate-800 bg-white/5 px-4 py-3 text-sm text-white/65">
            {embeddedVideoUrl
              ? "Se o video estiver em plataforma externa, use o player incorporado ou abra em nova aba se preferir."
              : "Ao assistir o video ate o final, a aula sera marcada como concluida automaticamente."}
          </div>
          <a href={resolvedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white">
            <PlayCircle size={16} />
            Abrir video em nova aba
          </a>
        </div>
      ) : null}

      {isPdf && resolvedUrl ? (
        <div className="space-y-3">
          <iframe src={resolvedUrl} title={lesson.title} className="h-[620px] w-full rounded-3xl border border-slate-800 bg-white" />
          <a href={resolvedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white">
            <FileDown size={16} />
            Baixar PDF
          </a>
        </div>
      ) : null}

      {isLink && resolvedUrl ? (
        <div className="rounded-3xl border border-slate-800 bg-white/5 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
              <FileText size={18} />
            </span>
            <div>
              <div className="text-sm font-semibold text-white">Material da aula</div>
              <div className="mt-1 text-sm text-white/65">Abra o arquivo ou link principal para consumir este conteudo.</div>
            </div>
          </div>
          <a href={resolvedUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-transparent px-4 py-2 text-sm font-semibold text-white">
            <FileDown size={16} />
            Abrir material
          </a>
        </div>
      ) : null}

      {lesson.lesson_type === "texto" && lesson.content_text ? (
        <article className="prose prose-invert max-w-none rounded-3xl border border-slate-800 bg-white/5 p-5">
          <div dangerouslySetInnerHTML={{ __html: lesson.content_text }} />
        </article>
      ) : null}

      {lesson.lesson_type === "avaliacao" && !lesson.content_url && !lesson.content_text ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-white/5 p-5 text-sm text-white/65">
          Esta etapa funciona como avaliacao. O questionario correspondente aparece logo abaixo quando estiver configurado.
        </div>
      ) : null}

      {!resolvedUrl && !lesson.content_text && lesson.lesson_type !== "avaliacao" ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-white/5 p-5 text-sm text-white/65">
          O conteudo principal desta aula ainda nao foi configurado pelo RH.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {onComplete ? (
          <button type="button" onClick={() => void onComplete()} disabled={completing} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            <PlayCircle size={16} />
            {completing ? "Salvando..." : "Marcar como concluida"}
          </button>
        ) : null}
        {nextLessonHref ? (
          <Link href={nextLessonHref} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white">
            Proxima aula
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
