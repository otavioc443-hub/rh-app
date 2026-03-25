import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "avatars";

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

export async function GET(req: Request) {
  try {
    const supabaseServer = await getServerSupabase();
    const { data: auth } = await supabaseServer.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("id,active")
      .eq("id", user.id)
      .maybeSingle<{ id: string; active: boolean | null }>();
    if (!profile?.id || profile.active !== true) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const url = new URL(req.url);
    const path = url.searchParams.get("path")?.trim() ?? "";
    if (!path) return NextResponse.json({ error: "path e obrigatorio" }, { status: 400 });

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 12);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ error: signed.error?.message ?? "Falha ao assinar avatar" }, { status: 400 });
    }

    const response = NextResponse.redirect(signed.data.signedUrl, 307);
    response.headers.set("Cache-Control", "private, max-age=1800, stale-while-revalidate=86400");
    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
