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
  empresa?: string | null;
  cargo?: string | null;
  setor?: string | null;
  is_active?: boolean | null;
};

type DirectoryProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string | null;
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

function collaboratorEmails(collaborator: CollaboratorRow) {
  return [collaborator.email, collaborator.email_empresarial, collaborator.email_pessoal]
    .map(cleanEmail)
    .filter(Boolean);
}

function resolveCollaboratorForProfile(
  profile: ProfileRow,
  collaboratorsByUserId: Map<string, CollaboratorRow>,
  collaboratorsByEmail: Map<string, CollaboratorRow>
) {
  return collaboratorsByUserId.get(profile.id) ?? collaboratorsByEmail.get(cleanEmail(profile.email)) ?? null;
}

function enrichProfile(
  profile: ProfileRow,
  collaboratorsByUserId: Map<string, CollaboratorRow>,
  collaboratorsByEmail: Map<string, CollaboratorRow>,
  companyIdByName: Map<string, string>
): DirectoryProfile {
  const collaborator = resolveCollaboratorForProfile(profile, collaboratorsByUserId, collaboratorsByEmail);
  const collaboratorCompanyId = companyIdByName.get(normalizeCompanyName(collaborator?.empresa)) ?? null;
  const collaboratorName = cleanName(collaborator?.nome);
  const profileName = cleanName(profile.full_name);

  return {
    id: profile.id,
    full_name: profileName || collaboratorName || profile.full_name || collaborator?.nome || profile.email,
    email: profile.email,
    company_id: collaboratorCompanyId ?? profile.company_id,
    role: profile.role,
    avatar_url: profile.avatar_url,
    cargo: (collaborator?.cargo ?? "").trim() || null,
    setor: (collaborator?.setor ?? "").trim() || null,
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

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const [profilesRes, companiesRes, collaboratorsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,full_name,email,company_id,role,avatar_url,active")
        .eq("active", true)
        .order("full_name", { ascending: true }),
      supabaseAdmin.from("companies").select("id,name"),
      supabaseAdmin
        .from("colaboradores")
        .select("user_id,nome,email,email_empresarial,email_pessoal,empresa,cargo,setor,is_active"),
    ]);

    if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
    if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 400 });
    if (collaboratorsRes.error) return NextResponse.json({ error: collaboratorsRes.error.message }, { status: 400 });

    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    const companies = (companiesRes.data ?? []) as CompanyRow[];
    const collaborators = ((collaboratorsRes.data ?? []) as CollaboratorRow[]).filter((item) => item.is_active !== false);

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

    const enrichedProfiles = profiles.map((profile) =>
      enrichProfile(profile, collaboratorsByUserId, collaboratorsByEmail, companyIdByName)
    );
    const requesterProfile = enrichedProfiles.find((profile) => profile.id === user.id);
    if (!requesterProfile) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const canSeeAllCompanies = requesterProfile.role === "admin";
    const scopedProfiles = canSeeAllCompanies
      ? enrichedProfiles
      : enrichedProfiles.filter(
          (profile) => profile.id === requesterProfile.id || Boolean(requesterProfile.company_id && profile.company_id === requesterProfile.company_id)
        );

    return NextResponse.json({ ok: true, profiles: scopedProfiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
