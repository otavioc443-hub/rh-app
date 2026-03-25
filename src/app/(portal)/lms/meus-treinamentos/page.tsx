import { redirect } from "next/navigation";
import { MyTrainingsClient } from "@/components/lms/MyTrainingsClient";
import { getMyTrainingsData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function MyTrainingsPage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const trainings = await getMyTrainingsData(access);
  return <MyTrainingsClient trainings={trainings} />;
}
