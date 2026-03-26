"use client";

import { useRouter } from "next/navigation";
import { LessonPlayer } from "@/components/lms/LessonPlayer";
import { LessonDiscussionPanel } from "@/components/lms/LessonDiscussionPanel";
import { ModuleAccordion } from "@/components/lms/ModuleAccordion";
import { QuizForm } from "@/components/lms/QuizForm";
import { useUserProgress } from "@/hooks/lms/useUserProgress";
import { getRequiredLessonsSummary, isLessonLocked } from "@/lib/lms/utils";
import type { LmsLessonDiscussion, LmsQuizPayload } from "@/lib/lms/types";

export function LessonLearningClient({
  courseId,
  detail,
  currentLesson,
  completedLessonIds,
  nextLesson,
  quizPayload,
  discussions,
}: {
  courseId: string;
  detail: Parameters<typeof ModuleAccordion>[0]["detail"];
  currentLesson: Parameters<typeof LessonPlayer>[0]["lesson"];
  completedLessonIds: Set<string>;
  nextLesson: { id: string } | null;
  quizPayload: LmsQuizPayload | null;
  discussions: LmsLessonDiscussion[];
}) {
  const router = useRouter();
  const { progressPercent, loading, completeLesson } = useUserProgress(detail.progress?.progress_percent ?? 0);
  const summary = getRequiredLessonsSummary(detail.modules);
  const currentModule = detail.modules.find((module) => module.lessons.some((lesson) => lesson.id === currentLesson.id)) ?? detail.modules[0] ?? null;

  async function handleComplete() {
    await completeLesson(courseId, currentLesson.id, true);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <LessonPlayer
          lesson={currentLesson}
          onComplete={handleComplete}
          completing={loading}
          nextLessonHref={nextLesson ? `/lms/aprender/${courseId}/${nextLesson.id}` : null}
        />
        {quizPayload ? <QuizForm payload={quizPayload} /> : null}
        <LessonDiscussionPanel courseId={courseId} lessonId={currentLesson.id} initialItems={discussions} />
      </div>
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo da jornada</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{Math.round(progressPercent)}% do curso concluido</div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div>Fase atual: {currentModule?.title ?? "Etapa do treinamento"}</div>
            <div>Aulas obrigatorias: {summary.requiredLessons}</div>
            <div>Carga estimada: {summary.totalMinutes} min</div>
          </div>
        </div>
        <ModuleAccordion
          detail={detail}
          expandedModuleId={currentModule?.id ?? null}
          onToggle={() => undefined}
          completedLessonIds={completedLessonIds}
          isLessonLocked={(lessonId) => isLessonLocked(detail.course.sequence_required, detail.modules, lessonId, completedLessonIds)}
          currentLessonId={currentLesson.id}
          lessonHrefBuilder={(lessonId) => `/lms/aprender/${courseId}/${lessonId}`}
        />
      </div>
    </div>
  );
}
