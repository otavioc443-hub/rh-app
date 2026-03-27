import { notFound, redirect } from "next/navigation";
import { LessonLearningClient } from "@/components/lms/LessonLearningClient";
import { getLessonDiscussions, getLessonPlayerData, getQuizPayloadByLessonId } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsLessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const { courseId, lessonId } = await params;
  const data = await getLessonPlayerData(access, courseId, lessonId);
  if (!data) notFound();

  const [quizPayload, discussions] = await Promise.all([
    data.currentLesson.lesson_type === "avaliacao" ? getQuizPayloadByLessonId(data.currentLesson.id) : Promise.resolve(null),
    getLessonDiscussions(access, courseId, lessonId),
  ]);

  return (
    <LessonLearningClient
      courseId={courseId}
      detail={data}
      currentLesson={data.currentLesson}
      completedLessonIds={data.completedLessonIds}
      nextLesson={data.nextLesson}
      quizPayload={quizPayload}
      discussions={discussions}
    />
  );
}
