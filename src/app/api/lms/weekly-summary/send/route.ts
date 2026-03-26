import { NextResponse } from "next/server";
import { sendMyLmsWeeklySummary } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function POST() {
  const access = await requireRoles(["gestor", "rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const result = await sendMyLmsWeeklySummary(access);
  return NextResponse.json(result);
}
