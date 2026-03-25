import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { upsertLearningPath } from "@/lib/lms/server";

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as {
    id?: string;
    title: string;
    description: string;
    status: string;
    onboarding_required: boolean;
    courseIds: string[];
  };
  const saved = await upsertLearningPath(access, body);
  return NextResponse.json({ id: saved.id });
}
