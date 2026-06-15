import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
};

type Department = {
  id: string;
  name: string;
};

type Profile = {
  role: string | null;
  company_id: string | null;
  department_id: string | null;
  full_name: string | null;
};

type Collaborator = {
  nome: string | null;
  cargo: string | null;
  empresa: string | null;
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

async function findCollaborator(userId: string, email: string | null | undefined) {
  const select = "nome,cargo,empresa";
  const byUserId = await supabaseAdmin
    .from("colaboradores")
    .select(select)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<Collaborator>();
  if (!byUserId.error && byUserId.data) return byUserId.data;

  const cleanEmail = (email ?? "").trim();
  if (!cleanEmail) return null;

  for (const column of ["email", "email_empresarial", "email_pessoal"]) {
    const byEmail = await supabaseAdmin
      .from("colaboradores")
      .select(select)
      .ilike(column, cleanEmail)
      .limit(1)
      .maybeSingle<Collaborator>();
    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

function matchCompany(companies: Company[], companyName: string | null | undefined) {
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return null;
  return (
    companies.find((company) => normalizeCompanyName(company.name) === normalized) ??
    companies.find((company) => {
      const name = normalizeCompanyName(company.name);
      return name.includes(normalized) || normalized.includes(name);
    }) ??
    null
  );
}

export async function GET(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const [{ data: profile }, collaborator, { data: companies }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("role,company_id,department_id,full_name")
        .eq("id", user.id)
        .maybeSingle<Profile>(),
      findCollaborator(user.id, user.email ?? null),
      supabaseAdmin.from("companies").select("id,name,logo_url,primary_color").order("name", { ascending: true }),
    ]);

    const companyList = (companies ?? []) as Company[];
    let company: Company | null = null;
    if (profile?.company_id) {
      company = companyList.find((item) => item.id === profile.company_id) ?? null;
    }
    if (!company) {
      company = matchCompany(companyList, collaborator?.empresa ?? null);
      if (company) {
        await supabaseAdmin.from("profiles").update({ company_id: company.id }).eq("id", user.id);
      }
    }

    let availableCompanies: Company[] = company ? [company] : [];
    if (profile?.role === "admin") {
      availableCompanies = companyList;
      company = company ?? companyList[0] ?? null;
      if (!profile.company_id && company?.id) {
        await supabaseAdmin.from("profiles").update({ company_id: company.id }).eq("id", user.id);
      }
    } else {
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from("profile_company_memberships")
        .select("company_id")
        .eq("user_id", user.id);

      if (!membershipError) {
        const membershipIds = new Set(
          ((memberships ?? []) as Array<{ company_id: string | null }>).map((row) => row.company_id).filter(Boolean) as string[]
        );
        if (company?.id) membershipIds.add(company.id);
        availableCompanies = companyList.filter((item) => membershipIds.has(item.id));
      }
    }

    let department: Department | null = null;
    if (profile?.department_id) {
      const { data } = await supabaseAdmin
        .from("departments")
        .select("id,name")
        .eq("id", profile.department_id)
        .maybeSingle<Department>();
      department = data ?? null;
    }

    return NextResponse.json({
      ok: true,
      company,
      availableCompanies,
      department,
      fullName: profile?.full_name || collaborator?.nome || null,
      jobTitle: collaborator?.cargo || null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado" }, { status: 500 });
  }
}
