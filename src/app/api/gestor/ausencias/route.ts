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
};

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

function collaboratorDepartmentKey(collab: Colaborador | null | undefined) {
  return (
    clean(collab?.department_id) ||
    clean(collab?.departamento).toLowerCase() ||
    clean(collab?.setor).toLowerCase()
  );
}

function pickTeamUserIds(input: {
  meId: string;
  meRole: string | null;
  profiles: ProfileRow[];
  colaboradores: Colaborador[];
  requests: AbsenceRequestRow[];
  allowances: AllowanceRow[];
}) {
  const { meId, meRole, profiles, colaboradores, requests, allowances } = input;
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

  const myProfile = profiles.find((p) => p.id === meId) ?? null;
  const myCollaborator = colaboradores.find((c) => c.user_id === meId) ?? null;
  const managerEmails = new Set(
    [
      myProfile?.email,
      myCollaborator?.email,
      myCollaborator?.email_empresarial,
      myCollaborator?.email_pessoal,
    ]
      .map(cleanEmail)
      .filter(Boolean)
  );
  const managerNames = new Set([myProfile?.full_name, myCollaborator?.nome].map(normalizeText).filter(Boolean));
  const myProfileDepartment = clean(myProfile?.department_id);
  const myCollabDepartment = collaboratorDepartmentKey(myCollaborator);

  for (const profile of profiles) {
    if (profile.active === false || profile.id === meId) continue;
    if (profile.manager_id === meId) ids.add(profile.id);
    if (myProfileDepartment && profile.department_id === myProfileDepartment) ids.add(profile.id);
  }

  for (const collab of colaboradores) {
    if (!collab.user_id || collab.user_id === meId) continue;
    const superiorEmail = cleanEmail(collab.email_superior_direto);
    const superiorName = normalizeText(collab.superior_direto);
    const collabDepartment = collaboratorDepartmentKey(collab);

    if ((superiorEmail && managerEmails.has(superiorEmail)) || (superiorName && managerNames.has(superiorName))) {
      ids.add(collab.user_id);
    }
    if (myCollabDepartment && collabDepartment && collabDepartment === myCollabDepartment) ids.add(collab.user_id);
    if (myProfileDepartment && collab.department_id === myProfileDepartment) ids.add(collab.user_id);
  }

  for (const request of requests) {
    if (request.manager_id === meId) ids.add(request.user_id);
  }

  for (const allowance of allowances) {
    if (allowance.user_id && ids.has(allowance.user_id)) ids.add(allowance.user_id);
  }

  return ids;
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const [profilesRes, collabRes, allowancesRes, requestsRes, membersRes] = await Promise.all([
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
      supabaseAdmin.from("project_members").select("project_id,user_id,member_role"),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (collabRes.error) throw collabRes.error;
    if (allowancesRes.error) throw allowancesRes.error;
    if (requestsRes.error) throw requestsRes.error;
    if (membersRes.error) throw membersRes.error;

    const profiles = ((profilesRes.data ?? []) as ProfileRow[]).filter((item) => item.active !== false);
    const colaboradores = ((collabRes.data ?? []) as Colaborador[]).filter((item) => item.is_active !== false);
    const allowances = (allowancesRes.data ?? []) as AllowanceRow[];
    const requests = (requestsRes.data ?? []) as AbsenceRequestRow[];
    const members = membersRes.data ?? [];
    const myProfile = profiles.find((p) => p.id === user.id) ?? null;
    const meRole = myProfile?.role ?? null;
    const isWideViewer = meRole === "admin" || meRole === "rh" || meRole === "diretoria";

    const teamUserIds = pickTeamUserIds({
      meId: user.id,
      meRole,
      profiles,
      colaboradores,
      requests,
      allowances,
    });
    const teamCollaboratorIds = new Set(
      colaboradores
        .filter((collab) => collab.user_id && teamUserIds.has(collab.user_id))
        .map((collab) => collab.id)
    );

    if (isWideViewer) {
      return NextResponse.json({ profiles, colaboradores, allowances: allowancesRes.data ?? [], requests: requestsRes.data ?? [], members, meRole });
    }

    const scopedRequests = ((requestsRes.data ?? []) as Array<AbsenceRequestRow>).filter(
      (request) => request.manager_id === user.id || teamUserIds.has(request.user_id)
    );
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
    const scopedMembers = (members as Array<{ user_id?: string | null }>).filter(
      (member) => member.user_id === user.id || (!!member.user_id && teamUserIds.has(member.user_id))
    );

    return NextResponse.json({
      profiles: scopedProfiles,
      colaboradores: scopedColaboradores,
      allowances: scopedAllowances,
      requests: scopedRequests,
      members: scopedMembers,
      meRole,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar ausencias do gestor." },
      { status: 500 }
    );
  }
}
