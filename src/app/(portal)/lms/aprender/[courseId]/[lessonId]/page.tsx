import { notFound, redirect } from "next/navigation";
import { LessonLearningClient } from "@/components/lms/LessonLearningClient";
import { getLessonPlayerData, getQuizPayload } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsLessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const { courseId, lessonId } = await params;
  const data = await getLessonPlayerData(access, courseId, lessonId);
  if (!data) notFound();

  const quizPayload = data.currentLesson.lesson_type === "avaliacao" && data.quiz ? await getQuizPayload(data.quiz.id) : null;

  return (
    <LessonLearningClient
      courseId={courseId}
      detail={data}
      currentLesson={data.currentLesson}
      completedLessonIds={data.completedLessonIds}
      nextLesson={data.nextLesson}
      quizPayload={quizPayload}
    />
  );
}
