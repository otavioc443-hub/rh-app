import { redirect } from "next/navigation";
import { LmsGovernanceClient } from "@/components/lms/LmsGovernanceClient";
import { getLmsGovernanceData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsGovernancePage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const data = await getLmsGovernanceData(access.companyId);
  return <LmsGovernanceClient data={data} />;
}
