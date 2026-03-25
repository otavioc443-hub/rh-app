import { redirect } from "next/navigation";
import { LmsReportsClient } from "@/components/lms/LmsReportsClient";
import { getLmsReportsData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsReportsPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");
  const rows = await getLmsReportsData(access.companyId);
  return <LmsReportsClient rows={rows} />;
}
