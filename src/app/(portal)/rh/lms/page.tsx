import { redirect } from "next/navigation";
import { LmsAdminDashboardClient } from "@/components/lms/LmsAdminDashboardClient";
import { getSafeLmsAdminDashboardData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsDashboardPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const data = await getSafeLmsAdminDashboardData(access.companyId);
  return <LmsAdminDashboardClient data={data} />;
}
