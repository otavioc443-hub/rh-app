import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { restoreLmsCourseVersion } from "@/lib/lms/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const { id } = await params;
  const body = (await request.json()) as { versionId?: string };
  const versionId = body.versionId?.trim();
  if (!versionId) return NextResponse.json({ error: "Versao nao informada." }, { status: 400 });

  const saved = await restoreLmsCourseVersion(access, id, versionId);
  return NextResponse.json({ id: saved.id });
}
