import { NextResponse } from "next/server";
import { upsertCourseWithStructure } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import type { LmsCourseEditorPayload } from "@/lib/lms/types";

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as LmsCourseEditorPayload;
  const saved = await upsertCourseWithStructure(access, null, body);
  return NextResponse.json({ id: saved.id });
}
