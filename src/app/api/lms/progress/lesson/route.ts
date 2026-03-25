import { NextResponse } from "next/server";
import { markLessonCompleted } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function POST(request: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as { courseId?: string; lessonId?: string; completed?: boolean };
  if (!body.courseId || !body.lessonId) return NextResponse.json({ error: "courseId e lessonId sao obrigatorios." }, { status: 400 });

  const progress = await markLessonCompleted(access, body.courseId, body.lessonId, body.completed !== false);
  return NextResponse.json({ progressPercent: progress?.progress_percent ?? 0, status: progress?.status ?? "not_started" });
}
