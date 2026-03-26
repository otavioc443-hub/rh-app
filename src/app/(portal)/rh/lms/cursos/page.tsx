import Link from "next/link";
import { redirect } from "next/navigation";
import { LmsActionButton } from "@/components/lms/LmsActionButton";
import { CourseStatusBadge } from "@/components/lms/CourseStatusBadge";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import { getLmsCoursesAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function RhLmsCoursesPage() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) redirect("/unauthorized");

  const rows = await getLmsCoursesAdminData(access.companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<span className="text-xl font-bold">LMS</span>}
        title="Gestao de cursos"
        subtitle="Cadastre, publique, reutilize modelos e arquive treinamentos corporativos."
      />
      <div className="flex justify-end">
        <Link href="/rh/lms/cursos/novo" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Novo curso
        </Link>
      </div>
      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Curso</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Aulas</th>
                <th className="px-6 py-3">Atribuicoes</th>
                <th className="px-6 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{row.title}</div>
                    <div className="text-xs text-slate-500">{row.short_description ?? row.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{row.category ?? "-"}</td>
                  <td className="px-6 py-4">
                    <CourseStatusBadge status={row.status} variant="course" />
                  </td>
                  <td className="px-6 py-4 text-slate-600">{row.lesson_count}</td>
                  <td className="px-6 py-4 text-slate-600">{row.assignment_count}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/rh/lms/cursos/${row.id}/editar`}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800"
                      >
                        Editar
                      </Link>
                      <LmsActionButton
                        endpoint={`/api/lms/admin/courses/${row.id}/duplicate`}
                        label="Usar como modelo"
                        pendingLabel="Criando copia..."
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60"
                      />
                    </div>
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
