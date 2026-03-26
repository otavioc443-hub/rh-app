import { NextResponse } from "next/server";
import { dispatchLmsWeeklySummary } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

async function runWeeklySummary() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const result = await dispatchLmsWeeklySummary(access);
  return NextResponse.json({ ...result, mode: "manual" });
}

export async function POST() {
  return runWeeklySummary();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = request.headers.get("x-cron-token") ?? url.searchParams.get("token");
  const expected = process.env.LMS_WEEKLY_SUMMARY_CRON_TOKEN?.trim();

  if (token && expected && token === expected) {
    const result = await dispatchLmsWeeklySummary({
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

  return runWeeklySummary();
}
