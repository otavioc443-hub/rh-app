"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Award, BookMarked, Sparkles, Trophy } from "lucide-react";
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
      <section className="grid gap-4 lg:grid-cols-[1fr,0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seu proximo passo</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {resumeLesson ? `Retome por ${resumeLesson.title}` : "Nenhuma aula disponivel"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Continue da ultima etapa registrada e conclua as aulas obrigatorias para liberar certificado e aprovacao final.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {resumeLesson ? (
              <Link href={`/lms/aprender/${currentDetail.course.id}/${resumeLesson.id}`} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                {currentDetail.progress?.progress_percent ? "Continuar treinamento" : "Iniciar treinamento"}
              </Link>
            ) : null}
            {currentDetail.certificate ? <CertificateButton courseId={currentDetail.course.id} /> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Obrigatorias</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{summary.requiredLessons}</div>
            <div className="mt-1 text-sm text-slate-500">aulas que precisam ser concluidas</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Carga total</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{summary.totalMinutes}</div>
            <div className="mt-1 text-sm text-slate-500">minutos previstos de estudo</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Avaliacao</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{evaluationLessons}</div>
            <div className="mt-1 text-sm text-slate-500">etapa(s) de avaliacao na trilha</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">O que voce vai encontrar</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Visao da jornada do aluno</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use este espaco para entender a promessa do curso, o ritmo esperado e os marcos que liberam conclusao e certificado.
              </p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Sparkles size={18} />
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ritmo esperado</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{currentDetail.course.sequence_required ? "Seguir a ordem das fases" : "Voce pode navegar livremente"}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Certificacao</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{currentDetail.course.certificate_enabled ? "Disponivel ao concluir" : "Nao habilitada neste curso"}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aprovacao</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{currentDetail.course.passing_score ?? 0}% de aproveitamento minimo</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Marcos da sua jornada</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Conquistas e comprovacao</h2>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Trophy size={18} />
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><BookMarked size={16} /> Trilhas obrigatorias</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Voce precisa concluir {summary.requiredLessons} aula(s) obrigatoria(s) para fechar esta jornada.</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><Award size={16} /> Certificado e comprovacao</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {currentDetail.certificate
                  ? "Seu certificado ja esta disponivel para download."
                  : currentDetail.course.certificate_enabled
                    ? "Assim que os criterios forem atingidos, o certificado sera liberado aqui."
                    : "Este curso nao gera certificado, mas continua contando na sua trilha de desenvolvimento."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {resumeLesson ? (
          <Link href={`/lms/aprender/${currentDetail.course.id}/${resumeLesson.id}`} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Abrir player do curso
          </Link>
        ) : null}
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Buscar no curso</div>
            <div className="mt-1 text-sm text-slate-600">Encontre rapidamente aulas, temas e materiais dentro desta trilha.</div>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar aula, modulo ou assunto"
            className="h-11 w-full max-w-md rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
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
