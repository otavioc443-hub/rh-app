import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "company-logos";

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
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    // Admin only (role efetiva)
    let effectiveRole: string | null = null;
    let active = false;
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
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle<{ role: string | null; active: boolean | null }>();
      effectiveRole = prof?.role ?? null;
      active = prof?.active === true;
    }

    if (!active) return NextResponse.json({ error: "Sem permissao", active, role: effectiveRole }, { status: 403 });
    if (effectiveRole !== "admin") {
      return NextResponse.json({ error: "Apenas Admin", active, role: effectiveRole }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const cnpj = onlyDigits(String(form.get("cnpj") ?? ""));

    if (cnpj.length !== 14) return NextResponse.json({ error: "CNPJ invalido" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });

    const isPng = file.type === "image/png" || file.type === "image/x-png";
    if (!isPng) return NextResponse.json({ error: "Envie a logo em PNG" }, { status: 400 });

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: "Arquivo muito grande (max 2MB)" }, { status: 400 });

    const path = `${cnpj}/logo.png`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: "image/png",
      cacheControl: "3600",
    });

    if (up.error) {
      return NextResponse.json(
        { error: up.error.message, bucket: BUCKET, path, active, role: effectiveRole },
        { status: 400 }
      );
    }

    const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const baseUrl = pub.data.publicUrl;
    // Cache-bust: como o arquivo eh sempre {cnpj}/logo.png, a URL nao muda e o browser pode manter cache.
    const publicUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
    return NextResponse.json({ ok: true, publicUrl, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
