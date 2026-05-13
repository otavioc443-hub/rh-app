import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    if (error || !data?.user) return { user: null, status: 401 as const };
    return { user: data.user, status: 200 as const };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const) };
}

function getAuthRedirectTo() {
  return "https://rh-app-seven.vercel.app/auth/callback";
}

function cleanEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeCompanyName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  try {
    const { collaboratorId } = await req.json();

    if (!collaboratorId) {
      return NextResponse.json({ error: "collaboratorId e obrigatorio" }, { status: 400 });
    }

    // 1) valida autenticacao (Bearer ou cookie) e permissao RH/Admin
    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (profErr || !prof?.active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    if (!(prof.role === "rh" || prof.role === "admin")) {
      return NextResponse.json({ error: "Apenas RH/Admin" }, { status: 403 });
    }

    // 2) busca colaborador
    const { data: colab, error: colabErr } = await supabaseAdmin
      .from("colaboradores")
      .select("id, nome, email, email_empresarial, email_pessoal, user_id, empresa, departamento, is_active")
      .eq("id", collaboratorId)
      .maybeSingle<{
        id: string;
        nome: string | null;
        email: string | null;
        email_empresarial: string | null;
        email_pessoal: string | null;
        user_id: string | null;
        empresa: string | null;
        departamento: string | null;
        is_active: boolean | null;
      }>();

    if (colabErr || !colab) return NextResponse.json({ error: "Colaborador nao encontrado" }, { status: 404 });
    if (colab.is_active === false) return NextResponse.json({ error: "Colaborador inativo" }, { status: 400 });

    const inviteEmail = cleanEmail(colab.email) || cleanEmail(colab.email_empresarial) || cleanEmail(colab.email_pessoal);
    if (!inviteEmail) return NextResponse.json({ error: "Colaborador sem e-mail" }, { status: 400 });

    let companyId: string | null = null;
    if (colab.empresa?.trim()) {
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id,name")
        .order("name", { ascending: true });
      const normalizedEmpresa = normalizeCompanyName(colab.empresa);
      const match = (companies ?? []).find((company) => normalizeCompanyName(company.name) === normalizedEmpresa) ??
        (companies ?? []).find((company) => {
          const name = normalizeCompanyName(company.name);
          return name.includes(normalizedEmpresa) || normalizedEmpresa.includes(name);
        });
      companyId = match?.id ?? null;
    }

    // 3) envia convite
    const redirectTo = getAuthRedirectTo();

    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      inviteEmail,
      { redirectTo }
    );

    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 });

    // 4) garante profiles + vincula colaboradores.user_id
    const profileUserId = inviteData?.user?.id ?? colab.user_id ?? null;
    if (profileUserId) {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: profileUserId,
          email: inviteEmail,
          full_name: colab.nome ?? null,
          role: "colaborador",
          active: true,
          company_id: companyId,
        },
        { onConflict: "id" }
      );

      await supabaseAdmin.from("colaboradores").update({ user_id: profileUserId }).eq("id", colab.id);
    }

    return NextResponse.json({
      ok: true,
      message: `${colab.user_id ? "Convite reenviado" : "Convite enviado"} para ${inviteEmail}`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
