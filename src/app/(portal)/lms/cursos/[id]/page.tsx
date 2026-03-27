import { notFound, redirect } from "next/navigation";
import { CourseDetailClient } from "@/components/lms/CourseDetailClient";
import { getCourseDetailForLearner } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const { id } = await params;
  const detail = await getCourseDetailForLearner(access, id);
  if (!detail) notFound();

  return <CourseDetailClient detail={detail} />;
}
