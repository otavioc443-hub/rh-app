import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/server/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "pulsehub-bolao";

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, token, status: 401 as const };
    return { user: data.user, token, status: 200 as const };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, token: null, status: data?.user ? (200 as const) : (401 as const) };
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

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Não autenticado" }, { status: requester.status });

    let role: string | null = null;
    let active = false;
    try {
      const supabaseUser = await getRequesterSupabase(requester.token);
      const [{ data: roleData }, { data: activeData }] = await Promise.all([
        supabaseUser.rpc("current_role"),
        supabaseUser.rpc("current_active"),
      ]);
      role = roleData ? String(roleData) : null;
      active = activeData === true;
    } catch {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role,active")
        .eq("id", requester.user.id)
        .maybeSingle<{ role: string | null; active: boolean | null }>();
      role = profile?.role ?? null;
      active = profile?.active === true;
    }

    if (!active || !(role === "rh" || role === "admin")) {
      return NextResponse.json({ error: "Apenas RH/Admin" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    const ext = extFromMime(file.type);
    if (!ext) return NextResponse.json({ error: "Tipo de imagem não suportado" }, { status: 400 });
    if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máx. 3 MB)" }, { status: 400 });

    const path = `qr-code/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const upload = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, publicUrl: data.publicUrl, path });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
