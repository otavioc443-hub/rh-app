import { redirect } from "next/navigation";
import { BattleArenaList } from "@/components/lms/BattleArenaList";
import { PageHeader } from "@/components/ui/PageShell";
import { getLearnerGamificationOverview } from "@/lib/lms/gamification";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsBattlesPage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const gamification = await getLearnerGamificationOverview(access);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">VS</span>}
        title="Batalhas de conhecimento"
        subtitle="Sessões rápidas e competitivas para revisar conteúdo, medir velocidade e acelerar a retenção."
      />
      <BattleArenaList sessions={gamification.battles} />
    </div>
  );
}
