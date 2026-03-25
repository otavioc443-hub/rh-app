import { notFound, redirect } from "next/navigation";
import { LmsCourseEditor } from "@/components/lms/LmsCourseEditor";
import { getLmsCourseEditorData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsEditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const { id } = await params;
  const data = await getLmsCourseEditorData(id, access.companyId);
  if (!data.detail) notFound();

  return <LmsCourseEditor mode="edit" courseId={id} initialData={data.detail} />;
}
