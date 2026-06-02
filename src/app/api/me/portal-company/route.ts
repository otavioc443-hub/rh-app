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
    if (error || !data?.user) return null;
    return data.user;
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return data?.user ?? null;
}

export async function POST(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const body = (await req.json()) as { company_id?: string | null };
    const companyId = typeof body.company_id === "string" && body.company_id.trim() ? body.company_id.trim() : null;
    if (!companyId) return NextResponse.json({ error: "Empresa obrigatoria" }, { status: 400 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,role,active,company_id")
      .eq("id", user.id)
      .maybeSingle<{ id: string; role: string | null; active: boolean | null; company_id: string | null }>();

    if (profileError || !profile?.active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle<{ id: string }>();
    if (companyError || !company) return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });

    let allowed = profile.company_id === companyId || profile.role === "admin";
    if (!allowed) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("profile_company_memberships")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .maybeSingle<{ company_id: string }>();
      allowed = !membershipError && Boolean(membership);
    }

    if (!allowed) {
      return NextResponse.json({ error: "Empresa nao vinculada ao seu perfil." }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ company_id: companyId })
      .eq("id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json({ ok: true, company_id: companyId });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado" }, { status: 500 });
  }
}
