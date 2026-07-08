import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name: string | null;
  role: string | null;
  manager_id: string | null;
  company_id?: string | null;
  department_id?: string | null;
  active: boolean | null;
};

type Colaborador = {
  id: string;
  user_id: string | null;
  nome: string | null;
  email?: string | null;
  email_empresarial?: string | null;
  email_pessoal?: string | null;
  superior_direto?: string | null;
  email_superior_direto?: string | null;
  is_active: boolean | null;
  department_id?: string | null;
  departamento?: string | null;
  setor?: string | null;
};

type AllowanceRow = {
  id: string;
  user_id: string | null;
  collaborator_id: string | null;
};

type AbsenceRequestRow = {
  id: string;
  user_id: string;
  manager_id: string;
  status?: "pending_manager" | "approved" | "rejected" | "cancelled";
};

type AbsenceDecision = "approved" | "rejected";

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
    if (error || !data?.user) return null;
    return data.user;
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return data?.user ?? null;
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

function managerIdentity(userId: string, profiles: ProfileRow[], colaboradores: Colaborador[]) {
  const profile = profiles.find((p) => p.id === userId) ?? null;
  const collaborator = colaboradores.find((c) => c.user_id === userId) ?? null;
  return {
    emails: new Set(
      [
        profile?.email,
        collaborator?.email,
        collaborator?.email_empresarial,
        collaborator?.email_pessoal,
      ]
        .map(cleanEmail)
        .filter(Boolean)
    ),
    names: new Set([profile?.full_name, collaborator?.nome].map(normalizeText).filter(Boolean)),
  };
}

function pickDirectReportUserIds(input: {
  managerId: string;
  profiles: ProfileRow[];
  colaboradores: Colaborador[];
}) {
  const { managerId, profiles, colaboradores } = input;
  const ids = new Set<string>();
  const identity = managerIdentity(managerId, profiles, colaboradores);

  for (const collab of colaboradores) {
    if (!collab.user_id || collab.user_id === managerId) continue;
    const superiorEmail = cleanEmail(collab.email_superior_direto);
    const superiorName = normalizeText(collab.superior_direto);

    if ((superiorEmail && identity.emails.has(superiorEmail)) || (superiorName && identity.names.has(superiorName))) {
      ids.add(collab.user_id);
    }
  }

  return ids;
}

function pickTeamUserIds(input: {
  meId: string;
  meRole: string | null;
  profiles: ProfileRow[];
  colaboradores: Colaborador[];
  includeIndirect?: boolean;
}) {
  const { meId, meRole, profiles, colaboradores, includeIndirect = false } = input;
  const ids = new Set<string>();
  const isWideViewer = meRole === "admin" || meRole === "rh" || meRole === "diretoria";

  if (isWideViewer) {
    for (const profile of profiles) {
      if (profile.active !== false && profile.id !== meId) ids.add(profile.id);
    }
    for (const collab of colaboradores) {
      if (collab.user_id && collab.user_id !== meId) ids.add(collab.user_id);
    }
    return ids;
  }

  const queue = [...pickDirectReportUserIds({ managerId: meId, profiles, colaboradores })];
  for (const id of queue) ids.add(id);

  if (!includeIndirect) return ids;

  for (let index = 0; index < queue.length; index += 1) {
    const managerId = queue[index];
    const directReports = pickDirectReportUserIds({ managerId, profiles, colaboradores });
    for (const reportId of directReports) {
      if (reportId === meId || ids.has(reportId)) continue;
      ids.add(reportId);
      queue.push(reportId);
    }
  }

  return ids;
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const [profilesRes, collabRes, allowancesRes, requestsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name,role,manager_id,company_id,department_id,active"),
      supabaseAdmin.from("colaboradores").select("*").order("nome", { ascending: true }),
      supabaseAdmin
        .from("absence_allowances")
        .select("id,user_id,collaborator_id,valid_from,valid_to,max_days,window_start,window_end,days_allowed,is_active,created_at,updated_at,created_by")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("absence_requests")
        .select("id,user_id,manager_id,allowance_id,start_date,end_date,days_count,reason,status,manager_comment,created_at,updated_at")
        .order("created_at", { ascending: false }),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (collabRes.error) throw collabRes.error;
    if (allowancesRes.error) throw allowancesRes.error;
    if (requestsRes.error) throw requestsRes.error;

    const profiles = ((profilesRes.data ?? []) as ProfileRow[]).filter((item) => item.active !== false);
    const colaboradores = ((collabRes.data ?? []) as Colaborador[]).filter((item) => item.is_active !== false);
    const myProfile = profiles.find((p) => p.id === user.id) ?? null;
    const meRole = myProfile?.role ?? null;
    const isWideViewer = meRole === "admin" || meRole === "rh" || meRole === "diretoria";

    const teamUserIds = pickTeamUserIds({
      meId: user.id,
      meRole,
      profiles,
      colaboradores,
      includeIndirect: true,
    });
    const approvableUserIds = pickTeamUserIds({
      meId: user.id,
      meRole,
      profiles,
      colaboradores,
      includeIndirect: false,
    });
    for (const request of (requestsRes.data ?? []) as Array<AbsenceRequestRow>) {
      if (request.manager_id === user.id && request.user_id !== user.id) approvableUserIds.add(request.user_id);
    }
    const teamCollaboratorIds = new Set(
      colaboradores
        .filter((collab) => collab.user_id && teamUserIds.has(collab.user_id))
        .map((collab) => collab.id)
    );

    if (isWideViewer) {
      return NextResponse.json({
        profiles,
        colaboradores,
        allowances: allowancesRes.data ?? [],
        requests: requestsRes.data ?? [],
        approvableUserIds: Array.from(approvableUserIds),
        meRole,
      });
    }

    const scopedRequests = ((requestsRes.data ?? []) as Array<AbsenceRequestRow>).filter((request) => teamUserIds.has(request.user_id));
    const scopedRequestUserIds = new Set(scopedRequests.map((request) => request.user_id));
    const scopedAllowances = ((allowancesRes.data ?? []) as Array<AllowanceRow>).filter(
      (allowance) =>
        (!!allowance.user_id && teamUserIds.has(allowance.user_id)) ||
        (!!allowance.collaborator_id && teamCollaboratorIds.has(allowance.collaborator_id))
    );
    const scopedProfiles = profiles.filter(
      (profile) => profile.id === user.id || teamUserIds.has(profile.id) || scopedRequestUserIds.has(profile.id)
    );
    const scopedColaboradores = colaboradores.filter(
      (collab) => collab.user_id === user.id || (!!collab.user_id && teamUserIds.has(collab.user_id)) || teamCollaboratorIds.has(collab.id)
    );
    return NextResponse.json({
      profiles: scopedProfiles,
      colaboradores: scopedColaboradores,
      allowances: scopedAllowances,
      requests: scopedRequests,
      approvableUserIds: Array.from(approvableUserIds),
      meRole,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar ausencias do gestor." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      requestId?: unknown;
      status?: unknown;
      manager_comment?: unknown;
    };
    const requestId = clean(typeof body.requestId === "string" ? body.requestId : "");
    const nextStatus = typeof body.status === "string" ? body.status : "";
    const managerComment = clean(typeof body.manager_comment === "string" ? body.manager_comment : "") || null;

    if (!requestId) return NextResponse.json({ error: "Solicitacao nao informada." }, { status: 400 });
    if (nextStatus !== "approved" && nextStatus !== "rejected") {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const [profilesRes, collabRes, requestsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name,role,manager_id,company_id,department_id,active"),
      supabaseAdmin.from("colaboradores").select("*").order("nome", { ascending: true }),
      supabaseAdmin.from("absence_requests").select("id,user_id,manager_id,status").order("created_at", { ascending: false }),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (collabRes.error) throw collabRes.error;
    if (requestsRes.error) throw requestsRes.error;

    const profiles = ((profilesRes.data ?? []) as ProfileRow[]).filter((item) => item.active !== false);
    const colaboradores = ((collabRes.data ?? []) as Colaborador[]).filter((item) => item.is_active !== false);
    const requests = (requestsRes.data ?? []) as AbsenceRequestRow[];
    const target = requests.find((request) => request.id === requestId) ?? null;
    if (!target) return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
    if (target.status !== "pending_manager") {
      return NextResponse.json({ error: "Solicitacao ja foi decidida." }, { status: 409 });
    }
    if (target.user_id === user.id) {
      return NextResponse.json({ error: "Voce nao pode aprovar ou recusar a propria ausencia." }, { status: 403 });
    }

    const myProfile = profiles.find((p) => p.id === user.id) ?? null;
    const meRole = myProfile?.role ?? null;
    const isWideViewer = meRole === "admin" || meRole === "rh" || meRole === "diretoria";
    const teamUserIds = pickTeamUserIds({
      meId: user.id,
      meRole,
      profiles,
      colaboradores,
      includeIndirect: false,
    });

    const canDecide = isWideViewer || target.manager_id === user.id || teamUserIds.has(target.user_id);
    if (!canDecide) return NextResponse.json({ error: "Voce nao pode decidir esta solicitacao." }, { status: 403 });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("absence_requests")
      .update({
        status: nextStatus as AbsenceDecision,
        manager_comment: managerComment,
        decided_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "pending_manager")
      .select("id,user_id,manager_id,allowance_id,start_date,end_date,days_count,reason,status,manager_comment,created_at,updated_at")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) return NextResponse.json({ error: "Solicitacao ja foi decidida." }, { status: 409 });

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao decidir solicitacao." },
      { status: 500 }
    );
  }
}
