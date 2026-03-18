import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPortalAvatarUrl } from "@/lib/avatarUrl";

const BUCKET = "avatars";
const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

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

export async function POST(req: Request) {
  try {
    const bucketRes = await supabaseAdmin.storage.getBucket(BUCKET);
    if (bucketRes.error) {
      const created = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 3 * 1024 * 1024,
        allowedMimeTypes: AVATAR_MIME_TYPES,
      });
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
    } else if (bucketRes.data.public) {
      const updated = await supabaseAdmin.storage.updateBucket(BUCKET, {
        public: false,
        fileSizeLimit: 3 * 1024 * 1024,
        allowedMimeTypes: AVATAR_MIME_TYPES,
      });
      if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }

    const supabaseServer = await getServerSupabase();
    const { data: auth } = await supabaseServer.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });

    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Envie um arquivo de imagem" }, { status: 400 });

    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: "Imagem muito grande (max 3MB)" }, { status: 400 });

    const mime = file.type;
    const ext =
      mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : null;
    if (!ext) return NextResponse.json({ error: "Formato nao suportado (PNG/JPG/WEBP)" }, { status: 400 });

    const path = `${user.id}/avatar.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: mime,
      cacheControl: "3600",
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const publicUrl = buildPortalAvatarUrl(path, Date.now());

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, publicUrl, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
