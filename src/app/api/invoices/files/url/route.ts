import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const, token: null };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token: null };
}

async function getRequesterSupabase(req: Request, token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

export async function GET(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const url = new URL(req.url);
    const fileId = String(url.searchParams.get("file_id") ?? "").trim();
    if (!fileId) return NextResponse.json({ error: "file_id e obrigatorio" }, { status: 400 });

    const supabaseUser = await getRequesterSupabase(req, requester.token);
    const fileRes = await supabaseUser
      .from("collaborator_invoice_files")
      .select("id,storage_bucket,storage_path")
      .eq("id", fileId)
      .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();
    if (fileRes.error || !fileRes.data) return NextResponse.json({ error: "Arquivo nao encontrado" }, { status: 404 });

    const signRes = await supabaseAdmin
      .storage
      .from(fileRes.data.storage_bucket)
      .createSignedUrl(fileRes.data.storage_path, 60 * 60);
    if (signRes.error || !signRes.data?.signedUrl) {
      return NextResponse.json({ error: signRes.error?.message ?? "Falha ao assinar URL" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, signedUrl: signRes.data.signedUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
