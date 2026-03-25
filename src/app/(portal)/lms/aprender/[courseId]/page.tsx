import { notFound, redirect } from "next/navigation";
import { getCourseDetailForLearner } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsCourseRedirectPage({ params }: { params: Promise<{ courseId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const { courseId } = await params;
  const detail = await getCourseDetailForLearner(access, courseId);
  const firstLesson = detail?.modules.flatMap((module) => module.lessons)[0];
  if (!detail || !firstLesson) notFound();

  redirect(`/lms/aprender/${courseId}/${firstLesson.id}`);
}
