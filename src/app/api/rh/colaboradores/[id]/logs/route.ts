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

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    // valida sessão
    const supabaseServer = await getServerSupabase();
    const { data: userRes } = await supabaseServer.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: prof } = await supabaseServer.from("profiles").select("role, active").eq("id", user.id).single();
    if (!prof?.active || !(prof.role === "rh" || prof.role === "admin")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // logs
    const { data, error } = await supabaseAdmin
      .from("colaboradores_audit_logs")
      .select("id, created_at, actor_email, action, details")
      .eq("collaborator_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, logs: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
