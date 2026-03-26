import { redirect } from "next/navigation";
import { ChallengesRail } from "@/components/lms/ChallengesRail";
import { SeasonCampaignPanel } from "@/components/lms/SeasonCampaignPanel";
import { PageHeader } from "@/components/ui/PageShell";
import { getLearnerGamificationOverview } from "@/lib/lms/gamification";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsChallengesPage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const gamification = await getLearnerGamificationOverview(access);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">GM</span>}
        title="Desafios"
        subtitle="Missoes diarias, semanais e sazonais para transformar o aprendizado em ritmo e competicao saudavel."
      />
      <SeasonCampaignPanel campaign={gamification.seasonCampaign} />
      <ChallengesRail
        items={gamification.activeChallenges}
        title="Desafios do momento"
        subtitle="Acompanhe progresso, recompensa e prazo de cada missao ativa."
      />
    </div>
  );
}
