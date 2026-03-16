import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSupabase } from "@/lib/server/supabaseServer";
import {
  calculateBehaviorAxisResults,
  getPredominantBehaviorAxes,
} from "@/lib/behaviorProfile";

type AxisResult = ReturnType<typeof calculateBehaviorAxisResults>;

function normalizeDateInput(value: string | null) {
  return String(value ?? "").slice(0, 10);
}

function localDateIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeIds(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return Array.from(
    new Set(
      input
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
}

function normalizeDisplayName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name || name.includes("@")) return null;
  return name;
}

async function resolveCurrentUserContext() {
  const supabaseServer = await getServerSupabase();
  const { data: userRes, error: userErr } = await supabaseServer.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) return { ok: false as const, status: 401, error: "Não autenticado." };

  const profileRes = await supabaseAdmin
    .from("profiles")
    .select("full_name,email")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; email: string | null }>();
  if (profileRes.error) return { ok: false as const, status: 500, error: profileRes.error.message };

  const resolvedEmail = user.email ?? profileRes.data?.email ?? null;
  const resolvedFullName =
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    profileRes.data?.full_name ||
    "";

  const collaboratorIds = new Set<string>();
  let collaboratorName: string | null = null;
  const byUser = await supabaseAdmin
    .from("colaboradores")
    .select("id,nome")
    .eq("user_id", user.id)
    .limit(5);
  if (byUser.error) return { ok: false as const, status: 500, error: byUser.error.message };
  for (const row of (byUser.data ?? []) as Array<{ id: string; nome: string | null }>) {
    collaboratorIds.add(row.id);
    collaboratorName = collaboratorName ?? normalizeDisplayName(row.nome);
  }

  if (resolvedEmail) {
    const byEmail = await supabaseAdmin
      .from("colaboradores")
      .select("id,nome")
      .ilike("email", resolvedEmail)
      .limit(5);
    if (byEmail.error) return { ok: false as const, status: 500, error: byEmail.error.message };
    for (const row of (byEmail.data ?? []) as Array<{ id: string; nome: string | null }>) {
      collaboratorIds.add(row.id);
      collaboratorName = collaboratorName ?? normalizeDisplayName(row.nome);
    }
  }

  if (resolvedFullName.trim()) {
    const byName = await supabaseAdmin
      .from("colaboradores")
      .select("id,nome")
      .ilike("nome", resolvedFullName.trim())
      .limit(5);
    if (byName.error) return { ok: false as const, status: 500, error: byName.error.message };
    for (const row of (byName.data ?? []) as Array<{ id: string; nome: string | null }>) {
      collaboratorIds.add(row.id);
      collaboratorName = collaboratorName ?? normalizeDisplayName(row.nome);
    }
  }

  return {
    ok: true as const,
    userId: user.id,
    email: resolvedEmail,
    fullName: collaboratorName ?? normalizeDisplayName(resolvedFullName) ?? resolvedFullName,
    collaboratorId: collaboratorIds.values().next().value ?? null,
    collaboratorIds: Array.from(collaboratorIds),
  };
}

export async function GET() {
  const context = await resolveCurrentUserContext();
  if (!context.ok) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const todayIso = localDateIso();

  const releasesByUserRes = await supabaseAdmin
    .from("behavior_assessment_releases")
    .select("id,window_start,window_end,is_active,created_at,collaborator_id")
    .eq("is_active", true)
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });
  if (releasesByUserRes.error) {
    return NextResponse.json({ error: releasesByUserRes.error.message }, { status: 500 });
  }
  const releasesByCollaboratorRes = context.collaboratorIds.length
    ? await supabaseAdmin
        .from("behavior_assessment_releases")
        .select("id,window_start,window_end,is_active,created_at,collaborator_id")
        .eq("is_active", true)
        .in("collaborator_id", context.collaboratorIds)
        .order("created_at", { ascending: false })
    : null;
  if (releasesByCollaboratorRes?.error) {
    return NextResponse.json({ error: releasesByCollaboratorRes.error.message }, { status: 500 });
  }
  const releaseMap = new Map<string, {
    id: string;
    window_start: string;
    window_end: string;
    is_active: boolean;
    created_at: string;
    collaborator_id: string | null;
  }>();
  for (const row of [
    ...((releasesByUserRes.data ?? []) as Array<{
      id: string;
      window_start: string;
      window_end: string;
      is_active: boolean;
      created_at: string;
      collaborator_id: string | null;
    }>),
    ...((releasesByCollaboratorRes?.data ?? []) as Array<{
      id: string;
      window_start: string;
      window_end: string;
      is_active: boolean;
      created_at: string;
      collaborator_id: string | null;
    }>),
  ]) {
    if (!releaseMap.has(row.id)) releaseMap.set(row.id, row);
  }

  const activeRelease =
    Array.from(releaseMap.values()).find((row) => {
      const start = normalizeDateInput(row.window_start);
      const end = normalizeDateInput(row.window_end);
      return start <= todayIso && end >= todayIso;
    }) ?? null;

  const assessmentsByUserRes = await supabaseAdmin
    .from("behavior_assessments")
    .select("id,created_at,predominant_self,predominant_others,self_result,others_result")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (assessmentsByUserRes.error) {
    return NextResponse.json({ error: assessmentsByUserRes.error.message }, { status: 500 });
  }
  const assessmentsByCollaboratorRes = context.collaboratorIds.length
    ? await supabaseAdmin
        .from("behavior_assessments")
        .select("id,created_at,predominant_self,predominant_others,self_result,others_result")
        .in("collaborator_id", context.collaboratorIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : null;
  if (assessmentsByCollaboratorRes?.error) {
    return NextResponse.json({ error: assessmentsByCollaboratorRes.error.message }, { status: 500 });
  }
  const assessmentMap = new Map<string, {
    id: string;
    created_at: string;
    predominant_self: string[] | null;
    predominant_others: string[] | null;
    self_result: AxisResult;
    others_result: AxisResult;
  }>();
  for (const row of [
    ...((assessmentsByUserRes.data ?? []) as Array<{
      id: string;
      created_at: string;
      predominant_self: string[] | null;
      predominant_others: string[] | null;
      self_result: AxisResult;
      others_result: AxisResult;
    }>),
    ...((assessmentsByCollaboratorRes?.data ?? []) as Array<{
      id: string;
      created_at: string;
      predominant_self: string[] | null;
      predominant_others: string[] | null;
      self_result: AxisResult;
      others_result: AxisResult;
    }>),
  ]) {
    if (!assessmentMap.has(row.id)) assessmentMap.set(row.id, row);
  }

  return NextResponse.json({
    ok: true,
    userId: context.userId,
    fullName: context.fullName,
    email: context.email,
    collaboratorId: context.collaboratorId,
    activeRelease: activeRelease
      ? {
          id: activeRelease.id,
          window_start: normalizeDateInput(activeRelease.window_start),
          window_end: normalizeDateInput(activeRelease.window_end),
        }
      : null,
    history: Array.from(assessmentMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10),
  });
}

export async function POST(req: Request) {
  const context = await resolveCurrentUserContext();
  if (!context.ok) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const selfSelectedIds = normalizeIds(body.selfSelectedIds);
  const othersSelectedIds = normalizeIds(body.othersSelectedIds);
  const fullName =
    typeof body.fullName === "string" && body.fullName.trim()
      ? body.fullName.trim()
      : context.fullName || "Colaborador";
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : (context.email ?? "sem-email@local");

  if (!selfSelectedIds.length || !othersSelectedIds.length) {
    return NextResponse.json(
      { error: "Selecione adjetivos nas etapas 2 e 3 para registrar o mapa." },
      { status: 400 }
    );
  }

  const todayIso = localDateIso();
  const releasesByUserRes = await supabaseAdmin
    .from("behavior_assessment_releases")
    .select("id,window_start,window_end,is_active,created_at,collaborator_id")
    .eq("is_active", true)
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });
  if (releasesByUserRes.error) {
    return NextResponse.json({ error: releasesByUserRes.error.message }, { status: 500 });
  }
  const releasesByCollaboratorRes = context.collaboratorIds.length
    ? await supabaseAdmin
        .from("behavior_assessment_releases")
        .select("id,window_start,window_end,is_active,created_at,collaborator_id")
        .eq("is_active", true)
        .in("collaborator_id", context.collaboratorIds)
        .order("created_at", { ascending: false })
    : null;
  if (releasesByCollaboratorRes?.error) {
    return NextResponse.json({ error: releasesByCollaboratorRes.error.message }, { status: 500 });
  }

  const activeRelease =
    [
      ...((releasesByUserRes.data ?? []) as Array<{
        id: string;
        window_start: string;
        window_end: string;
        is_active: boolean;
        created_at: string;
        collaborator_id: string | null;
      }>),
      ...((releasesByCollaboratorRes?.data ?? []) as Array<{
        id: string;
        window_start: string;
        window_end: string;
        is_active: boolean;
        created_at: string;
        collaborator_id: string | null;
      }>),
    ].find((row) => {
      const start = normalizeDateInput(row.window_start);
      const end = normalizeDateInput(row.window_end);
      return start <= todayIso && end >= todayIso;
    }) ?? null;

  if (!activeRelease) {
    return NextResponse.json(
      { error: "A avaliação comportamental não está liberada para você neste momento. Solicite ao RH." },
      { status: 403 }
    );
  }

  const selfResult: AxisResult = calculateBehaviorAxisResults(selfSelectedIds);
  const othersResult: AxisResult = calculateBehaviorAxisResults(othersSelectedIds);
  const predominantSelf = getPredominantBehaviorAxes(selfResult).map((item) => item.key);
  const predominantOthers = getPredominantBehaviorAxes(othersResult).map((item) => item.key);

  const payload: Record<string, unknown> = {
    user_id: context.userId,
    collaborator_id: context.collaboratorId,
    full_name: fullName,
    email,
    self_selected_ids: selfSelectedIds,
    others_selected_ids: othersSelectedIds,
    self_result: selfResult,
    others_result: othersResult,
    predominant_self: predominantSelf,
    predominant_others: predominantOthers,
  };

  const insertRes = await supabaseAdmin.from("behavior_assessments").insert(payload);
  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
