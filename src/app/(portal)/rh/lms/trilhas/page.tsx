import { redirect } from "next/navigation";
import { LmsActionButton } from "@/components/lms/LmsActionButton";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { getLmsLearningPathsAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsPathsPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");
  const rows = await getLmsLearningPathsAdminData(access.companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">LMS</span>}
        title="Trilhas de aprendizagem"
        subtitle="Agrupe cursos por jornada, onboarding ou especialidade."
      />
      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Trilha</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Cursos</th>
                <th className="px-6 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{row.title}</div>
                    <div className="text-xs text-slate-500">{row.description ?? "-"}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{row.status}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {row.courses?.map((course: { course_title: string }) => course.course_title).join(", ") || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <LmsActionButton
                      endpoint={`/api/lms/admin/learning-paths/${row.id}/duplicate`}
                      label="Usar como modelo"
                      pendingLabel="Criando copia..."
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
