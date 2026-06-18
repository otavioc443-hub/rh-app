import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  email: string | null;
  manager_id: string | null;
  active: boolean | null;
};

type CollaboratorRow = {
  user_id: string | null;
  nome: string | null;
  email: string | null;
  email_empresarial: string | null;
  email_pessoal: string | null;
  superior_direto: string | null;
  email_superior_direto: string | null;
  company_id: string | null;
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

async function findActiveProfileId(userId: string | null | undefined) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,active")
    .eq("id", userId)
    .maybeSingle<{ id: string; active: boolean | null }>();
  if (error || !data || data.active === false) return null;
  return data.id;
}

async function findProfileIdByEmail(email: string) {
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,active")
    .ilike("email", email)
    .limit(5);
  if (error) throw error;
  const activeProfile = ((data ?? []) as Array<{ id: string; active: boolean | null }>).find((item) => item.active !== false);
  if (activeProfile?.id) return activeProfile.id;

  for (let page = 1; page <= 10; page += 1) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (authError) return null;
    const authUser = authData.users.find((item) => cleanEmail(item.email) === email);
    if (authUser?.id) return authUser.id;
    if (authData.users.length < 100) return null;
  }

  return null;
}

async function findManagerIdByEmail(email: string, companyId: string | null) {
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,company_id")
    .or(`email.ilike.${email},email_empresarial.ilike.${email},email_pessoal.ilike.${email}`)
    .limit(10);
  if (error) throw error;

  const candidates = ((data ?? []) as CollaboratorRow[]).filter((item) => !companyId || item.company_id === companyId);
  for (const candidate of candidates) {
    const profileId = await findActiveProfileId(candidate.user_id);
    if (profileId) return profileId;
  }

  return findProfileIdByEmail(email);
}

async function findManagerIdByName(name: string, companyId: string | null) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;

  let query = supabaseAdmin
    .from("colaboradores")
    .select("user_id,nome,email,email_empresarial,email_pessoal,company_id")
    .limit(100);

  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) throw error;

  const candidates = ((data ?? []) as CollaboratorRow[]).filter((item) => {
    const candidateName = normalizeText(item.nome);
    return candidateName === normalizedName || candidateName.includes(normalizedName) || normalizedName.includes(candidateName);
  });

  for (const candidate of candidates) {
    const profileId = await findActiveProfileId(candidate.user_id);
    if (profileId) return profileId;
    const emailProfileId =
      (await findProfileIdByEmail(cleanEmail(candidate.email))) ||
      (await findProfileIdByEmail(cleanEmail(candidate.email_empresarial))) ||
      (await findProfileIdByEmail(cleanEmail(candidate.email_pessoal)));
    if (emailProfileId) return emailProfileId;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,manager_id,active")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();
    if (profileError) throw profileError;
    if (profile?.manager_id) return NextResponse.json({ ok: true, managerId: profile.manager_id, source: "profile" });

    const userEmail = cleanEmail(user.email ?? profile?.email);
    let collaboratorQuery = supabaseAdmin
      .from("colaboradores")
      .select("user_id,nome,email,email_empresarial,email_pessoal,superior_direto,email_superior_direto,company_id")
      .limit(5);

    collaboratorQuery = userEmail
      ? collaboratorQuery.or(`user_id.eq.${user.id},email.ilike.${userEmail},email_empresarial.ilike.${userEmail},email_pessoal.ilike.${userEmail}`)
      : collaboratorQuery.eq("user_id", user.id);

    const { data: collaboratorRows, error: collaboratorError } = await collaboratorQuery;
    if (collaboratorError) throw collaboratorError;

    const collaborator = ((collaboratorRows ?? []) as CollaboratorRow[]).find(
      (item) =>
        item.user_id === user.id ||
        cleanEmail(item.email) === userEmail ||
        cleanEmail(item.email_empresarial) === userEmail ||
        cleanEmail(item.email_pessoal) === userEmail
    );

    if (!collaborator) {
      return NextResponse.json(
        { error: "Nao encontrei o cadastro de colaborador vinculado ao seu acesso para resolver o gestor direto." },
        { status: 404 }
      );
    }

    const managerEmail = cleanEmail(collaborator.email_superior_direto);
    const managerName = clean(collaborator.superior_direto);
    const companyId = clean(collaborator.company_id) || null;
    const managerId = (await findManagerIdByEmail(managerEmail, companyId)) || (await findManagerIdByName(managerName, companyId));

    if (!managerId) {
      return NextResponse.json(
        { error: "O superior direto esta preenchido, mas nao encontrei um perfil ativo de acesso para ele." },
        { status: 404 }
      );
    }

    await supabaseAdmin
      .from("profiles")
      .update({ manager_id: managerId })
      .eq("id", user.id)
      .is("manager_id", null);

    return NextResponse.json({ ok: true, managerId, source: "collaborator" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao resolver gestor direto." },
      { status: 500 }
    );
  }
}
