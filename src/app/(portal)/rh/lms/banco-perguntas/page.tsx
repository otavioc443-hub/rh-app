import { redirect } from "next/navigation";
import { LmsQuestionBankAdminClient } from "@/components/lms/LmsQuestionBankAdminClient";
import { PageHeader } from "@/components/ui/PageShell";
import { getLmsQuestionBankData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsQuestionBankPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const items = await getLmsQuestionBankData(access.companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">LMS</span>}
        title="Banco de perguntas"
        subtitle="Reaproveite perguntas aprovadas pelo RH para acelerar a criacao de avaliacoes."
      />
      <LmsQuestionBankAdminClient items={items} />
    </div>
  );
}
