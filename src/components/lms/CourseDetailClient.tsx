"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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
      <CourseHeader detail={currentDetail} />
      <section className="rounded-3xl border border-slate-800 bg-[#171717] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Seu proximo passo</div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {resumeLesson ? `Continue por ${resumeLesson.title}` : "Curso pronto para iniciar"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {currentDetail.course.sequence_required ? "Siga a ordem da trilha para concluir mais rapido." : "Escolha a proxima aula e avance no seu ritmo."}
            </p>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Sparkles size={18} />
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {resumeLesson ? (
            <Link href={`/lms/aprender/${currentDetail.course.id}/${resumeLesson.id}`} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">
              {currentDetail.progress?.progress_percent ? "Continuar treinamento" : "Iniciar treinamento"}
            </Link>
          ) : null}
          {currentDetail.certificate ? <CertificateButton courseId={currentDetail.course.id} /> : null}
          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/75">
            {summary.requiredLessons} aulas obrigatorias
          </span>
          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/75">
            {summary.totalMinutes} min
          </span>
          {evaluationLessons ? (
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/75">
              {evaluationLessons} avaliacao(oes)
            </span>
          ) : null}
        </div>
      </section>
      <section className="rounded-3xl border border-slate-800 bg-[#171717] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Buscar no curso</div>
            <div className="mt-1 text-sm text-white/65">Encontre rapidamente aulas, temas e materiais dentro desta trilha.</div>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar aula, modulo ou assunto"
            className="h-11 w-full max-w-md rounded-2xl border border-slate-700 bg-transparent px-4 text-sm text-white placeholder:text-white/35"
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
  );
}
