import { NextResponse } from "next/server";
import { duplicateLearningPath } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const { id } = await params;
  const saved = await duplicateLearningPath(access, id);
  return NextResponse.json({ id: saved.id });
}
