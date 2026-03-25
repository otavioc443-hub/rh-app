import { redirect } from "next/navigation";
import { EthicsContentEditor } from "@/components/admin/ethics/EthicsContentEditor";
import { getEthicsChannelCompanies, getEthicsManagedContentForCompanyId } from "@/lib/ethicsChannelServer";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function AdminEthicsContentPage() {
  const access = await requireRoles(["admin"]);
  if (!access.ok) redirect("/unauthorized");

  const ethicsCompanies = await getEthicsChannelCompanies();
  const editableCompanies = ethicsCompanies.map((company) => ({ id: company.id, name: company.name }));
  const initialEditorCompanyId = access.companyId ?? editableCompanies[0]?.id ?? null;
  const initialEditorData = initialEditorCompanyId ? await getEthicsManagedContentForCompanyId(initialEditorCompanyId) : null;

  return (
    <EthicsContentEditor
      companies={editableCompanies}
      initialCompanyId={initialEditorCompanyId}
      initialContent={initialEditorData?.content ?? null}
      canEdit
    />
  );
}
