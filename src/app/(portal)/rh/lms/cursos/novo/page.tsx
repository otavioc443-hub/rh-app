import { redirect } from "next/navigation";
import { LmsCourseEditor } from "@/components/lms/LmsCourseEditor";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsNewCoursePage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  return <LmsCourseEditor mode="create" courseId={null} />;
}
