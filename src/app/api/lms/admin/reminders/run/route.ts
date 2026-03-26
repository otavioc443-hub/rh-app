import { NextResponse } from "next/server";
import { dispatchLmsDeadlineSweep } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function POST() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const result = await dispatchLmsDeadlineSweep(access);
  return NextResponse.json(result);
}
