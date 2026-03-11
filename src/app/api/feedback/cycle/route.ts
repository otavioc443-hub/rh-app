import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRoles } from "@/lib/server/feedbackGuard";

type FeedbackCycle = {
  id: string;
  name: string;
  collect_start: string;
  collect_end: string;
  release_start: string;
  release_end: string;
  one_on_one_warn_days: number;
  one_on_one_danger_days: number;
  collaborator_ack_warn_days: number;
  collaborator_ack_danger_days: number;
  active: boolean;
  created_at: string;
  created_by: string | null;
  feedback_count?: number;
  sent_feedback_count?: number;
};

function isSchemaCacheMissingTableError(message: string | undefined | null) {
  const m = String(message ?? "").toLowerCase();
  return (
    m.includes("schema cache") && m.includes("feedback_cycles")
  ) || m.includes("could not find the table 'public.feedback_cycles'");
}

function isCycleOpen(row: Pick<FeedbackCycle, "collect_start" | "release_end" | "active">) {
  if (!row.active) return false;
  const now = Date.now();
  const start = Date.parse(row.collect_start);
  const end = Date.parse(row.release_end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

export async function GET(req: Request) {
  const guard = await requireRoles(["colaborador", "coordenador", "rh", "admin", "gestor"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const includeAll = new URL(req.url).searchParams.get("include_all") === "1";
  const canReadAllCycles = includeAll && (guard.role === "rh" || guard.role === "admin");

  const baseQuery = supabaseAdmin
    .from("feedback_cycles")
    .select(
      "id,name,collect_start,collect_end,release_start,release_end,one_on_one_warn_days,one_on_one_danger_days,collaborator_ack_warn_days,collaborator_ack_danger_days,active,created_at,created_by"
    )
    .order("created_at", { ascending: false });

  if (canReadAllCycles) {
    const { data, error } = await baseQuery.limit(200);
    if (error) {
      if (isSchemaCacheMissingTableError(error.message)) {
        return NextResponse.json({
          ok: true,
          cycle: null,
          cycles: [],
          collectOpen: false,
          releaseOpen: false,
          warning: "Tabela feedback_cycles nao encontrada neste banco. Aplique a migration de feedback.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const cycles = (data ?? []) as FeedbackCycle[];
    const cycleIds = cycles.map((row) => row.id);
    const feedbackCountByCycleId = new Map<string, number>();
    const sentFeedbackCountByCycleId = new Map<string, number>();
    if (cycleIds.length > 0) {
      const { data: feedbacks } = await supabaseAdmin
        .from("feedbacks")
        .select("cycle_id,status")
        .in("cycle_id", cycleIds);
      for (const row of (feedbacks ?? []) as Array<{ cycle_id: string | null; status: string | null }>) {
        if (!row.cycle_id) continue;
        feedbackCountByCycleId.set(row.cycle_id, (feedbackCountByCycleId.get(row.cycle_id) ?? 0) + 1);
        if (row.status === "sent") {
          sentFeedbackCountByCycleId.set(
            row.cycle_id,
            (sentFeedbackCountByCycleId.get(row.cycle_id) ?? 0) + 1
          );
        }
      }
    }

    let totalCompanyCollaborators = 0;
    let collaboratorsQuery = supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("role", "colaborador");
    if (guard.companyId) collaboratorsQuery = collaboratorsQuery.eq("company_id", guard.companyId);
    const { count: collaboratorsCount, error: collaboratorsErr } = await collaboratorsQuery;
    if (collaboratorsErr) return NextResponse.json({ error: collaboratorsErr.message }, { status: 400 });
    totalCompanyCollaborators = collaboratorsCount ?? 0;

    const cyclesWithCounts = cycles.map((row) => ({
      ...row,
      feedback_count: feedbackCountByCycleId.get(row.id) ?? 0,
      sent_feedback_count: sentFeedbackCountByCycleId.get(row.id) ?? 0,
    }));
    const activeCycle = cycles.find((row) => row.active) ?? null;
    const now = Date.now();
    const collectOpen =
      !!activeCycle &&
      now >= Date.parse(activeCycle.collect_start) &&
      now <= Date.parse(activeCycle.collect_end);
    const releaseOpen =
      !!activeCycle &&
      now >= Date.parse(activeCycle.release_start) &&
      now <= Date.parse(activeCycle.release_end);

    return NextResponse.json({
      ok: true,
      actor_role: guard.role,
      cycle: activeCycle,
      cycles: cyclesWithCounts,
      total_company_collaborators: totalCompanyCollaborators,
      collectOpen,
      releaseOpen,
    });
  }

  const { data, error } = await baseQuery
    .eq("active", true)
    .limit(1)
    .maybeSingle<FeedbackCycle>();

  if (error) {
    if (isSchemaCacheMissingTableError(error.message)) {
      return NextResponse.json({
        ok: true,
        cycle: null,
        collectOpen: false,
        releaseOpen: false,
        warning: "Tabela feedback_cycles nao encontrada neste banco. Aplique a migration de feedback.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const now = Date.now();
  const collectOpen = !!data && now >= Date.parse(data.collect_start) && now <= Date.parse(data.collect_end);
  const releaseOpen = !!data && now >= Date.parse(data.release_start) && now <= Date.parse(data.release_end);

  return NextResponse.json({ ok: true, actor_role: guard.role, cycle: data, collectOpen, releaseOpen });
}

export async function PUT(req: Request) {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as Partial<FeedbackCycle>;
    const cycleId = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const collectStart = String(body.collect_start ?? "");
    const collectEnd = String(body.collect_end ?? "");
    const releaseStart = String(body.release_start ?? "");
    const releaseEnd = String(body.release_end ?? "");
    const oneOnOneWarnDays = Math.max(1, Math.min(60, Number(body.one_on_one_warn_days ?? 2) || 2));
    const oneOnOneDangerDays = Math.max(
      oneOnOneWarnDays,
      Math.min(90, Number(body.one_on_one_danger_days ?? 5) || 5)
    );
    const collaboratorAckWarnDays = Math.max(
      1,
      Math.min(60, Number(body.collaborator_ack_warn_days ?? 3) || 3)
    );
    const collaboratorAckDangerDays = Math.max(
      collaboratorAckWarnDays,
      Math.min(90, Number(body.collaborator_ack_danger_days ?? 7) || 7)
    );

    if (!name || !collectStart || !collectEnd || !releaseStart || !releaseEnd) {
      return NextResponse.json({ error: "Campos obrigatorios ausentes." }, { status: 400 });
    }

    if (cycleId) {
      const { data: cycle, error: cycleErr } = await supabaseAdmin
        .from("feedback_cycles")
        .select("id,collect_start,release_end,active")
        .eq("id", cycleId)
        .maybeSingle<Pick<FeedbackCycle, "id" | "collect_start" | "release_end" | "active">>();
      if (cycleErr) return NextResponse.json({ error: cycleErr.message }, { status: 400 });
      if (!cycle) return NextResponse.json({ error: "Ciclo nao encontrado." }, { status: 404 });

      if (guard.role === "rh" && !isCycleOpen(cycle)) {
        return NextResponse.json(
          { error: "RH so pode editar ciclo em aberto e ativo." },
          { status: 403 }
        );
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("feedback_cycles")
        .update({
          name,
          collect_start: collectStart,
          collect_end: collectEnd,
          release_start: releaseStart,
          release_end: releaseEnd,
          one_on_one_warn_days: oneOnOneWarnDays,
          one_on_one_danger_days: oneOnOneDangerDays,
          collaborator_ack_warn_days: collaboratorAckWarnDays,
          collaborator_ack_danger_days: collaboratorAckDangerDays,
        })
        .eq("id", cycleId)
        .select(
          "id,name,collect_start,collect_end,release_start,release_end,one_on_one_warn_days,one_on_one_danger_days,collaborator_ack_warn_days,collaborator_ack_danger_days,active,created_at,created_by"
        )
        .single<FeedbackCycle>();
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, cycle: updated });
    }

    const { error: disableErr } = await supabaseAdmin
      .from("feedback_cycles")
      .update({ active: false })
      .eq("active", true);
    if (disableErr) {
      if (isSchemaCacheMissingTableError(disableErr.message)) {
        return NextResponse.json(
          { error: "Tabela feedback_cycles nao encontrada neste banco. Aplique a migration de feedback antes de salvar o ciclo." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: disableErr.message }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("feedback_cycles")
      .insert({
        name,
        collect_start: collectStart,
        collect_end: collectEnd,
        release_start: releaseStart,
        release_end: releaseEnd,
        one_on_one_warn_days: oneOnOneWarnDays,
        one_on_one_danger_days: oneOnOneDangerDays,
        collaborator_ack_warn_days: collaboratorAckWarnDays,
        collaborator_ack_danger_days: collaboratorAckDangerDays,
        active: true,
        created_by: guard.userId,
      })
      .select(
        "id,name,collect_start,collect_end,release_start,release_end,one_on_one_warn_days,one_on_one_danger_days,collaborator_ack_warn_days,collaborator_ack_danger_days,active,created_at,created_by"
      )
      .single<FeedbackCycle>();

    if (error) {
      if (isSchemaCacheMissingTableError(error.message)) {
        return NextResponse.json(
          { error: "Tabela feedback_cycles nao encontrada neste banco. Aplique a migration de feedback antes de salvar o ciclo." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, cycle: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const guard = await requireRoles(["rh", "admin"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json().catch(() => ({}))) as { cycle_id?: string };
    const cycleIdRaw = String(body?.cycle_id ?? "").trim();

    let cycleId = cycleIdRaw;
    if (!cycleId) {
      const { data: activeCycle, error: activeErr } = await supabaseAdmin
        .from("feedback_cycles")
        .select("id")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 400 });
      if (!activeCycle?.id) {
        return NextResponse.json({ ok: true, deleted_feedbacks: 0, deleted_cycle: false });
      }
      cycleId = activeCycle.id;
    }

    const { data: cycle, error: cycleErr } = await supabaseAdmin
      .from("feedback_cycles")
      .select("id,collect_start,release_end,active")
      .eq("id", cycleId)
      .maybeSingle<Pick<FeedbackCycle, "id" | "collect_start" | "release_end" | "active">>();
    if (cycleErr) return NextResponse.json({ error: cycleErr.message }, { status: 400 });
    if (!cycle) return NextResponse.json({ error: "Ciclo nao encontrado." }, { status: 404 });

    const { count: feedbackCount, error: countErr } = await supabaseAdmin
      .from("feedbacks")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycleId);
    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 400 });

    if (guard.role === "rh") {
      if (!isCycleOpen(cycle)) {
        return NextResponse.json(
          { error: "RH so pode excluir ciclo em aberto e ativo." },
          { status: 403 }
        );
      }
      if ((feedbackCount ?? 0) > 0) {
        return NextResponse.json(
          { error: "RH so pode excluir ciclo sem feedbacks registrados." },
          { status: 403 }
        );
      }
    }

    const { error: feedbackErr } = await supabaseAdmin
      .from("feedbacks")
      .delete()
      .eq("cycle_id", cycleId);
    if (feedbackErr) return NextResponse.json({ error: feedbackErr.message }, { status: 400 });

    const { error: deleteCycleErr } = await supabaseAdmin
      .from("feedback_cycles")
      .delete()
      .eq("id", cycleId);
    if (deleteCycleErr) return NextResponse.json({ error: deleteCycleErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      deleted_feedbacks: feedbackCount ?? 0,
      deleted_cycle: true,
      cycle_id: cycleId,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
