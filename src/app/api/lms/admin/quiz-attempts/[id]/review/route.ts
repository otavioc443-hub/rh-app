import { NextResponse } from "next/server";
import { reviewQuizAttempt, getLmsQuizReviewsAdminData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const { id } = await params;
  const body = (await request.json()) as { score: number; reviewerComment?: string };
  await reviewQuizAttempt(access, id, {
    score: body.score,
    reviewerComment: body.reviewerComment ?? "",
  });

  const rows = await getLmsQuizReviewsAdminData(access.companyId);
  const item = rows.find((row) => row.attempt.id === id) ?? null;
  return NextResponse.json({ item });
}
