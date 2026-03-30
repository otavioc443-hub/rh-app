import { redirect } from "next/navigation";
import { LmsLearnerJourneyClient } from "@/components/lms/LmsLearnerJourneyClient";
import { getLmsLearnerJourneyData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsLearnerJourneyPage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const data = await getLmsLearnerJourneyData(access);
  return <LmsLearnerJourneyClient trainings={data.trainings} certificates={data.certificates} gamification={data.gamification} />;
}
