import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { submitQuizAttempt } from "@/lib/lms/server";

export async function POST(request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const { quizId } = await params;
  const body = (await request.json()) as { answers?: Record<string, string[]> };
  const result = await submitQuizAttempt(access, quizId, body.answers ?? {});
  return NextResponse.json({ score: result.score, passed: result.passed });
}
