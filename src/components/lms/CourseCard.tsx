"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, Clock3, PlayCircle, Star } from "lucide-react";
import { CourseStatusBadge } from "@/components/lms/CourseStatusBadge";
import { ProgressBar } from "@/components/lms/ProgressBar";
import type { LmsMyTrainingCard } from "@/lib/lms/types";

export function CourseCard({ item }: { item: LmsMyTrainingCard }) {
  const [saved, setSaved] = useState(false);
  const progress = Math.round(item.progress?.progress_percent ?? 0);
  const primaryLabel =
    item.status === "completed"
      ? "Ver detalhes"
      : progress > 0
        ? "Continuar"
        : "Iniciar";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = JSON.parse(window.localStorage.getItem("lms:saved-courses") ?? "[]") as string[];
    setSaved(current.includes(item.course.id));
  }, [item.course.id]);

  function toggleSaved() {
    if (typeof window === "undefined") return;
    const current = JSON.parse(window.localStorage.getItem("lms:saved-courses") ?? "[]") as string[];
    const next = saved ? current.filter((id) => id !== item.course.id) : Array.from(new Set([...current, item.course.id]));
    window.localStorage.setItem("lms:saved-courses", JSON.stringify(next));
    setSaved(!saved);
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-44 bg-slate-100">
        {item.course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.course.thumbnail_url} alt={item.course.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Sem capa</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/45 to-transparent" />
        <button
          type="button"
          onClick={toggleSaved}
          className={`absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${saved ? "border-amber-200 bg-amber-50 text-amber-600" : "border-white/30 bg-white/90 text-slate-600"} shadow-sm`}
          aria-label={saved ? "Remover dos salvos" : "Salvar para depois"}
        >
          <Star size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <CourseStatusBadge status={item.status} />
            {item.course.required ? (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Obrigatorio</span>
            ) : null}
            {item.course.certificate_enabled ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Com certificado</span>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              {item.course.category ?? "Treinamento"}
            </p>
          <h3 className="mt-1 text-xl font-semibold leading-tight text-slate-900">{item.course.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
            {item.course.short_description ?? item.course.full_description ?? "Conteudo disponivel para desenvolvimento profissional."}
          </p>
        </div>
        <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">Progresso atual</span>
            <span className="font-semibold text-slate-950">{progress}%</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1">
            <Clock3 size={14} />
            {item.course.workload_hours ?? 0}h
          </span>
          <span className="rounded-full bg-slate-50 px-3 py-1">
            {item.assignment?.due_date ? `Prazo: ${item.assignment.due_date}` : "Sem prazo"}
          </span>
        </div>
        <div className="text-xs text-slate-500">{saved ? "Salvo para retomar depois" : "Voce pode salvar este curso para acompanhar depois"}</div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Link
            href={`/lms/cursos/${item.course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            {progress > 0 && item.status !== "completed" ? <PlayCircle size={16} /> : <ArrowRight size={16} />}
            {primaryLabel}
          </Link>
          <Link
            href={`/lms/cursos/${item.course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <Award size={16} />
            Jornada
          </Link>
        </div>
      </div>
    </div>
  );
}
