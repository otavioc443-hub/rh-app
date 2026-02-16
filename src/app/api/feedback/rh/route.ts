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
  final_score: number | null;
  final_classification: string | null;
  status: string | null;
  cycle_id: string | null;
  released_to_collaborator: boolean | null;
};

export async function GET() {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabaseAdmin
    .from("feedbacks")
    .select(
      "id,created_at,target_user_id,evaluator_user_id,source_role,comment,final_score,final_classification,status,cycle_id,released_to_collaborator"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as FeedbackRow[];
  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.target_user_id, r.evaluator_user_id]).filter(Boolean)
    )
  ) as string[];

  const byId = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      byId.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  const result = rows.map((r) => ({
    ...r,
    target_name: r.target_user_id ? byId.get(r.target_user_id)?.full_name ?? null : null,
    target_email: r.target_user_id ? byId.get(r.target_user_id)?.email ?? null : null,
    evaluator_name: r.evaluator_user_id ? byId.get(r.evaluator_user_id)?.full_name ?? null : null,
    evaluator_email: r.evaluator_user_id ? byId.get(r.evaluator_user_id)?.email ?? null : null,
  }));

  return NextResponse.json({ ok: true, rows: result });
}

export async function PATCH(req: Request) {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as { feedback_id?: string; released_to_collaborator?: boolean };
    const feedbackId = String(body.feedback_id ?? "").trim();
    const release = body.released_to_collaborator === true;
    if (!feedbackId) return NextResponse.json({ error: "feedback_id obrigatorio." }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("feedbacks")
      .update({ released_to_collaborator: release })
      .eq("id", feedbackId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
