import { NextResponse } from "next/server";
import { getLmsReportCsv } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function GET(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const department = searchParams.get("department") ?? "all";
  const course = searchParams.get("course") ?? "all";
  const role = searchParams.get("role") ?? "all";

  const csv = await getLmsReportCsv(access.companyId, {
    status,
    departmentId: department,
    courseId: course,
    role,
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lms-relatorio.csv"',
    },
  });
}
