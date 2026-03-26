import { NextResponse } from "next/server";
import { sendLmsReminder } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function POST(request: Request) {
  const access = await requireRoles(["gestor", "rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as {
    userId: string;
    courseId: string;
    courseTitle?: string | null;
    dueDate?: string | null;
  };

  await sendLmsReminder(access, {
    userId: body.userId,
    courseId: body.courseId,
    courseTitle: body.courseTitle ?? null,
    dueDate: body.dueDate ?? null,
    source: access.role === "gestor" ? "gestor" : "rh",
  });

  return NextResponse.json({ success: true });
}
