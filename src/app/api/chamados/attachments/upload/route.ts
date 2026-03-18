import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "request-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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

function sanitizeFileName(value: string) {
  const base = value.trim() || "arquivo";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const bucketRes = await supabaseAdmin.storage.getBucket(BUCKET);
    if (bucketRes.error) {
      const created = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
    } else if (bucketRes.data.public) {
      const updated = await supabaseAdmin.storage.updateBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
      if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }

    const supabaseServer = await getServerSupabase();
    const { data: auth } = await supabaseServer.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,active")
      .eq("id", user.id)
      .maybeSingle<{ id: string; active: boolean | null }>();
    if (!profile?.active) return NextResponse.json({ error: "Usuario sem acesso ativo." }, { status: 403 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio." }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Formato nao suportado. Use PDF, JPG, PNG, WEBP, DOC ou DOCX." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo muito grande (max 10MB)." }, { status: 400 });

    const safeName = sanitizeFileName(file.name);
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ error: signed.error?.message ?? "Falha ao assinar anexo." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      signedUrl: signed.data.signedUrl,
      path,
      bucket: BUCKET,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
