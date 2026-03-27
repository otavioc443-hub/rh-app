import { redirect } from "next/navigation";
import { LmsQuizReviewsAdminClient } from "@/components/lms/LmsQuizReviewsAdminClient";
import { getLmsQuizReviewsAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsEvaluationsPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const rows = await getLmsQuizReviewsAdminData(access.companyId);
  return <LmsQuizReviewsAdminClient rows={rows} />;
}
