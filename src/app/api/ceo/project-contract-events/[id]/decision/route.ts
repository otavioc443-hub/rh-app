import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DecisionStatus = "approved" | "rejected" | "cancelled";

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const };
    return { user: data.user, status: 200 as const };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const) };
}

async function safeNotify(toUserIds: string[], title: string, body: string, link: string, type: string) {
  const uniqueIds = Array.from(new Set(toUserIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  const payload = uniqueIds.map((id) => ({ to_user_id: id, title, body, link, type }));
  const res = await supabaseAdmin.from("notifications").insert(payload);
  if (!res.error) return;

  const text = res.error.message.toLowerCase();
  const ignorable =
    text.includes("does not exist") ||
    text.includes("relation") ||
    text.includes("schema cache") ||
    text.includes("column");
  if (!ignorable) throw new Error(res.error.message);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const requester = await getRequesterUser(req);
    const actor = requester.user;
    if (!actor) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const { data: actorProfile, error: actorErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", actor.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (actorErr || !actorProfile?.active || String(actorProfile.role ?? "") !== "admin") {
      return NextResponse.json({ error: "Apenas CEO/Admin pode decidir." }, { status: 403 });
    }

    const body = (await req.json()) as { status?: DecisionStatus; note?: string | null };
    const next = String(body.status ?? "") as DecisionStatus;
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (!["approved", "rejected", "cancelled"].includes(next)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("project_contract_events")
      .select("id,project_id,event_type,status,apply_on_approval,additional_amount,to_budget_total,requested_by,title")
      .eq("id", id)
      .maybeSingle<{
        id: string;
        project_id: string;
        event_type: string;
        status: string;
        apply_on_approval: boolean;
        additional_amount: number | null;
        to_budget_total: number | null;
        requested_by: string | null;
        title: string;
      }>();
    if (rowErr || !row) return NextResponse.json({ error: "Evento nao encontrado." }, { status: 404 });
    if (row.event_type !== "aditivo_valor") {
      return NextResponse.json({ error: "Apenas aditivo de valor exige decisao financeira." }, { status: 400 });
    }

    let finalStatus = next === "approved" ? "aprovado" : next === "rejected" ? "rejeitado" : "cancelado";
    let appliedToProject = false;
    const nowIso = new Date().toISOString();

    if (next === "approved" && row.apply_on_approval) {
      const currentBudgetRes = await supabaseAdmin
        .from("projects")
        .select("budget_total")
        .eq("id", row.project_id)
        .maybeSingle<{ budget_total: number | null }>();
      if (currentBudgetRes.error) return NextResponse.json({ error: currentBudgetRes.error.message }, { status: 400 });

      const current = Number(currentBudgetRes.data?.budget_total) || 0;
      const nextBudget = row.to_budget_total != null ? Number(row.to_budget_total) : current + (Number(row.additional_amount) || 0);
      const updateProject = await supabaseAdmin
        .from("projects")
        .update({ budget_total: nextBudget })
        .eq("id", row.project_id);
      if (updateProject.error) return NextResponse.json({ error: updateProject.error.message }, { status: 400 });
      finalStatus = "executado";
      appliedToProject = true;
    }

    const updateRes = await supabaseAdmin
      .from("project_contract_events")
      .update({
        status: finalStatus,
        finance_decision_note: note,
        finance_decided_by: actor.id,
        finance_decided_at: nowIso,
        applied_to_project: appliedToProject ? true : undefined,
        applied_at: appliedToProject ? nowIso : undefined,
      })
      .eq("id", row.id);
    if (updateRes.error) return NextResponse.json({ error: updateRes.error.message }, { status: 400 });

    const { error: auditDecisionErr } = await supabaseAdmin.from("project_contract_event_audit").insert({
      event_id: row.id,
      project_id: row.project_id,
      actor_user_id: actor.id,
      actor_role: actorProfile.role ?? "admin",
      action_type: "finance_decision",
      status_from: row.status,
      status_to: finalStatus,
      notes: note,
      metadata: {
        apply_on_approval: row.apply_on_approval,
        applied_to_project: appliedToProject,
        additional_amount: row.additional_amount,
        to_budget_total: row.to_budget_total,
      },
    });
    if (auditDecisionErr) return NextResponse.json({ error: auditDecisionErr.message }, { status: 400 });

    if (row.requested_by) {
      await safeNotify(
        [row.requested_by],
        `Decisao do CEO: ${row.title}`,
        `Status: ${finalStatus}${note ? `. Observacao: ${note}` : ""}`,
        "/ceo/aditivos-contratuais",
        "project_contract_event"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
