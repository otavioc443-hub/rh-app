"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, FileDown, FileText } from "lucide-react";
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
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=1`;
    }

    if (host.includes("youtu.be")) {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (!videoId) return null;
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=1`;
    }

    if (host.includes("vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (!videoId) return null;
      return `https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0&badge=0&share=0`;
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
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(lesson.content_url ?? null);
  const articleRef = useRef<HTMLElement | null>(null);
  const isVideo = lesson.lesson_type === "video";
  const isPdf = lesson.lesson_type === "pdf";
  const isLink = lesson.lesson_type === "link" || lesson.lesson_type === "arquivo";
  const embeddedVideoUrl = isVideo ? getEmbeddedVideoUrl(resolvedUrl) : null;
  const showManualComplete = false;
  const autoCompleteHint = useMemo(() => {
    if (lesson.lesson_type === "video") return "A aula sera concluida automaticamente perto do fim da reproducao.";
    if (lesson.lesson_type === "pdf") return "A leitura do PDF registra a conclusao automaticamente apos a abertura.";
    if (lesson.lesson_type === "texto") return "Ao ler esta etapa, a conclusao sera registrada automaticamente.";
    if (lesson.lesson_type === "arquivo" || lesson.lesson_type === "link") return "Ao abrir o material principal, a aula sera concluida automaticamente.";
    return null;
  }, [lesson.lesson_type]);

  useEffect(() => {
    setAutoMarked(false);
    setPdfLoaded(false);
    setResolvedUrl(lesson.content_url ?? null);
  }, [lesson.id, lesson.content_url]);

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

  useEffect(() => {
    if (!isPdf || !resolvedUrl || !pdfLoaded || autoMarked) return;
    const timer = window.setTimeout(() => {
      void handleAutoComplete();
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [isPdf, resolvedUrl, pdfLoaded, autoMarked]);

  useEffect(() => {
    if (lesson.lesson_type !== "texto" || !lesson.content_text || autoMarked) return;
    const article = articleRef.current;
    if (!article) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        window.setTimeout(() => {
          void handleAutoComplete();
        }, 8000);
      },
      { threshold: 0.6 },
    );

    observer.observe(article);
    return () => observer.disconnect();
  }, [lesson.lesson_type, lesson.content_text, autoMarked]);

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{lessonTypeLabel(lesson.lesson_type)}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">{lesson.title}</h2>
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

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/3 rounded-full bg-slate-900" />
      </div>

      {isVideo && resolvedUrl ? (
        <div className="space-y-3">
          {embeddedVideoUrl ? (
            <div className="overflow-hidden rounded-3xl bg-slate-100">
              <iframe
                src={embeddedVideoUrl}
                title={lesson.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-same-origin allow-scripts allow-presentation"
                className="aspect-video w-full"
              />
            </div>
          ) : (
            <video
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-3xl bg-slate-100"
              src={resolvedUrl}
              onTimeUpdate={(event) => {
                const element = event.currentTarget;
                if (!Number.isFinite(element.duration) || element.duration <= 0) return;
                if (element.currentTime >= Math.max(element.duration - 15, element.duration * 0.9)) {
                  void handleAutoComplete();
                }
              }}
              onEnded={() => void handleAutoComplete()}
            />
          )}
          {autoCompleteHint ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{autoCompleteHint}</div> : null}
        </div>
      ) : null}

      {isPdf && resolvedUrl ? (
        <div className="space-y-3">
          <iframe src={resolvedUrl} title={lesson.title} className="h-[620px] w-full rounded-3xl border border-slate-200 bg-white" onLoad={() => setPdfLoaded(true)} />
          <a href={resolvedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
            <FileDown size={16} />
            Baixar PDF
          </a>
          {autoCompleteHint ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{autoCompleteHint}</div> : null}
        </div>
      ) : null}

      {isLink && resolvedUrl ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <FileText size={18} />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Material da aula</div>
              <div className="mt-1 text-sm text-slate-600">Abra o arquivo ou link principal para consumir este conteudo.</div>
            </div>
          </div>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              void handleAutoComplete();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            <FileDown size={16} />
            Abrir material
          </a>
          {autoCompleteHint ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{autoCompleteHint}</div> : null}
        </div>
      ) : null}

      {lesson.lesson_type === "texto" && lesson.content_text ? (
        <article ref={articleRef} className="prose prose-slate max-w-none rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div dangerouslySetInnerHTML={{ __html: lesson.content_text }} />
        </article>
      ) : null}

      {lesson.lesson_type === "texto" && autoCompleteHint ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{autoCompleteHint}</div> : null}

      {lesson.lesson_type === "avaliacao" && !lesson.content_url && !lesson.content_text ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          Esta etapa funciona como avaliacao. O questionario correspondente aparece logo abaixo quando estiver configurado.
        </div>
      ) : null}

      {!resolvedUrl && !lesson.content_text && lesson.lesson_type !== "avaliacao" ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          O conteudo principal desta aula ainda nao foi configurado pelo RH.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {showManualComplete && onComplete ? (
          <button type="button" onClick={() => void onComplete()} disabled={completing} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {completing ? "Salvando..." : "Marcar como concluida"}
          </button>
        ) : null}
        {nextLessonHref ? (
          <Link href={nextLessonHref} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
            Proxima aula
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
