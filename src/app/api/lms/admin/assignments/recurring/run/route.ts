import { NextResponse } from "next/server";
import { runRecurringAssignments } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

async function runManual() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const result = await runRecurringAssignments(access);
  return NextResponse.json(result);
}

export async function POST() {
  return runManual();
}

export async function GET(request: Request) {
  const token = request.headers.get("x-cron-token") || new URL(request.url).searchParams.get("token");
  const expected = process.env.LMS_RECURRING_ASSIGNMENTS_CRON_TOKEN?.trim();

  if (expected && token === expected) {
    const result = await runRecurringAssignments({
      ok: true,
      userId: "system",
      email: null,
      role: "admin",
      active: true,
      companyId: null,
      departmentId: null,
    });
    return NextResponse.json({ ...result, mode: "cron" });
  }

  return runManual();
}
