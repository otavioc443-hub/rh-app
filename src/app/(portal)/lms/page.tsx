import { redirect } from "next/navigation";
import { LmsLearnerHomeClient } from "@/components/lms/LmsLearnerHomeClient";
import { getLmsLandingData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsHomePage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const data = await getLmsLandingData(access);

  return (
    <LmsLearnerHomeClient
      recommended={data.recommended}
      deadlines={data.deadlines}
      keepLearning={data.keepLearning}
      dashboard={data.dashboard}
      gamification={data.gamification}
    />
  );
}
