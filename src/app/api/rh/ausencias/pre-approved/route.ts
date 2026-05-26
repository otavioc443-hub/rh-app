import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { diffDaysInclusive } from "@/lib/absence";

type InputRow = {
  collaboratorId?: string;
  userId?: string | null;
  startDate?: string;
  endDate?: string;
  reason?: string | null;
  daysAllowed?: number | null;
};

type CollaboratorRow = {
  id: string;
  user_id: string | null;
  nome: string | null;
};

type ProfileRow = {
  id: string;
  manager_id: string | null;
};

function isoDate(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await request.json()) as { rows?: InputRow[] };
    const inputRows = Array.isArray(body.rows) ? body.rows : [];
    if (!inputRows.length) return NextResponse.json({ error: "Nenhum colaborador informado." }, { status: 400 });

    const collaboratorIds = Array.from(new Set(inputRows.map((row) => row.collaboratorId).filter(Boolean))) as string[];
    if (!collaboratorIds.length) return NextResponse.json({ error: "Informe ao menos um colaborador." }, { status: 400 });

    const { data: collaboratorsData, error: collaboratorsError } = await supabaseAdmin
      .from("colaboradores")
      .select("id,user_id,nome")
      .in("id", collaboratorIds);
    if (collaboratorsError) throw collaboratorsError;

    const collaborators = (collaboratorsData ?? []) as CollaboratorRow[];
    const collaboratorById = new Map(collaborators.map((item) => [item.id, item]));
    const userIds = Array.from(new Set(collaborators.map((item) => item.user_id).filter(Boolean))) as string[];

    const { data: profilesData, error: profilesError } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id,manager_id").in("id", userIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profileById = new Map(((profilesData ?? []) as ProfileRow[]).map((item) => [item.id, item]));

    const allowanceRows = [];
    const requestRows = [];
    const notifyRows = [];
    const nowIso = new Date().toISOString();

    for (const row of inputRows) {
      const collaboratorId = String(row.collaboratorId ?? "").trim();
      const collaborator = collaboratorById.get(collaboratorId);
      const userId = collaborator?.user_id ?? row.userId ?? null;
      const startDate = isoDate(row.startDate);
      const endDate = isoDate(row.endDate);
      if (!collaborator || !userId || !startDate || !endDate || endDate < startDate) continue;

      const daysCount = diffDaysInclusive(startDate, endDate);
      const daysAllowed = Math.max(daysCount, Number(row.daysAllowed ?? daysCount) || daysCount);
      const profile = profileById.get(userId);
      const managerId = profile?.manager_id ?? access.userId;
      const reason = (row.reason ?? "").trim() || "Ausencia previamente autorizada pelo gestor e registrada pelo RH.";

      allowanceRows.push({
        user_id: userId,
        collaborator_id: collaboratorId,
        days_allowed: daysAllowed,
        window_start: startDate,
        window_end: endDate,
        valid_from: startDate,
        valid_to: endDate,
        max_days: daysAllowed,
        created_by: access.userId,
        is_active: true,
      });

      requestRows.push({
        user_id: userId,
        manager_id: managerId,
        allowance_id: null,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason,
        status: "approved",
        manager_comment: "Autorizacao previa registrada pelo RH.",
        decided_at: nowIso,
      });

      notifyRows.push({
        user_id: userId,
        manager_id: managerId,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason,
        manager_comment: "Autorizacao previa registrada pelo RH.",
      });
    }

    if (!requestRows.length) {
      return NextResponse.json({ error: "Nenhum registro valido para salvar. Verifique usuario vinculado e datas." }, { status: 400 });
    }

    const allowanceInsert = await supabaseAdmin.from("absence_allowances").insert(allowanceRows).select("id,user_id");
    if (allowanceInsert.error) throw allowanceInsert.error;

    const allowanceIdsByUser = new Map((allowanceInsert.data ?? []).map((item) => [item.user_id as string, item.id as string]));
    const requestsWithAllowance = requestRows.map((row) => ({
      ...row,
      allowance_id: allowanceIdsByUser.get(row.user_id) ?? null,
    }));

    const requestInsert = await supabaseAdmin.from("absence_requests").insert(requestsWithAllowance).select("id,user_id");
    if (requestInsert.error) throw requestInsert.error;

    return NextResponse.json({
      ok: true,
      created: requestInsert.data?.length ?? requestsWithAllowance.length,
      requests: notifyRows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar ausencias aprovadas." },
      { status: 500 },
    );
  }
}
