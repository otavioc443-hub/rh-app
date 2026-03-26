import { redirect } from "next/navigation";
import { BadgeShelf } from "@/components/lms/BadgeShelf";
import { PageHeader } from "@/components/ui/PageShell";
import { getLearnerGamificationOverview } from "@/lib/lms/gamification";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsAchievementsPage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const gamification = await getLearnerGamificationOverview(access);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">BD</span>}
        title="Conquistas"
        subtitle="Sua estante de badges, reconhecimentos e marcos da jornada de treinamento."
      />
      <BadgeShelf items={gamification.badges} title="Badges conquistados" subtitle="Conquistas obtidas por constância, desempenho e domínio de conteúdo." />
    </div>
  );
}
