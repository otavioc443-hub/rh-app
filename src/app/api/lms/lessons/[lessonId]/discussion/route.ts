import { NextResponse } from "next/server";
import { createLessonDiscussion, getLessonDiscussions } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const { lessonId } = await params;
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId") ?? "";
  if (!courseId) return NextResponse.json({ error: "courseId e obrigatorio." }, { status: 400 });

  const items = await getLessonDiscussions(access, courseId, lessonId);
  return NextResponse.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const { lessonId } = await params;
  const body = (await request.json()) as { courseId?: string; message?: string };
  if (!body.courseId) return NextResponse.json({ error: "courseId e obrigatorio." }, { status: 400 });

  const item = await createLessonDiscussion(access, body.courseId, lessonId, body.message ?? "");
  return NextResponse.json({ item });
}
