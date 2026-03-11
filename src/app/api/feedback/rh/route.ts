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
  cycle_name?: string | null;
  target_department_name?: string | null;
  released_to_collaborator: boolean | null;
  one_on_one_completed_at: string | null;
  one_on_one_completed_by: string | null;
  one_on_one_notes: string | null;
};

type CycleRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type FeedbackReceiptRow = {
  feedback_id: string;
  collaborator_user_id: string;
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
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabaseAdmin
    .from("feedbacks")
    .select(
      "id,created_at,target_user_id,evaluator_user_id,source_role,comment,details_json,final_score,final_classification,status,cycle_id,released_to_collaborator,one_on_one_completed_at,one_on_one_completed_by,one_on_one_notes"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as FeedbackRow[];
  const cycleIds = Array.from(new Set(rows.map((r) => r.cycle_id).filter(Boolean))) as string[];
  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.target_user_id, r.evaluator_user_id]).filter(Boolean)
    )
  ) as string[];

  const byId = new Map<string, { full_name: string | null; email: string | null; department_id: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,department_id")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null; department_id: string | null }>) {
      byId.set(p.id, {
        full_name: normalizeDisplayName(p.full_name),
        email: p.email,
        department_id: p.department_id ?? null,
      });
    }

    const { data: collabs } = await supabaseAdmin
      .from("colaboradores")
      .select("user_id,nome,email,department_id")
      .in("user_id", userIds);
    for (const c of (collabs ?? []) as Array<{ user_id: string | null; nome: string | null; email: string | null; department_id: string | null }>) {
      if (!c.user_id) continue;
      const current = byId.get(c.user_id) ?? { full_name: null, email: null, department_id: null };
      byId.set(c.user_id, {
        full_name: current.full_name ?? normalizeDisplayName(c.nome) ?? null,
        email: current.email ?? c.email ?? null,
        department_id: current.department_id ?? c.department_id ?? null,
      });
    }

    // Fallback: quando o usuario ainda nao esta vinculado por user_id em colaboradores,
    // tenta resolver o nome pelo e-mail para evitar "sem nome cadastrado" no filtro/lista.
    const unresolvedEntries = Array.from(byId.entries()).filter(([, value]) => !value.full_name && value.email);
    const unresolvedEmails = Array.from(
      new Set(unresolvedEntries.map(([, value]) => String(value.email ?? "").trim()).filter(Boolean))
    );
    if (unresolvedEmails.length > 0) {
      const { data: collabsByEmail } = await supabaseAdmin
        .from("colaboradores")
        .select("email,nome")
        .in("email", unresolvedEmails);
      const nameByEmail = new Map<string, string>();
      for (const row of (collabsByEmail ?? []) as Array<{ email: string | null; nome: string | null }>) {
        const email = String(row.email ?? "").trim();
        const name = normalizeDisplayName(row.nome);
        if (!email || !name) continue;
        if (!nameByEmail.has(email)) nameByEmail.set(email, name);
      }
      for (const [userId, value] of unresolvedEntries) {
        const email = String(value.email ?? "").trim();
        const name = nameByEmail.get(email);
        if (!name) continue;
        byId.set(userId, { ...value, full_name: name });
      }
    }
  }

  const cycleById = new Map<string, CycleRow>();
  if (cycleIds.length > 0) {
    const { data: cycles } = await supabaseAdmin.from("feedback_cycles").select("id,name").in("id", cycleIds);
    for (const c of (cycles ?? []) as CycleRow[]) cycleById.set(c.id, c);
  }

  const departmentIds = Array.from(new Set(Array.from(byId.values()).map((v) => v.department_id).filter(Boolean))) as string[];
  const departmentById = new Map<string, string>();
  if (departmentIds.length > 0) {
    const { data: departments } = await supabaseAdmin.from("departments").select("id,name").in("id", departmentIds);
    for (const d of (departments ?? []) as DepartmentRow[]) {
      if (!d.id) continue;
      departmentById.set(d.id, d.name?.trim() || d.id);
    }
  }

  const result = rows.map((r) => ({
    ...r,
    target_name: r.target_user_id ? byId.get(r.target_user_id)?.full_name ?? null : null,
    target_email: r.target_user_id ? byId.get(r.target_user_id)?.email ?? null : null,
    evaluator_name: r.evaluator_user_id ? byId.get(r.evaluator_user_id)?.full_name ?? null : null,
    evaluator_email: r.evaluator_user_id ? byId.get(r.evaluator_user_id)?.email ?? null : null,
    one_on_one_completed_by_name: r.one_on_one_completed_by ? byId.get(r.one_on_one_completed_by)?.full_name ?? null : null,
    cycle_name: r.cycle_id ? cycleById.get(r.cycle_id)?.name ?? null : null,
    target_department_name: r.target_user_id
      ? departmentById.get(byId.get(r.target_user_id)?.department_id ?? "") ?? null
      : null,
  }));

  const feedbackIds = result.map((r) => r.id);
  const receiptByFeedbackId = new Map<string, FeedbackReceiptRow>();
  if (feedbackIds.length > 0) {
    const { data: receipts, error: receiptErr } = await supabaseAdmin
      .from("feedback_receipts")
      .select("feedback_id,collaborator_user_id,collaborator_comment,acknowledged_at")
      .in("feedback_id", feedbackIds);
    if (receiptErr) return NextResponse.json({ error: receiptErr.message }, { status: 400 });
    for (const row of (receipts ?? []) as FeedbackReceiptRow[]) {
      receiptByFeedbackId.set(row.feedback_id, row);
    }
  }

  const withReceipts = result.map((row) => ({
    ...row,
    acknowledged_at: receiptByFeedbackId.get(row.id)?.acknowledged_at ?? null,
    collaborator_comment: receiptByFeedbackId.get(row.id)?.collaborator_comment ?? null,
  }));

  return NextResponse.json({ ok: true, rows: withReceipts });
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
