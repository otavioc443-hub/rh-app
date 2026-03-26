import { NextResponse } from "next/server";
import { updateLessonDiscussion } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const { id } = await params;
  const body = (await request.json()) as {
    status?: "pending" | "answered" | "resolved";
    adminResponse?: string | null;
  };

  const item = await updateLessonDiscussion(access, id, {
    status: body.status,
    adminResponse: body.adminResponse ?? null,
  });

  return NextResponse.json({ item });
}
