import { redirect } from "next/navigation";
import { LmsLessonDiscussionsAdminClient } from "@/components/lms/LmsLessonDiscussionsAdminClient";
import { getLmsLessonDiscussionsAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsInteractionsPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const rows = await getLmsLessonDiscussionsAdminData(access.companyId);
  return <LmsLessonDiscussionsAdminClient rows={rows} />;
}
