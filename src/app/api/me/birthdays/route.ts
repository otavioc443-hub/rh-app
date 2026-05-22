import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProfileRow = {
  id: string;
  company_id: string | null;
  full_name?: string | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
};

type CollaboratorRow = {
  id: string;
  user_id?: string | null;
  company_id?: string | null;
  nome: string | null;
  data_nascimento: string | null;
  departamento: string | null;
  cargo: string | null;
  empresa?: string | null;
  is_active?: boolean | null;
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

function normalizeCompanyName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeCompanyName(a);
  const right = normalizeCompanyName(b);
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left));
}

function isSchemaSelectError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return message.includes("schema cache") || message.includes("could not find") || message.includes("column");
}

async function selectBirthdayCollaborators() {
  const selects = [
    "id,user_id,company_id,nome,data_nascimento,departamento,cargo,empresa,is_active",
    "id,user_id,nome,data_nascimento,departamento,cargo,empresa,is_active",
    "id,nome,data_nascimento,departamento,cargo,empresa,is_active",
  ];

  for (const select of selects) {
    const { data, error } = await supabaseAdmin
      .from("colaboradores")
      .select(select)
      .not("data_nascimento", "is", null);

    if (!error) {
      return (((data ?? []) as unknown) as CollaboratorRow[]).filter((row) => row.is_active !== false);
    }
    if (!isSchemaSelectError(error)) throw error;
  }

  return [];
}

async function findRequesterCollaborator(userId: string, email: string | null | undefined) {
  const selects = [
    "id,user_id,company_id,nome,empresa",
    "id,user_id,nome,empresa",
    "id,nome,empresa",
  ];

  const cleanEmail = (email ?? "").trim();
  if (cleanEmail) {
    for (const column of ["email", "email_empresarial", "email_pessoal"]) {
      for (const select of selects) {
        const byEmail = await supabaseAdmin
          .from("colaboradores")
          .select(select)
          .ilike(column, cleanEmail)
          .limit(1)
          .maybeSingle<CollaboratorRow>();
        if (!byEmail.error && byEmail.data) return byEmail.data;
        if (byEmail.error && !isSchemaSelectError(byEmail.error)) throw byEmail.error;
      }
    }
  }

  for (const select of selects) {
    const byUserId = await supabaseAdmin
      .from("colaboradores")
      .select(select)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle<CollaboratorRow>();
    if (!byUserId.error && byUserId.data) return byUserId.data;
    if (byUserId.error && !isSchemaSelectError(byUserId.error)) throw byUserId.error;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const [{ data: profile }, collaborator] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,company_id,full_name")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>(),
      findRequesterCollaborator(user.id, user.email ?? null),
    ]);

    let companyId = profile?.company_id ?? collaborator?.company_id ?? null;
    let companyName = collaborator?.empresa?.trim() || null;

    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id,name")
        .eq("id", companyId)
        .maybeSingle<CompanyRow>();
      companyName = company?.name?.trim() || companyName;
    }

    if (!companyId && companyName) {
      const { data: companies } = await supabaseAdmin.from("companies").select("id,name");
      const match = ((companies ?? []) as CompanyRow[]).find((company) => namesMatch(company.name, companyName));
      if (match?.id) {
        companyId = match.id;
        companyName = match.name?.trim() || companyName;
      }
    }

    if (!companyId && !companyName) {
      return NextResponse.json({ ok: true, companyId: null, companyName: null, birthdays: [] });
    }

    const sameCompanyUserIds = new Set<string>();
    if (companyId) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id,company_id")
        .eq("company_id", companyId);
      for (const item of (profiles ?? []) as ProfileRow[]) {
        if (item.id) sameCompanyUserIds.add(item.id);
      }
    }

    const collaborators = await selectBirthdayCollaborators();
    const birthdays = collaborators
      .filter((row) => {
        if (!row.data_nascimento) return false;
        if (companyId && row.company_id === companyId) return true;
        if (row.user_id && sameCompanyUserIds.has(row.user_id)) return true;
        return namesMatch(row.empresa, companyName);
      })
      .map((row) => ({
        id: row.id,
        nome: row.nome,
        data_nascimento: row.data_nascimento,
        departamento: row.departamento,
        cargo: row.cargo,
        empresa: row.empresa ?? companyName,
        company_id: row.company_id ?? null,
        user_id: row.user_id ?? null,
      }));

    return NextResponse.json({ ok: true, companyId, companyName, birthdays });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar aniversariantes." },
      { status: 500 }
    );
  }
}
