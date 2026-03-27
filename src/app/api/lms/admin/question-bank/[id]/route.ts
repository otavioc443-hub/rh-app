import { NextResponse } from "next/server";
import { deleteQuestionBankItem } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const { id } = await params;
  await deleteQuestionBankItem(access, id);
  return NextResponse.json({ success: true });
}
