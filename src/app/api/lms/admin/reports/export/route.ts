import { NextResponse } from "next/server";
import { getLmsReportCsv } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function GET() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const csv = await getLmsReportCsv(access.companyId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lms-relatorio.csv"',
    },
  });
}
