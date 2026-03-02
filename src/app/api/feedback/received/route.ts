import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type FeedbackRow = {
  id: string;
  target_user_id: string | null;
  evaluator_user_id: string | null;
  source_role: string | null;
  comment: string | null;
  details_json: Record<string, unknown> | null;
  final_score: number | null;
  final_classification: string | null;
  status: string | null;
  created_at: string;
  cycle_id: string | null;
  released_to_collaborator: boolean | null;
};

type CycleRow = {
  id: string;
  name: string;
  release_start: string;
  release_end: string;
};

function extractScores(details: Record<string, unknown> | null) {
  if (!details) return null;
  const technical = typeof details.technical === "object" && details.technical ? (details.technical as Record<string, unknown>) : {};
  const behavioral =
    typeof details.behavioral === "object" && details.behavioral ? (details.behavioral as Record<string, unknown>) : {};
  const merged = { ...technical, ...behavioral };
  const normalized = Object.fromEntries(
    Object.entries(merged)
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value))
  );
  return Object.keys(normalized).length ? normalized : null;
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
      "id,target_user_id,evaluator_user_id,source_role,comment,details_json,final_score,final_classification,status,created_at,cycle_id,released_to_collaborator"
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
      .select("id,name,release_start,release_end")
      .in("id", cycleIds);
    for (const c of (cycles ?? []) as CycleRow[]) cycleById.set(c.id, c);
  }

  const evaluatorIds = Array.from(new Set(feedbacks.map((f) => f.evaluator_user_id).filter(Boolean))) as string[];
  const evaluatorById = new Map<string, { full_name: string | null; email: string | null }>();
  if (evaluatorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", evaluatorIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      evaluatorById.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  const now = Date.now();
  const visible = feedbacks.filter((f) => {
    const cycle = f.cycle_id ? cycleById.get(f.cycle_id) : null;
    const inReleaseWindow =
      !!cycle && now >= Date.parse(cycle.release_start) && now <= Date.parse(cycle.release_end);
    return f.released_to_collaborator === true || inReleaseWindow;
  });

  const result = visible.map((f) => {
    const cycle = f.cycle_id ? cycleById.get(f.cycle_id) : null;
    const evaluator = f.evaluator_user_id ? evaluatorById.get(f.evaluator_user_id) : null;
    return {
      ...f,
      scores: extractScores(f.details_json),
      cycle_name: cycle?.name ?? null,
      evaluator_name: evaluator?.full_name ?? null,
      evaluator_email: evaluator?.email ?? null,
    };
  });

  return NextResponse.json({ ok: true, rows: result });
}
