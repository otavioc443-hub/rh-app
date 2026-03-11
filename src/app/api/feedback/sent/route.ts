import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type FeedbackRow = {
  id: string;
  created_at: string;
  target_user_id: string | null;
  evaluator_user_id: string | null;
  source_role: string | null;
  comment: string | null;
  details_json: Record<string, unknown> | null;
  final_score: number | null;
  final_classification: string | null;
  status: string | null;
  cycle_id: string | null;
  released_to_collaborator: boolean | null;
  one_on_one_completed_at: string | null;
  one_on_one_completed_by: string | null;
  one_on_one_notes: string | null;
};

type CycleRow = {
  id: string;
  name: string;
};

type FeedbackReceiptRow = {
  feedback_id: string;
  collaborator_comment: string | null;
  acknowledged_at: string;
};

function normalizeDisplayName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name) return null;
  if (name.includes("@")) return null;
  return name;
}

export async function GET() {
  const guard = await requireRoles(["gestor", "coordenador", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabaseAdmin
    .from("feedbacks")
    .select(
      "id,created_at,target_user_id,evaluator_user_id,source_role,comment,details_json,final_score,final_classification,status,cycle_id,released_to_collaborator,one_on_one_completed_at,one_on_one_completed_by,one_on_one_notes"
    )
    .eq("evaluator_user_id", guard.userId)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as FeedbackRow[];
  const targetIds = Array.from(new Set(rows.map((r) => r.target_user_id).filter(Boolean))) as string[];
  const evaluatorIds = Array.from(new Set(rows.map((r) => r.evaluator_user_id).filter(Boolean))) as string[];
  const cycleIds = Array.from(new Set(rows.map((r) => r.cycle_id).filter(Boolean))) as string[];

  const targetById = new Map<string, { full_name: string | null; email: string | null }>();
  if (targetIds.length > 0) {
    const { data: targets } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", targetIds);
    for (const t of (targets ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      targetById.set(t.id, { full_name: normalizeDisplayName(t.full_name), email: t.email });
    }

    const { data: collabs } = await supabaseAdmin
      .from("colaboradores")
      .select("user_id,nome,email")
      .in("user_id", targetIds);
    for (const c of (collabs ?? []) as Array<{ user_id: string | null; nome: string | null; email: string | null }>) {
      if (!c.user_id) continue;
      const current = targetById.get(c.user_id) ?? { full_name: null, email: null };
      targetById.set(c.user_id, {
        full_name: current.full_name ?? normalizeDisplayName(c.nome) ?? null,
        email: current.email ?? c.email ?? null,
      });
    }
  }

  const evaluatorById = new Map<string, { full_name: string | null; email: string | null }>();
  if (evaluatorIds.length > 0) {
    const { data: evaluators } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", evaluatorIds);
    for (const e of (evaluators ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      evaluatorById.set(e.id, { full_name: normalizeDisplayName(e.full_name), email: e.email });
    }

    const { data: collabs } = await supabaseAdmin
      .from("colaboradores")
      .select("user_id,nome,email")
      .in("user_id", evaluatorIds);
    for (const c of (collabs ?? []) as Array<{ user_id: string | null; nome: string | null; email: string | null }>) {
      if (!c.user_id) continue;
      const current = evaluatorById.get(c.user_id) ?? { full_name: null, email: null };
      evaluatorById.set(c.user_id, {
        full_name: current.full_name ?? normalizeDisplayName(c.nome) ?? null,
        email: current.email ?? c.email ?? null,
      });
    }
  }

  const cycleById = new Map<string, CycleRow>();
  if (cycleIds.length > 0) {
    const { data: cycles } = await supabaseAdmin.from("feedback_cycles").select("id,name").in("id", cycleIds);
    for (const c of (cycles ?? []) as CycleRow[]) cycleById.set(c.id, c);
  }

  const receiptByFeedbackId = new Map<string, FeedbackReceiptRow>();
  const feedbackIds = rows.map((r) => r.id);
  if (feedbackIds.length > 0) {
    const { data: receipts, error: receiptErr } = await supabaseAdmin
      .from("feedback_receipts")
      .select("feedback_id,collaborator_comment,acknowledged_at")
      .in("feedback_id", feedbackIds);
    if (receiptErr) return NextResponse.json({ error: receiptErr.message }, { status: 400 });
    for (const row of (receipts ?? []) as FeedbackReceiptRow[]) {
      receiptByFeedbackId.set(row.feedback_id, row);
    }
  }

  const result = rows.map((r) => ({
    ...r,
    target_name: r.target_user_id ? targetById.get(r.target_user_id)?.full_name ?? null : null,
    target_email: r.target_user_id ? targetById.get(r.target_user_id)?.email ?? null : null,
    evaluator_name: r.evaluator_user_id ? evaluatorById.get(r.evaluator_user_id)?.full_name ?? null : null,
    evaluator_email: r.evaluator_user_id ? evaluatorById.get(r.evaluator_user_id)?.email ?? null : null,
    cycle_name: r.cycle_id ? cycleById.get(r.cycle_id)?.name ?? null : null,
    acknowledged_at: receiptByFeedbackId.get(r.id)?.acknowledged_at ?? null,
    collaborator_comment: receiptByFeedbackId.get(r.id)?.collaborator_comment ?? null,
  }));

  return NextResponse.json({ ok: true, rows: result });
}

export async function PATCH(req: Request) {
  const guard = await requireRoles(["gestor", "coordenador", "rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as {
      feedback_id?: string;
      one_on_one_completed?: boolean;
      one_on_one_notes?: string;
    };
    const feedbackId = String(body.feedback_id ?? "").trim();
    const complete = body.one_on_one_completed === true;
    const oneOnOneNotesRaw = String(body.one_on_one_notes ?? "").trim();
    const oneOnOneNotes = oneOnOneNotesRaw ? oneOnOneNotesRaw.slice(0, 2000) : null;

    if (!feedbackId) return NextResponse.json({ error: "feedback_id obrigatorio." }, { status: 400 });
    if (!complete) return NextResponse.json({ error: "one_on_one_completed invalido." }, { status: 400 });

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("feedbacks")
      .select("id,evaluator_user_id,status,one_on_one_completed_at,one_on_one_completed_by")
      .eq("id", feedbackId)
      .maybeSingle<{
        id: string;
        evaluator_user_id: string | null;
        status: string | null;
        one_on_one_completed_at: string | null;
        one_on_one_completed_by: string | null;
      }>();
    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 400 });
    if (!row) return NextResponse.json({ error: "Feedback nao encontrado." }, { status: 404 });
    if (row.evaluator_user_id !== guard.userId) {
      return NextResponse.json({ error: "Somente o avaliador pode confirmar one-on-one." }, { status: 403 });
    }
    if (row.status !== "sent") {
      return NextResponse.json({ error: "Somente feedback enviado pode ser confirmado." }, { status: 400 });
    }

    const completedAt = row.one_on_one_completed_at ?? new Date().toISOString();
    const completedBy = row.one_on_one_completed_by ?? guard.userId;
    const { error: updateErr } = await supabaseAdmin
      .from("feedbacks")
      .update({
        one_on_one_completed_at: completedAt,
        one_on_one_completed_by: completedBy,
        one_on_one_notes: oneOnOneNotes,
      })
      .eq("id", feedbackId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      one_on_one_completed_at: completedAt,
      one_on_one_notes: oneOnOneNotes,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
