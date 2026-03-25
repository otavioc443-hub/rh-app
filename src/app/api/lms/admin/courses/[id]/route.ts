import { NextResponse } from "next/server";
import { archiveCourse, upsertCourseWithStructure } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import type { LmsCourseEditorPayload } from "@/lib/lms/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const { id } = await params;
  const body = (await request.json()) as LmsCourseEditorPayload;
  const saved = await upsertCourseWithStructure(access, id, body);
  return NextResponse.json({ id: saved.id });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const { id } = await params;
  await archiveCourse(access, id);
  return NextResponse.json({ success: true });
}
