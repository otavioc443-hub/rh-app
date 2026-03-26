import { redirect } from "next/navigation";
import { LeaderboardTable } from "@/components/lms/LeaderboardTable";
import { PageHeader } from "@/components/ui/PageShell";
import { getLeaderboardForCompany } from "@/lib/lms/gamification";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsRankingPage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const leaderboard = await getLeaderboardForCompany(access.companyId, null, 20);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">XP</span>}
        title="Ranking de aprendizagem"
        subtitle="Compare evolucao, XP, streak e badges entre colaboradores da temporada."
      />
      <LeaderboardTable rows={leaderboard} title="Ranking geral da empresa" subtitle="A posicao e recalculada a partir de XP, nivel, badges e consistencia." />
    </div>
  );
}
