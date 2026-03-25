import { notFound, redirect } from "next/navigation";
import { CourseDetailClient } from "@/components/lms/CourseDetailClient";
import { getCourseDetailForLearner, getQuizPayload } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const { id } = await params;
  const detail = await getCourseDetailForLearner(access, id);
  if (!detail) notFound();
  const quizPayload = detail.quiz ? await getQuizPayload(detail.quiz.id) : null;

  return <CourseDetailClient detail={detail} quizPayload={quizPayload} />;
}
