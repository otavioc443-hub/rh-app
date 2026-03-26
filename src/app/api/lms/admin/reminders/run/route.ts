import { NextResponse } from "next/server";
import { dispatchLmsDeadlineSweep } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

async function runSweep() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const result = await dispatchLmsDeadlineSweep(access);
  return NextResponse.json(result);
}

export async function POST() {
  return runSweep();
}

export async function GET(request: Request) {
  const token = request.headers.get("x-cron-token") || new URL(request.url).searchParams.get("token");
  const expected = process.env.LMS_REMINDERS_CRON_TOKEN?.trim();

  if (expected && token === expected) {
    const access = {
      ok: true as const,
      userId: "system",
      email: null,
      role: "admin" as const,
      active: true as const,
      companyId: null,
      departmentId: null,
    };
    const result = await dispatchLmsDeadlineSweep(access);
    return NextResponse.json({ ...result, mode: "cron" });
  }

  return runSweep();
}
