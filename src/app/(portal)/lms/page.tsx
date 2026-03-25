import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageShell";
import { CourseCard } from "@/components/lms/CourseCard";
import { EmptyState } from "@/components/lms/EmptyState";
import { LMSStatsCards } from "@/components/lms/LMSStatsCards";
import { getLmsLandingData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function LmsHomePage() {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const data = await getLmsLandingData(access);

  return (
    <div className="space-y-6">
      <PageHeader icon={<GraduationCap size={24} />} title="Treinamentos" subtitle="Aprendizado corporativo com trilhas, cursos, conteudos e certificacao dentro do portal RH." />
      <LMSStatsCards
        cards={[
          { label: "Cursos atribuídos", value: data.dashboard.total },
          { label: "Concluídos", value: data.dashboard.completed },
          { label: "Em andamento", value: data.dashboard.inProgress },
          { label: "Vencidos", value: data.dashboard.overdue },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.recommended.length ? data.recommended.map((item) => <CourseCard key={item.course.id} item={item} />) : <div className="xl:col-span-3"><EmptyState title="Sem recomendacoes no momento" description="Quando o RH publicar novos cursos ou trilhas, eles aparecerao aqui." /></div>}
      </div>
    </div>
  );
}
