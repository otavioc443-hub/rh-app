import { redirect } from "next/navigation";
import { AssignmentDialog } from "@/components/lms/AssignmentDialog";
import { OnboardingAssignmentsButton } from "@/components/lms/OnboardingAssignmentsButton";
import { RecurringAssignmentsButton } from "@/components/lms/RecurringAssignmentsButton";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { getLmsAssignmentsAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsAssignmentsPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");
  const { assignments, supportData } = await getLmsAssignmentsAdminData(access.companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">LMS</span>}
        title="Atribuicoes"
        subtitle="Distribua cursos e trilhas por usuario, area, empresa ou perfil."
      />
      <AssignmentDialog supportData={supportData} />
      <div className="flex flex-wrap gap-3">
        <RecurringAssignmentsButton />
        <OnboardingAssignmentsButton />
      </div>
      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Destino</th>
                <th className="px-6 py-3">Curso / Trilha</th>
                <th className="px-6 py-3">Prazo</th>
                <th className="px-6 py-3">Recorrencia</th>
                <th className="px-6 py-3">Obrigatorio</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-6 py-4 text-slate-700">{row.target_label ?? row.target_id}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{row.course_title ?? row.learning_path_title ?? "-"}</td>
                  <td className="px-6 py-4 text-slate-600">{row.due_date ?? "-"}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {row.auto_reassign_on_expiry && row.recurring_every_days ? `A cada ${row.recurring_every_days} dia(s)` : "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{row.mandatory ? "Sim" : "Nao"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
