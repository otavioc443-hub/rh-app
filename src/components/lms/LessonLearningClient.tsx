"use client";

import { useRouter } from "next/navigation";
import { LessonPlayer } from "@/components/lms/LessonPlayer";
import { ModuleAccordion } from "@/components/lms/ModuleAccordion";
import { QuizForm } from "@/components/lms/QuizForm";
import { useUserProgress } from "@/hooks/lms/useUserProgress";
import { isLessonLocked } from "@/lib/lms/utils";
import type { LmsQuizPayload } from "@/lib/lms/types";

export function LessonLearningClient({
  courseId,
  detail,
  currentLesson,
  completedLessonIds,
  nextLesson,
  quizPayload,
}: {
  courseId: string;
  detail: Parameters<typeof ModuleAccordion>[0]["detail"];
  currentLesson: Parameters<typeof LessonPlayer>[0]["lesson"];
  completedLessonIds: Set<string>;
  nextLesson: { id: string } | null;
  quizPayload: LmsQuizPayload | null;
}) {
  const router = useRouter();
  const { progressPercent, loading, completeLesson } = useUserProgress(detail.progress?.progress_percent ?? 0);

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
      </div>
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Progresso do curso: <span className="font-semibold text-slate-900">{Math.round(progressPercent)}%</span>
        </div>
        <ModuleAccordion
          detail={detail}
          expandedModuleId={detail.modules.find((module) => module.lessons.some((lesson) => lesson.id === currentLesson.id))?.id ?? detail.modules[0]?.id ?? null}
          onToggle={() => undefined}
          completedLessonIds={completedLessonIds}
          isLessonLocked={(lessonId) => isLessonLocked(detail.course.sequence_required, detail.modules, lessonId, completedLessonIds)}
        />
      </div>
    </div>
  );
}
