import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "request-attachments";

type AttachmentSource = "profile_request" | "pd_ticket";

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
    if (error || !data?.user) return { user: null, status: 401 as const, token };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token };
}

async function getRequesterSupabase(token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const supabaseUser = await getRequesterSupabase(requester.token);
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("id,active")
      .eq("id", requester.user.id)
      .maybeSingle<{ id: string; active: boolean | null }>();
    if (!profile?.id || profile.active !== true) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as
      | { id?: string; path?: string; source?: AttachmentSource }
      | null;
    const id = String(body?.id ?? "").trim();
    const path = String(body?.path ?? "").trim();
    const source = body?.source === "pd_ticket" ? "pd_ticket" : "profile_request";

    if (!id || !path) {
      return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 });
    }

    if (source === "profile_request") {
      const { data, error } = await supabaseUser
        .from("profile_update_requests")
        .select("id")
        .eq("id", id)
        .maybeSingle<{ id: string }>();
      if (error || !data?.id) return NextResponse.json({ error: "Sem acesso ao anexo" }, { status: 403 });
    } else {
      const { data, error } = await supabaseUser
        .from("pd_tickets")
        .select("id")
        .eq("id", id)
        .maybeSingle<{ id: string }>();
      if (error || !data?.id) return NextResponse.json({ error: "Sem acesso ao anexo" }, { status: 403 });
    }

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ error: signed.error?.message ?? "Falha ao assinar anexo" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, signedUrl: signed.data.signedUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
