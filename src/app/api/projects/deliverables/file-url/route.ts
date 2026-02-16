import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "deliverable-documents";

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
    const url = new URL(req.url);
    const deliverableId = String(url.searchParams.get("deliverable_id") ?? "").trim();
    const versionStr = String(url.searchParams.get("version") ?? "").trim();

    if (!deliverableId) return NextResponse.json({ error: "deliverable_id e obrigatorio" }, { status: 400 });

    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

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

    if (!active) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const { data: del, error: delErr } = await supabaseAdmin
      .from("project_deliverables")
      .select("id, project_id, assigned_to, document_path")
      .eq("id", deliverableId)
      .maybeSingle<{ id: string; project_id: string; assigned_to: string | null; document_path: string | null }>();
    if (delErr || !del) return NextResponse.json({ error: "Entregavel nao encontrado" }, { status: 404 });

    const projectId = del.project_id;

    // Checa permissao (mesma regra do upload)
    let allowed = false;
    if (effectiveRole === "admin" || effectiveRole === "rh" || effectiveRole === "financeiro") {
      allowed = true;
    } else if (del.assigned_to && del.assigned_to === user.id) {
      allowed = true;
    } else {
      const [{ data: pr }, { data: pm }] = await Promise.all([
        supabaseAdmin.from("projects").select("owner_user_id").eq("id", projectId).maybeSingle<{ owner_user_id: string }>(),
        supabaseAdmin
          .from("project_members")
          .select("member_role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle<{ member_role: string }>(),
      ]);
      if (pr?.owner_user_id === user.id) allowed = true;
      if (pm?.member_role) allowed = true; // membro do projeto pode visualizar documentos do projeto
    }
    if (!allowed) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    let path: string | null = null;
    const v = versionStr ? Number(versionStr) : NaN;
    if (Number.isFinite(v) && v > 0) {
      const { data: row } = await supabaseAdmin
        .from("project_deliverable_files")
        .select("storage_path")
        .eq("deliverable_id", deliverableId)
        .eq("version", v)
        .maybeSingle<{ storage_path: string }>();
      path = row?.storage_path ?? null;
    } else {
      path = del.document_path ?? null;
    }

    if (!path) return NextResponse.json({ error: "Nenhum arquivo encontrado para este entregavel" }, { status: 404 });

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, signedUrl: signed.data.signedUrl, path });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

