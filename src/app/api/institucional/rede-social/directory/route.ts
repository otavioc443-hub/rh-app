import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
  role: string | null;
  avatar_url: string | null;
  active: boolean | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
};

type CollaboratorRow = {
  user_id: string | null;
  nome: string | null;
  email: string | null;
  email_empresarial?: string | null;
  email_pessoal?: string | null;
  company_id?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  cargo_id?: string | null;
  setor?: string | null;
  departamento?: string | null;
  department_id?: string | null;
  is_active?: boolean | null;
};

type NamedRow = {
  id: string;
  name: string | null;
};

type DirectoryProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
  company_scope_key: string | null;
  role: string | null;
  avatar_url: string | null;
  cargo: string | null;
  setor: string | null;
};

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

function cleanEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function cleanName(value: string | null | undefined) {
  const name = (value ?? "").trim();
  if (!name || name.includes("@")) return "";
  if (/^(colaborador|usuario|usuário|user)$/i.test(name)) return "";
  return name;
}

function normalizeCompanyName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isSchemaCompatError(message: string | null | undefined) {
  const text = (message ?? "").toLowerCase();
  return text.includes("schema cache") || text.includes("could not find") || text.includes("column") || text.includes("does not exist");
}

function collaboratorEmails(collaborator: CollaboratorRow) {
  return [collaborator.email, collaborator.email_empresarial, collaborator.email_pessoal]
    .map(cleanEmail)
    .filter(Boolean);
}

function resolveCollaboratorForProfile(
  profile: ProfileRow,
  collaboratorsByUserId: Map<string, CollaboratorRow>,
  collaboratorsByEmail: Map<string, CollaboratorRow>,
  authEmailByUserId: Map<string, string>
) {
  const authEmail = cleanEmail(authEmailByUserId.get(profile.id));
  const profileEmail = cleanEmail(profile.email);
  return (
    collaboratorsByUserId.get(profile.id) ??
    collaboratorsByEmail.get(authEmail) ??
    collaboratorsByEmail.get(profileEmail) ??
    null
  );
}

function enrichProfile(
  profile: ProfileRow,
  collaboratorsByUserId: Map<string, CollaboratorRow>,
  collaboratorsByEmail: Map<string, CollaboratorRow>,
  companyIdByName: Map<string, string>,
  cargoNameById: Map<string, string>,
  departmentNameById: Map<string, string>,
  authEmailByUserId: Map<string, string>
): DirectoryProfile {
  const collaborator = resolveCollaboratorForProfile(profile, collaboratorsByUserId, collaboratorsByEmail, authEmailByUserId);
  const collaboratorCompanyKey = normalizeCompanyName(collaborator?.empresa);
  const collaboratorCompanyId =
    (collaborator?.company_id ?? "").trim() || companyIdByName.get(collaboratorCompanyKey) || null;
  const officialCompanyId = (profile.company_id ?? "").trim() || collaboratorCompanyId;
  const companyScopeKey = officialCompanyId
    ? `company:${officialCompanyId}`
    : collaboratorCompanyKey
      ? `empresa:${collaboratorCompanyKey}`
      : null;
  const collaboratorName = cleanName(collaborator?.nome);
  const profileName = cleanName(profile.full_name);
  const cargoName = (collaborator?.cargo_id ? cargoNameById.get(collaborator.cargo_id) : null) ?? collaborator?.cargo ?? null;
  const departmentName =
    (collaborator?.department_id ? departmentNameById.get(collaborator.department_id) : null) ??
    collaborator?.setor ??
    collaborator?.departamento ??
    null;

  return {
    id: profile.id,
    full_name: profileName || collaboratorName || profile.full_name || collaborator?.nome || profile.email,
    email: profile.email || authEmailByUserId.get(profile.id) || null,
    company_id: officialCompanyId ?? (collaboratorCompanyKey ? `empresa:${collaboratorCompanyKey}` : null),
    company_scope_key: companyScopeKey,
    role: profile.role,
    avatar_url: profile.avatar_url,
    cargo: (cargoName ?? "").trim() || null,
    setor: (departmentName ?? "").trim() || null,
  };
}

async function getRequesterUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return data.user ?? null;
}

async function fetchCollaborators() {
  const fullSelect =
    "user_id,nome,email,email_empresarial,email_pessoal,company_id,empresa,cargo,cargo_id,setor,departamento,department_id,is_active";
  const fullRes = await supabaseAdmin.from("colaboradores").select(fullSelect);
  if (!fullRes.error || !isSchemaCompatError(fullRes.error.message)) return fullRes;

  const legacyRes = await supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,empresa,cargo,setor,departamento,is_active");
  if (!legacyRes.error || !isSchemaCompatError(legacyRes.error.message)) return legacyRes;

  return supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,empresa,cargo,setor,is_active");
}

async function fetchAuthEmailByUserId() {
  const map = new Map<string, string>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) break;
    for (const authUser of data.users) {
      const email = cleanEmail(authUser.email);
      if (email) map.set(authUser.id, email);
    }
    if (data.users.length < 100) break;
  }
  return map;
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const [profilesRes, companiesRes, collaboratorsRes, cargosRes, departmentsRes, authEmailByUserId] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,full_name,email,company_id,role,avatar_url,active")
        .order("full_name", { ascending: true }),
      supabaseAdmin.from("companies").select("id,name"),
      fetchCollaborators(),
      supabaseAdmin.from("cargos").select("id,name"),
      supabaseAdmin.from("departments").select("id,name"),
      fetchAuthEmailByUserId(),
    ]);

    if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
    if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 400 });
    if (collaboratorsRes.error) return NextResponse.json({ error: collaboratorsRes.error.message }, { status: 400 });

    const profileRows = ((profilesRes.data ?? []) as ProfileRow[]).filter((profile) => profile.active !== false);
    const companies = (companiesRes.data ?? []) as CompanyRow[];
    const collaborators = ((collaboratorsRes.data ?? []) as CollaboratorRow[]).filter((item) => item.is_active !== false);
    const cargoNameById = new Map(
      ((cargosRes.error ? [] : cargosRes.data ?? []) as NamedRow[])
        .map((row) => [row.id, (row.name ?? "").trim()] as const)
        .filter(([, name]) => Boolean(name))
    );
    const departmentNameById = new Map(
      ((departmentsRes.error ? [] : departmentsRes.data ?? []) as NamedRow[])
        .map((row) => [row.id, (row.name ?? "").trim()] as const)
        .filter(([, name]) => Boolean(name))
    );

    const companyIdByName = new Map(
      companies
        .map((company) => [normalizeCompanyName(company.name), company.id] as const)
        .filter(([name]) => Boolean(name))
    );
    const collaboratorsByUserId = new Map<string, CollaboratorRow>();
    const collaboratorsByEmail = new Map<string, CollaboratorRow>();

    for (const collaborator of collaborators) {
      if (collaborator.user_id) collaboratorsByUserId.set(collaborator.user_id, collaborator);
      for (const email of collaboratorEmails(collaborator)) {
        if (!collaboratorsByEmail.has(email)) collaboratorsByEmail.set(email, collaborator);
      }
    }

    const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
    const profiles = [...profileRows];
    for (const collaborator of collaborators) {
      if (!collaborator.user_id || profileById.has(collaborator.user_id)) continue;
      profiles.push({
        id: collaborator.user_id,
        full_name: null,
        email: authEmailByUserId.get(collaborator.user_id) ?? collaboratorEmails(collaborator)[0] ?? null,
        company_id: null,
        role: "colaborador",
        avatar_url: null,
        active: true,
      });
    }

    const enrichedProfiles = profiles.map((profile) =>
      enrichProfile(profile, collaboratorsByUserId, collaboratorsByEmail, companyIdByName, cargoNameById, departmentNameById, authEmailByUserId)
    );
    const requesterProfile = enrichedProfiles.find((profile) => profile.id === user.id);
    if (!requesterProfile) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const canSeeAllCompanies = requesterProfile.role === "admin";
    const scopedProfiles = canSeeAllCompanies
      ? enrichedProfiles
      : enrichedProfiles.filter(
          (profile) =>
            profile.id === requesterProfile.id ||
            Boolean(requesterProfile.company_scope_key && profile.company_scope_key === requesterProfile.company_scope_key)
        );

    return NextResponse.json({ ok: true, profiles: scopedProfiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
