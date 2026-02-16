import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "institutional-assets";

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
    if (error || !data?.user) return { user: null, status: 401 as const };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token: null };
}

async function getRequesterSupabase(req: Request, token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

function safePrefix(input: unknown) {
  const raw = typeof input === "string" ? input : "";
  const trimmed = raw.trim().slice(0, 140);
  if (!trimmed) return "global";
  // Mantem apenas caracteres seguros para path do storage.
  return trimmed.replace(/[^a-zA-Z0-9/_-]/g, "_").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
}

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    // Permissao: usa role/active efetivos via RPC com o token do usuario (cookie ou Bearer).
    // Assim, respeita a mesma logica do app (public.current_role/current_active).
    let effectiveRole: string | null = null;
    let active: boolean | null = null;
    try {
      const supabaseUser = await getRequesterSupabase(req, requester.token);
      const [{ data: r, error: rErr }, { data: a, error: aErr }] = await Promise.all([
        supabaseUser.rpc("current_role"),
        supabaseUser.rpc("current_active"),
      ]);
      if (rErr || aErr) throw new Error(rErr?.message || aErr?.message || "rpc failed");
      effectiveRole = r ? String(r) : null;
      active = a === true;
    } catch {
      // fallback: se RPC falhar, usa profiles direto via service role
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle<{ role: string | null; active: boolean | null }>();
      effectiveRole = prof?.role ?? null;
      active = prof?.active === true;
    }

    if (!active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    if (!(effectiveRole === "rh" || effectiveRole === "admin")) {
      return NextResponse.json({ error: "Apenas RH/Admin" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const prefix = safePrefix(form.get("prefix"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });
    }

    const ext = extFromMime(file.type);
    if (!ext) return NextResponse.json({ error: "Tipo de arquivo nao suportado (PNG/JPG/WEBP)" }, { status: 400 });

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: "Arquivo muito grande (max 5MB)" }, { status: 400 });

    const path = `${prefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub.data.publicUrl;
    return NextResponse.json({ ok: true, publicUrl, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
