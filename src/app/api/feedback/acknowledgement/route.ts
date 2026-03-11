import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type FeedbackOwnerRow = {
  id: string;
  target_user_id: string | null;
  status: string | null;
  released_to_collaborator: boolean | null;
};

type ReceiptRow = {
  id: string;
  feedback_id: string;
  collaborator_user_id: string;
  collaborator_comment: string | null;
  acknowledged_at: string;
  created_at: string;
};

export async function POST(req: Request) {
  const guard = await requireRoles(["colaborador", "coordenador", "gestor", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as { feedback_id?: string; collaborator_comment?: string };
    const feedbackId = String(body.feedback_id ?? "").trim();
    const collaboratorCommentRaw = String(body.collaborator_comment ?? "").trim();
    const collaboratorComment = collaboratorCommentRaw ? collaboratorCommentRaw.slice(0, 1000) : null;

    if (!feedbackId) {
      return NextResponse.json({ error: "feedback_id obrigatorio." }, { status: 400 });
    }

    const { data: feedback, error: feedbackErr } = await supabaseAdmin
      .from("feedbacks")
      .select("id,target_user_id,status,released_to_collaborator")
      .eq("id", feedbackId)
      .maybeSingle<FeedbackOwnerRow>();

    if (feedbackErr) return NextResponse.json({ error: feedbackErr.message }, { status: 400 });
    if (!feedback || feedback.target_user_id !== guard.userId) {
      return NextResponse.json({ error: "Feedback nao encontrado para este colaborador." }, { status: 404 });
    }
    if (feedback.status !== "sent" || feedback.released_to_collaborator !== true) {
      return NextResponse.json({ error: "Feedback ainda nao liberado para confirmacao." }, { status: 400 });
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("feedback_receipts")
      .select("id,feedback_id,collaborator_user_id,collaborator_comment,acknowledged_at,created_at")
      .eq("feedback_id", feedbackId)
      .eq("collaborator_user_id", guard.userId)
      .maybeSingle<ReceiptRow>();

    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 400 });
    if (existing) {
      return NextResponse.json({ ok: true, already_acknowledged: true, receipt: existing });
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("feedback_receipts")
      .insert({
        feedback_id: feedbackId,
        collaborator_user_id: guard.userId,
        collaborator_comment: collaboratorComment,
      })
      .select("id,feedback_id,collaborator_user_id,collaborator_comment,acknowledged_at,created_at")
      .single<ReceiptRow>();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, already_acknowledged: false, receipt: inserted });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
