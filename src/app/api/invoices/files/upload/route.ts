import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "collaborator-invoice-documents";

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

function detectKind(contentType: string) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "application/xml" || contentType === "text/xml") return "xml";
  return "other";
}

function safeName(name: string) {
  const raw = (name || "").trim().slice(0, 140);
  if (!raw) return "arquivo";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const form = await req.formData();
    const invoiceId = String(form.get("invoice_id") ?? "").trim();
    const file = form.get("file");

    if (!invoiceId) return NextResponse.json({ error: "invoice_id e obrigatorio" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });

    const allowedType =
      file.type === "application/pdf" || file.type === "application/xml" || file.type === "text/xml";
    if (!allowedType) return NextResponse.json({ error: "Tipo nao suportado (PDF/XML)" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (max 10MB)" }, { status: 400 });

    const supabaseUser = await getRequesterSupabase(req, requester.token);
    const invoiceRes = await supabaseUser
      .from("collaborator_invoices")
      .select("id,user_id")
      .eq("id", invoiceId)
      .maybeSingle<{ id: string; user_id: string }>();
    if (invoiceRes.error || !invoiceRes.data) return NextResponse.json({ error: "Nota fiscal nao encontrada" }, { status: 404 });

    const path = `invoice/${invoiceId}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName(file.name)}`;
    const uploadRes = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (uploadRes.error) return NextResponse.json({ error: uploadRes.error.message }, { status: 400 });

    const insRes = await supabaseUser.from("collaborator_invoice_files").insert({
      invoice_id: invoiceId,
      user_id: invoiceRes.data.user_id,
      file_kind: detectKind(file.type),
      storage_bucket: BUCKET,
      storage_path: path,
      file_name: file.name || null,
      content_type: file.type || null,
      size_bytes: file.size || null,
      uploaded_by: user.id,
    });
    if (insRes.error) return NextResponse.json({ error: insRes.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
