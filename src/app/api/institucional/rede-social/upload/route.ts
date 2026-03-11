import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "internal-social-media";

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

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return null;
}

function attachmentTypeFromMime(mime: string): "image" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "arquivo";
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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });
    }

    const ext = extFromMime(file.type);
    const attachmentType = attachmentTypeFromMime(file.type);
    if (!ext || !attachmentType) {
      return NextResponse.json({ error: "Tipo de arquivo nao suportado. Use imagem ou video." }, { status: 400 });
    }

    const maxBytes = attachmentType === "image" ? 10 * 1024 * 1024 : 40 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Arquivo muito grande para upload." }, { status: 400 });
    }

    const path = `${requester.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName(file.name)}`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      ok: true,
      attachmentType,
      url: pub.data.publicUrl,
      label: file.name,
      path,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
