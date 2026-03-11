import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type FeedbackRow = {
  id: string;
  target_user_id: string | null;
  evaluator_user_id: string | null;
  comment: string | null;
  final_score: number | null;
  final_classification: string | null;
  created_at: string;
  cycle_id: string | null;
  released_to_collaborator: boolean | null;
  one_on_one_completed_at: string | null;
};

type FeedbackReceiptRow = {
  feedback_id: string;
  collaborator_user_id: string;
  collaborator_comment: string | null;
  acknowledged_at: string;
};

type CycleRow = {
  id: string;
  name: string;
};

function normalizeDisplayName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name) return null;
  if (name.includes("@")) return null;
  return name;
}

export async function GET() {
  const guard = await requireRoles(["colaborador", "coordenador", "gestor", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Colaborador visualiza apenas feedback recebido.
  // RH/Admin podem usar esta mesma rota para próprio histórico pessoal se necessário.
  const targetId = guard.userId;

  const { data: rows, error } = await supabaseAdmin
    .from("feedbacks")
    .select(
      "id,target_user_id,evaluator_user_id,comment,final_score,final_classification,created_at,cycle_id,released_to_collaborator,one_on_one_completed_at"
    )
    .eq("target_user_id", targetId)
    .eq("status", "sent")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const feedbacks = (rows ?? []) as FeedbackRow[];
  const cycleIds = Array.from(new Set(feedbacks.map((f) => f.cycle_id).filter(Boolean))) as string[];

  const cycleById = new Map<string, CycleRow>();
  if (cycleIds.length > 0) {
    const { data: cycles } = await supabaseAdmin
      .from("feedback_cycles")
      .select("id,name")
      .in("id", cycleIds);
    for (const c of (cycles ?? []) as CycleRow[]) cycleById.set(c.id, c);
  }

  const evaluatorIds = Array.from(new Set(feedbacks.map((f) => f.evaluator_user_id).filter(Boolean))) as string[];
  const evaluatorById = new Map<string, { full_name: string | null }>();
  if (evaluatorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name")
      .in("id", evaluatorIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
      evaluatorById.set(p.id, { full_name: normalizeDisplayName(p.full_name) });
    }

    const { data: collabs } = await supabaseAdmin
      .from("colaboradores")
      .select("user_id,nome")
      .in("user_id", evaluatorIds);
    for (const c of (collabs ?? []) as Array<{ user_id: string | null; nome: string | null }>) {
      if (!c.user_id) continue;
      const current = evaluatorById.get(c.user_id) ?? { full_name: null };
      evaluatorById.set(c.user_id, {
        full_name: current.full_name ?? normalizeDisplayName(c.nome) ?? null,
      });
    }
  }

  const visible = feedbacks.filter((f) => f.released_to_collaborator === true && !!f.one_on_one_completed_at);
  const visibleIds = visible.map((f) => f.id);
  const receiptByFeedbackId = new Map<string, FeedbackReceiptRow>();

  if (visibleIds.length > 0) {
    const { data: receipts, error: receiptErr } = await supabaseAdmin
      .from("feedback_receipts")
      .select("feedback_id,collaborator_user_id,collaborator_comment,acknowledged_at")
      .in("feedback_id", visibleIds)
      .eq("collaborator_user_id", guard.userId);
    if (receiptErr) return NextResponse.json({ error: receiptErr.message }, { status: 400 });
    for (const item of (receipts ?? []) as FeedbackReceiptRow[]) {
      receiptByFeedbackId.set(item.feedback_id, item);
    }
  }

  const result = visible.map((f) => {
    const cycle = f.cycle_id ? cycleById.get(f.cycle_id) : null;
    const evaluator = f.evaluator_user_id ? evaluatorById.get(f.evaluator_user_id) : null;
    const receipt = receiptByFeedbackId.get(f.id) ?? null;
    return {
      id: f.id,
      created_at: f.created_at,
      comment: f.comment,
      final_score: f.final_score,
      final_classification: f.final_classification,
      cycle_name: cycle?.name ?? null,
      evaluator_name: evaluator?.full_name ?? null,
      acknowledged_at: receipt?.acknowledged_at ?? null,
      collaborator_comment: receipt?.collaborator_comment ?? null,
    };
  });

  return NextResponse.json({ ok: true, rows: result });
}
