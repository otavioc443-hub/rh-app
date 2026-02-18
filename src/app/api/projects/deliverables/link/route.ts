import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LinkPayload = {
  deliverable_id?: string;
  document_url?: string | null;
};

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

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    const user = requester.user;
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const body = (await req.json().catch(() => ({}))) as LinkPayload;
    const deliverableId = String(body.deliverable_id ?? "").trim();
    const link = typeof body.document_url === "string" ? body.document_url.trim() : "";

    if (!deliverableId) {
      return NextResponse.json({ error: "deliverable_id e obrigatorio" }, { status: 400 });
    }

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
      .select("id, project_id, assigned_to, status, submitted_by, submitted_at")
      .eq("id", deliverableId)
      .maybeSingle<{
        id: string;
        project_id: string;
        assigned_to: string | null;
        status: string;
        submitted_by: string | null;
        submitted_at: string | null;
      }>();
    if (delErr || !del) return NextResponse.json({ error: "Entregavel nao encontrado" }, { status: 404 });

    let allowed = false;
    if (effectiveRole === "admin" || effectiveRole === "rh") {
      allowed = true;
    } else if (del.assigned_to && del.assigned_to === user.id) {
      allowed = true;
    } else if (effectiveRole === "gestor" || effectiveRole === "coordenador") {
      const [{ data: pr }, { data: pm }] = await Promise.all([
        supabaseAdmin.from("projects").select("owner_user_id").eq("id", del.project_id).maybeSingle<{ owner_user_id: string }>(),
        supabaseAdmin
          .from("project_members")
          .select("member_role")
          .eq("project_id", del.project_id)
          .eq("user_id", user.id)
          .maybeSingle<{ member_role: string }>(),
      ]);
      if (pr?.owner_user_id === user.id) allowed = true;
      if (pm?.member_role === "gestor" || pm?.member_role === "coordenador") allowed = true;
    }

    if (!allowed) return NextResponse.json({ error: "Sem permissao para alterar este documento" }, { status: 403 });

    const nextStatus = link ? "sent" : del.status;
    const updatePayload = {
      document_url: link || null,
      status: nextStatus,
      submitted_by: link ? user.id : del.submitted_by,
      submitted_at: link ? new Date().toISOString() : del.submitted_at,
    };

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("project_deliverables")
      .update(updatePayload)
      .eq("id", deliverableId)
      .select("id, document_url, status, submitted_by, submitted_at")
      .single();
    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Nao foi possivel atualizar o documento" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, deliverable: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

