import { redirect } from "next/navigation";
import { EthicsContentEditor } from "@/components/admin/ethics/EthicsContentEditor";
import { EthicsCasesAdminClient } from "@/components/admin/ethics/EthicsCasesAdminClient";
import { getEthicsDashboardData } from "@/lib/ethicsCases/server";
import { getEthicsChannelCompanies, getEthicsManagedContentForCompanyId } from "@/lib/ethicsChannelServer";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function AdminEthicsCasesPage() {
  const access = await requireRoles(["admin", "rh", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const [initialData, ethicsCompanies] = await Promise.all([
    getEthicsDashboardData(access.companyId),
    getEthicsChannelCompanies(),
  ]);
  const editableCompanies = ethicsCompanies.map((company) => ({ id: company.id, name: company.name }));
  const initialEditorCompanyId = access.companyId ?? editableCompanies[0]?.id ?? null;
  const initialEditorData = initialEditorCompanyId ? await getEthicsManagedContentForCompanyId(initialEditorCompanyId) : null;

  return (
    <div className="space-y-8">
      <EthicsCasesAdminClient initialData={initialData} canManage={access.role === "admin" || access.role === "rh" || access.role === "compliance"} />
      {access.role === "admin" ? (
        <EthicsContentEditor
          companies={editableCompanies}
          initialCompanyId={initialEditorCompanyId}
          initialContent={initialEditorData?.content ?? null}
          canEdit
        />
      ) : null}
    </div>
  );
}
