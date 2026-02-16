import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "extra-payment-attachments";

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

function extFromMime(mime: string) {
  if (mime === "application/pdf") return "pdf";
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

    const form = await req.formData();
    const file = form.get("file");
    const paymentId = String(form.get("payment_id") ?? "").trim();

    if (!paymentId) return NextResponse.json({ error: "payment_id e obrigatorio" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo (file) e obrigatorio" }, { status: 400 });

    const ext = extFromMime(file.type);
    if (!ext) return NextResponse.json({ error: "Tipo nao suportado (PDF/PNG/JPG/WEBP)" }, { status: 400 });

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: "Arquivo muito grande (max 10MB)" }, { status: 400 });

    // Permissao: valida via RLS usando o token/cookie do usuario (nao via service role).
    const supabaseUser = await getRequesterSupabase(req, requester.token);

    let effectiveRole: string | null = null;
    let active = false;
    try {
      const [{ data: r, error: rErr }, { data: a, error: aErr }] = await Promise.all([
        supabaseUser.rpc("current_role"),
        supabaseUser.rpc("current_active"),
      ]);
      if (rErr || aErr) throw new Error("rpc failed");
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

    if (!active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const payRes = await supabaseUser
      .from("project_extra_payments")
      .select("id,project_id,status,requested_by")
      .eq("id", paymentId)
      .maybeSingle<{ id: string; project_id: string; status: string; requested_by: string }>();

    if (payRes.error || !payRes.data) return NextResponse.json({ error: "Sem acesso a solicitacao" }, { status: 403 });

    const allowed =
      effectiveRole === "admin" ||
      effectiveRole === "rh" ||
      effectiveRole === "financeiro" ||
      payRes.data.requested_by === user.id;

    if (!allowed) return NextResponse.json({ error: "Sem permissao para anexar" }, { status: 403 });

    const projectId = String(payRes.data.project_id);
    const path = `project/${projectId}/payment/${paymentId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub.data.publicUrl;

    const ins = await supabaseAdmin.from("project_extra_payment_attachments").insert({
      payment_id: paymentId,
      project_id: projectId,
      file_url: publicUrl,
      file_path: path,
      file_name: file.name || null,
      mime_type: file.type || null,
      file_size: file.size || null,
      uploaded_by: user.id,
    });
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, publicUrl, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

