import { redirect } from "next/navigation";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { getLmsLearningPathsAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsPathsPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");
  const rows = await getLmsLearningPathsAdminData(access.companyId);

  return (
    <div className="space-y-6">
      <PageHeader icon={<span className="text-xl font-bold">LMS</span>} title="Trilhas de aprendizagem" subtitle="Agrupe cursos por jornada, onboarding ou especialidade." />
      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Trilha</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Cursos</th>
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
                  <td className="px-6 py-4 text-slate-600">{row.courses?.map((course: { course_title: string }) => course.course_title).join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
