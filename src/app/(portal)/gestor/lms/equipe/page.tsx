import { redirect } from "next/navigation";
import { TeamTrainingsClient } from "@/components/lms/TeamTrainingsClient";
import { getTeamTrainingsData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function GestorTeamLmsPage() {
  const access = await requireRoles(["gestor", "admin"]);
  if (!access.ok) redirect("/unauthorized");
  const rows = await getTeamTrainingsData(access);
  return <TeamTrainingsClient rows={rows} />;
}
