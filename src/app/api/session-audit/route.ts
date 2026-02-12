import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuditAction = "start" | "heartbeat" | "end";
type LogoutReason = "manual" | "idle" | "token_expired";

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

async function resolveUserFromRequest(req: NextRequest) {
  const supabaseServer = await getServerSupabase();
  const { data: cookieUserRes } = await supabaseServer.auth.getUser();
  if (cookieUserRes?.user) return cookieUserRes.user;

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  const { data: tokenUserRes, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return tokenUserRes.user ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const body = (await req.json()) as {
      action?: AuditAction;
      sessionId?: string;
      reason?: LogoutReason;
      userAgent?: string | null;
      companyId?: string | null;
      departmentId?: string | null;
    };

    const action = body.action;
    if (!action) return NextResponse.json({ error: "Acao obrigatoria" }, { status: 400 });

    if (action === "start") {
      let companyId = body.companyId ?? null;
      let departmentId = body.departmentId ?? null;

      if (!companyId || !departmentId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("company_id, department_id")
          .eq("id", user.id)
          .maybeSingle<{ company_id: string | null; department_id: string | null }>();

        companyId = companyId ?? profile?.company_id ?? null;
        departmentId = departmentId ?? profile?.department_id ?? null;
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from("session_audit")
        .insert({
          user_id: user.id,
          company_id: companyId,
          department_id: departmentId,
          user_agent: body.userAgent ?? null,
          login_at: now,
          last_seen_at: now,
        })
        .select("id")
        .single<{ id: string }>();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, sessionId: data.id });
    }

    const sessionId = body.sessionId?.trim();
    if (!sessionId) return NextResponse.json({ error: "sessionId obrigatorio" }, { status: 400 });

    if (action === "heartbeat") {
      const { error } = await supabaseAdmin
        .from("session_audit")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "end") {
      const reason: LogoutReason = body.reason ?? "manual";
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("session_audit")
        .update({
          last_seen_at: now,
          logout_at: now,
          logout_reason: reason,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
