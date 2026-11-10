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
  alreadyTaken?: boolean | null;
};

type CollaboratorRow = {
  id: string;
  user_id: string | null;
  nome: string | null;
  email: string | null;
  email_empresarial: string | null;
  email_pessoal: string | null;
  superior_direto: string | null;
  email_superior_direto: string | null;
  company_id: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  manager_id: string | null;
  active: boolean | null;
};

function isoDate(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

function clean(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanEmail(value: string | null | undefined) {
  return clean(value).toLowerCase();
}

function normalizeText(value: string | null | undefined) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

async function findActiveProfileById(userId: string | null | undefined) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,manager_id,active")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  return data && data.active !== false ? data : null;
}

async function findActiveProfileByEmail(email: string) {
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,manager_id,active")
    .ilike("email", email)
    .limit(10);
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).find((item) => item.active !== false) ?? null;
}

async function resolveCollaboratorProfile(collaborator: CollaboratorRow) {
  const linkedProfile = await findActiveProfileById(collaborator.user_id);
  if (linkedProfile) return linkedProfile;

  const emails = [collaborator.email_empresarial, collaborator.email, collaborator.email_pessoal]
    .map(cleanEmail)
    .filter(Boolean);
  for (const email of emails) {
    const profile = await findActiveProfileByEmail(email);
    if (!profile) continue;
    const { error } = await supabaseAdmin
      .from("colaboradores")
      .update({ user_id: profile.id })
      .eq("id", collaborator.id);
    if (error) throw error;
    return profile;
  }
  return null;
}

async function resolveManagerId(collaborator: CollaboratorRow, profile: ProfileRow) {
  const linkedManager = await findActiveProfileById(profile.manager_id);
  if (linkedManager?.id && linkedManager.id !== profile.id) return linkedManager.id;

  const managerEmail = cleanEmail(collaborator.email_superior_direto);
  if (managerEmail) {
    let query = supabaseAdmin
      .from("colaboradores")
      .select("user_id,email,email_empresarial,email_pessoal,company_id")
      .or(`email.ilike.${managerEmail},email_empresarial.ilike.${managerEmail},email_pessoal.ilike.${managerEmail}`)
      .limit(10);
    if (collaborator.company_id) query = query.eq("company_id", collaborator.company_id);
    const { data, error } = await query;
    if (error) throw error;
    for (const candidate of (data ?? []) as Array<Pick<CollaboratorRow, "user_id">>) {
      const manager = await findActiveProfileById(candidate.user_id);
      if (manager?.id && manager.id !== profile.id) return manager.id;
    }

    const manager = await findActiveProfileByEmail(managerEmail);
    if (manager?.id && manager.id !== profile.id) return manager.id;
  }

  const managerName = normalizeText(collaborator.superior_direto);
  if (managerName) {
    let query = supabaseAdmin.from("colaboradores").select("user_id,nome,company_id").limit(200);
    if (collaborator.company_id) query = query.eq("company_id", collaborator.company_id);
    const { data, error } = await query;
    if (error) throw error;
    const candidates = ((data ?? []) as Array<Pick<CollaboratorRow, "user_id" | "nome">>).filter((item) => {
      const candidateName = normalizeText(item.nome);
      return candidateName === managerName || candidateName.includes(managerName) || managerName.includes(candidateName);
    });
    for (const candidate of candidates) {
      const manager = await findActiveProfileById(candidate.user_id);
      if (manager?.id && manager.id !== profile.id) return manager.id;
    }
  }

  return null;
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
      .select("id,user_id,nome,email,email_empresarial,email_pessoal,superior_direto,email_superior_direto,company_id")
      .in("id", collaboratorIds);
    if (collaboratorsError) throw collaboratorsError;

    const collaborators = (collaboratorsData ?? []) as CollaboratorRow[];
    const collaboratorById = new Map(collaborators.map((item) => [item.id, item]));
    const allowanceRows = [];
    const requestRows = [];
    const notifyRows = [];
    const nowIso = new Date().toISOString();

    for (const row of inputRows) {
      const collaboratorId = String(row.collaboratorId ?? "").trim();
      const collaborator = collaboratorById.get(collaboratorId);
      const startDate = isoDate(row.startDate);
      const endDate = isoDate(row.endDate);
      if (!collaborator || !startDate || !endDate || endDate < startDate) continue;

      const profile = await resolveCollaboratorProfile(collaborator);
      if (!profile) {
        throw new Error(`Nao foi encontrado um acesso ativo para ${collaborator.nome ?? "o colaborador"}.`);
      }
      const userId = profile.id;
      const managerId = await resolveManagerId(collaborator, profile);
      if (!managerId) {
        throw new Error(`Nao foi encontrado um superior direto ativo para ${collaborator.nome ?? "o colaborador"}.`);
      }

      const daysCount = diffDaysInclusive(startDate, endDate);
      const daysAllowed = Math.max(daysCount, Number(row.daysAllowed ?? daysCount) || daysCount);
      const alreadyTaken = row.alreadyTaken === true;
      const reason = (row.reason ?? "").trim() || "Ausencia previamente autorizada pelo gestor e registrada pelo RH.";
      const managerComment = alreadyTaken
        ? "Autorizacao previa registrada pelo RH. Periodo ja tirado pelo colaborador."
        : "Autorizacao previa registrada pelo RH. Periodo programado.";

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
        manager_comment: managerComment,
        decided_at: nowIso,
      });

      notifyRows.push({
        user_id: userId,
        manager_id: managerId,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason,
        manager_comment: managerComment,
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
    if (requestInsert.error) {
      const insertedAllowanceIds = (allowanceInsert.data ?? []).map((item) => item.id as string).filter(Boolean);
      if (insertedAllowanceIds.length) {
        await supabaseAdmin.from("absence_allowances").delete().in("id", insertedAllowanceIds);
      }
      throw requestInsert.error;
    }

    return NextResponse.json({
      ok: true,
      created: requestInsert.data?.length ?? requestsWithAllowance.length,
      requests: notifyRows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Erro ao registrar ausencias aprovadas.") },
      { status: 500 },
    );
  }
}
