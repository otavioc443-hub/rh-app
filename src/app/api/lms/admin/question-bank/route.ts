import { NextResponse } from "next/server";
import { createQuestionBankItem, getLmsQuestionBankData } from "@/lib/lms/server";
import { requireRoles } from "@/lib/server/feedbackGuard";

export async function GET() {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const items = await getLmsQuestionBankData(access.companyId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });

  const body = (await request.json()) as {
    title: string;
    statement: string;
    help_text?: string | null;
    question_type: string;
    image_url?: string | null;
    accepted_answers?: string[];
    requires_manual_review?: boolean;
    options: Array<{ text: string; is_correct: boolean; image_url?: string | null }>;
  };
  const item = await createQuestionBankItem(access, body);
  return NextResponse.json({ item });
}
