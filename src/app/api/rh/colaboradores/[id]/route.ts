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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id do colaborador e obrigatorio" }, { status: 400 });
    }

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

    const { data: colab, error: colabErr } = await supabaseAdmin
      .from("colaboradores")
      .select("id, nome, email, user_id")
      .eq("id", id)
      .maybeSingle<{ id: string; nome: string | null; email: string | null; user_id: string | null }>();

    if (colabErr || !colab) return NextResponse.json({ error: "Colaborador nao encontrado" }, { status: 404 });
    if (colab.user_id === user.id) {
      return NextResponse.json({ error: "Nao e permitido excluir o proprio usuario." }, { status: 400 });
    }

    const { error: deleteErr } = await supabaseAdmin.from("colaboradores").delete().eq("id", id);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 400 });

    if (colab.user_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", colab.user_id);
    }

    return NextResponse.json({
      ok: true,
      message: `Colaborador ${colab.nome || colab.email || "selecionado"} excluido com sucesso.`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
