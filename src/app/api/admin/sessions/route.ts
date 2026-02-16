import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LogoutReason = "manual" | "idle" | "token_expired" | null;

type SessionAuditRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  department_id: string | null;
  login_at: string;
  last_seen_at: string;
  logout_at: string | null;
  logout_reason: LogoutReason;
  user_agent: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  department_id: string | null;
};

function normalizeRole(value: string | null) {
  const role = (value ?? "").trim().toLowerCase();
  if (!role) return "colaborador";
  if (role === "user") return "colaborador";
  return role;
}

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

function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value ?? "");
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
  try {
    const supabaseServer = await getServerSupabase();
    const { data: userRes } = await supabaseServer.auth.getUser();
    const user = userRes?.user;

    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; active: boolean | null }>();

    if (profErr || !profile?.active || !(profile.role === "admin" || profile.role === "rh")) {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const q = req.nextUrl.searchParams;
    const mode = q.get("mode") === "online" ? "online" : "all";
    const reason = q.get("reason") ?? "all";
    const departmentId = q.get("departmentId") ?? "all";
    const roleFilter = q.get("role") ?? "all";
    const search = (q.get("search") ?? "").trim().toLowerCase();
    const limit = Math.min(parseIntParam(q.get("limit"), 50), 200);

    let dbq = supabaseAdmin
      .from("session_audit")
      .select("id,user_id,company_id,department_id,login_at,last_seen_at,logout_at,logout_reason,user_agent")
      .order("last_seen_at", { ascending: false })
      .limit(limit * 3); // buffer para filtro em memoria

    if (mode === "online") {
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      dbq = dbq.is("logout_at", null).gte("last_seen_at", since);
    }

    if (reason !== "all") dbq = dbq.eq("logout_reason", reason);
    if (departmentId !== "all") dbq = dbq.eq("department_id", departmentId);

    const { data: sessionsData, error: sessionsErr } = await dbq;
    if (sessionsErr) return NextResponse.json({ error: sessionsErr.message }, { status: 400 });

    const sessions = (sessionsData ?? []) as SessionAuditRow[];
    const userIds = Array.from(new Set(sessions.map((s) => s.user_id).filter(Boolean)));

    const profilesById = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role, department_id")
        .in("id", userIds);

      for (const p of (profilesData ?? []) as ProfileRow[]) profilesById.set(p.id, p);
    }

    const merged = sessions.map((s) => {
      const p = profilesById.get(s.user_id);
      return {
        ...s,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        role: normalizeRole(p?.role ?? null),
        department_id: s.department_id ?? p?.department_id ?? null,
      };
    });

    // Inclui usuarios com ultimo login no Auth mesmo sem registro no session_audit.
    // Isso melhora a visibilidade do historico completo na tela de sessoes.
    if (mode === "all") {
      const existingIds = new Set(merged.map((r) => r.user_id));
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUsers = authList?.users ?? [];
      const missingUserIds = authUsers.map((u) => u.id).filter((id) => !existingIds.has(id));

      if (missingUserIds.length > 0) {
        const { data: missingProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, role, department_id")
          .in("id", missingUserIds);

        for (const p of (missingProfiles ?? []) as ProfileRow[]) profilesById.set(p.id, p);
      }

      for (const u of authUsers) {
        if (existingIds.has(u.id)) continue;

        const p = profilesById.get(u.id);
        const lastSeen = u.last_sign_in_at ?? u.created_at ?? new Date().toISOString();

        merged.push({
          id: `auth-${u.id}`,
          user_id: u.id,
          company_id: null,
          department_id: p?.department_id ?? null,
          login_at: lastSeen,
          last_seen_at: lastSeen,
          logout_at: null,
          logout_reason: null,
          user_agent: null,
          full_name: p?.full_name ?? (typeof u.user_metadata?.full_name === "string" ? u.user_metadata.full_name : null),
          email: p?.email ?? u.email ?? null,
          role: normalizeRole(p?.role ?? null),
        });
      }
    }

    const filtered = merged.filter((r) => {
      if (roleFilter !== "all" && normalizeRole(r.role) !== roleFilter) return false;
      if (departmentId !== "all" && r.department_id !== departmentId) return false;

      if (!search) return true;
      const name = (r.full_name ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      return name.includes(search) || email.includes(search);
    });

    const sorted = filtered.sort((a, b) => {
      const ta = Date.parse(a.last_seen_at ?? a.login_at ?? "");
      const tb = Date.parse(b.last_seen_at ?? b.login_at ?? "");
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return NextResponse.json({ ok: true, rows: sorted.slice(0, limit) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
