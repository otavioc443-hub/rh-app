"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { CourseHeader } from "@/components/lms/CourseHeader";
import { ModuleAccordion } from "@/components/lms/ModuleAccordion";
import { CertificateButton } from "@/components/lms/CertificateButton";
import { useCourseDetail } from "@/hooks/lms/useCourseDetail";
import { getRequiredLessonsSummary, getResumeLesson } from "@/lib/lms/utils";
import type { LmsCourseDetail } from "@/lib/lms/types";

export function CourseDetailClient({ detail }: { detail: LmsCourseDetail }) {
  const { detail: currentDetail, expandedModuleId, setExpandedModuleId } = useCourseDetail(detail);
  const [search, setSearch] = useState("");
  const resumeLesson = getResumeLesson(currentDetail.modules, currentDetail.progress?.last_lesson_id);
  const summary = getRequiredLessonsSummary(currentDetail.modules);
  const evaluationLessons = currentDetail.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.lesson_type === "avaliacao").length;
  const currentModule = currentDetail.modules.find((module) => module.lessons.some((lesson) => lesson.id === resumeLesson?.id)) ?? currentDetail.modules[0] ?? null;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredDetail = useMemo<LmsCourseDetail>(() => {
    if (!normalizedSearch) return currentDetail;
    return {
      ...currentDetail,
      modules: currentDetail.modules
        .map((module) => ({
          ...module,
          lessons: module.lessons.filter((lesson) => {
            const haystack = [lesson.title, lesson.description ?? "", lesson.content_text ?? ""].join(" ").toLowerCase();
            return haystack.includes(normalizedSearch) || module.title.toLowerCase().includes(normalizedSearch);
          }),
        }))
        .filter((module) => module.lessons.length > 0 || module.title.toLowerCase().includes(normalizedSearch)),
    };
  }, [currentDetail, normalizedSearch]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.38fr_0.62fr]">
        <div className="space-y-6">
          <CourseHeader detail={currentDetail} />
          <section className="rounded-3xl border border-slate-800 bg-[#171717] p-5 text-white shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Seu proximo passo</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {resumeLesson ? `Continue por ${resumeLesson.title}` : "Curso pronto para iniciar"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                  {currentDetail.course.sequence_required
                    ? "A experiencia foi organizada em sequencia para manter a jornada simples e objetiva."
                    : "Escolha a proxima aula e avance no seu ritmo, sem perder o fio da trilha."}
                </p>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Sparkles size={18} />
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {resumeLesson ? (
                <Link
                  href={`/lms/aprender/${currentDetail.course.id}/${resumeLesson.id}`}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  {currentDetail.progress?.progress_percent ? "Continuar treinamento" : "Iniciar treinamento"}
                </Link>
              ) : null}
              {currentDetail.certificate ? <CertificateButton courseId={currentDetail.course.id} /> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75">
                {summary.requiredLessons} aulas obrigatorias
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75">
                {summary.totalMinutes} min
              </span>
              {evaluationLessons ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75">
                  {evaluationLessons} avaliacao(oes)
                </span>
              ) : null}
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-3xl border border-slate-800 bg-[#171717] p-5 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Agora</div>
            <div className="mt-2 text-lg font-semibold text-white">{resumeLesson?.title ?? currentDetail.course.title}</div>
            <div className="mt-3 space-y-1 text-sm text-white/65">
              <div>Progresso total: {Math.round(currentDetail.progress?.progress_percent ?? 0)}%</div>
              <div>Fase atual: {currentModule?.title ?? "Primeira etapa da trilha"}</div>
              <div>
                {summary.requiredLessons} aulas obrigatorias • {summary.totalMinutes} min
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-[#171717] p-4 text-white shadow-sm">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Buscar no curso</label>
            <div className="relative mt-3">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar aula, modulo ou assunto"
                className="h-11 w-full rounded-2xl border border-slate-700 bg-transparent pl-11 pr-4 text-sm text-white placeholder:text-white/35"
              />
            </div>
          </section>

          <ModuleAccordion
            detail={filteredDetail}
            expandedModuleId={expandedModuleId}
            onToggle={setExpandedModuleId}
            currentLessonId={resumeLesson?.id ?? null}
            lessonHrefBuilder={(lessonId) => `/lms/aprender/${currentDetail.course.id}/${lessonId}`}
          />
        </div>
      </div>
    </div>
  );
}
