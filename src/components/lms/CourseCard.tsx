"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, PlayCircle, Star } from "lucide-react";
import { CourseStatusBadge } from "@/components/lms/CourseStatusBadge";
import { ProgressBar } from "@/components/lms/ProgressBar";
import type { LmsMyTrainingCard } from "@/lib/lms/types";

function formatDateBr(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) return "Sem prazo";
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-");
    return `Prazo ${day}/${month}/${year}`;
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return `Prazo ${normalized}`;
  return `Prazo ${new Intl.DateTimeFormat("pt-BR").format(date)}`;
}

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
    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-72 bg-slate-100">
        {item.course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.course.thumbnail_url} alt={item.course.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Sem capa</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
        <button
          type="button"
          onClick={toggleSaved}
          className={`absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${saved ? "border-amber-200 bg-amber-50 text-amber-600" : "border-white/30 bg-white/90 text-slate-600"} shadow-sm`}
          aria-label={saved ? "Remover dos salvos" : "Salvar para depois"}
        >
          <Star size={16} fill={saved ? "currentColor" : "none"} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <CourseStatusBadge status={item.status} />
            {item.course.required ? (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">Obrigatorio</span>
            ) : null}
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
            {item.course.category ?? "Treinamento"}
          </p>
          <h3 className="mt-2 line-clamp-3 text-2xl font-semibold leading-tight">{item.course.title}</h3>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="line-clamp-2 text-sm leading-6 text-slate-600">
          {item.course.short_description ?? item.course.full_description ?? "Conteudo disponivel para desenvolvimento profissional."}
        </p>
        <div className="rounded-[24px] bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">Progresso</span>
            <span className="font-semibold text-slate-950">{progress}%</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={14} />
              {item.course.workload_hours ?? 0}h
            </span>
            <span>{formatDateBr(item.assignment?.due_date)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Link
            href={`/lms/cursos/${item.course.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            {progress > 0 && item.status !== "completed" ? <PlayCircle size={16} /> : <ArrowRight size={16} />}
            {primaryLabel}
          </Link>
          <div className="text-center text-xs font-medium text-slate-500">
            {saved ? "Salvo para continuar depois" : "Use a estrela no topo para salvar este curso"}
          </div>
        </div>
      </div>
    </div>
  );
}
