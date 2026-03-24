import { redirect } from "next/navigation";
import { EthicsCasesAdminClient } from "@/components/admin/ethics/EthicsCasesAdminClient";
import { getEthicsDashboardData } from "@/lib/ethicsCases/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export default async function AdminEthicsCasesPage() {
  const access = await requireRoles(["admin", "rh", "compliance"]);
  if (!access.ok) redirect("/unauthorized");

  const initialData = await getEthicsDashboardData();

  return <EthicsCasesAdminClient initialData={initialData} canManage={access.role === "admin" || access.role === "rh" || access.role === "compliance"} />;
}
