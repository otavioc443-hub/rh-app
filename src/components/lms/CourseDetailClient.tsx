"use client";

import Link from "next/link";
import { CourseHeader } from "@/components/lms/CourseHeader";
import { ModuleAccordion } from "@/components/lms/ModuleAccordion";
import { QuizForm } from "@/components/lms/QuizForm";
import { CertificateButton } from "@/components/lms/CertificateButton";
import { useCourseDetail } from "@/hooks/lms/useCourseDetail";
import type { LmsCourseDetail, LmsQuizPayload } from "@/lib/lms/types";

export function CourseDetailClient({ detail, quizPayload }: { detail: LmsCourseDetail; quizPayload: LmsQuizPayload | null }) {
  const { detail: currentDetail, expandedModuleId, setExpandedModuleId } = useCourseDetail(detail);
  const firstLesson = currentDetail.modules.flatMap((module) => module.lessons)[0] ?? null;

  return (
    <div className="space-y-6">
      <CourseHeader detail={currentDetail} />
      <div className="flex flex-wrap items-center gap-3">
        {firstLesson ? (
          <Link href={`/lms/aprender/${currentDetail.course.id}/${firstLesson.id}`} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Continuar treinamento
          </Link>
        ) : null}
        {currentDetail.certificate ? <CertificateButton courseId={currentDetail.course.id} /> : null}
      </div>
      <ModuleAccordion detail={currentDetail} expandedModuleId={expandedModuleId} onToggle={setExpandedModuleId} />
      {quizPayload ? <QuizForm payload={quizPayload} /> : null}
    </div>
  );
}
