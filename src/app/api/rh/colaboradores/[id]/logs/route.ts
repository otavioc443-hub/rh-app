import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    // valida sessão
    const supabaseServer = await getServerSupabase();
    const { data: userRes } = await supabaseServer.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: prof } = await supabaseServer.from("profiles").select("role, active").eq("id", user.id).single();
    if (!prof?.active || !(prof.role === "rh" || prof.role === "admin")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // logs (compativel com diferentes schemas de auditoria)
    const { data, error } = await supabaseAdmin
      .from("colaboradores_audit_logs")
      .select("*")
      .eq("collaborator_id", id)
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    type RawLog = Record<string, unknown>;
    type LogOut = {
      id: string;
      created_at: string | null;
      actor_email: string | null;
      action: string | null;
      details: unknown;
    };

    const dateCandidates = ["created_at", "updated_at", "changed_at", "logged_at", "timestamp"] as const;
    const emailCandidates = ["actor_email", "updated_by_email", "user_email", "email"] as const;
    const actionCandidates = ["action", "event", "operation", "type"] as const;
    const detailsCandidates = ["details", "payload", "changes", "metadata"] as const;

    const getFirstString = (row: RawLog, keys: readonly string[]) => {
      for (const key of keys) {
        const val = row[key];
        if (typeof val === "string" && val.trim()) return val;
      }
      return null;
    };

    const getFirstAny = (row: RawLog, keys: readonly string[]) => {
      for (const key of keys) {
        if (key in row) return row[key];
      }
      return null;
    };

    const logs: LogOut[] = ((data ?? []) as RawLog[]).map((row, idx) => ({
      id: String(row.id ?? `${idx}`),
      created_at: getFirstString(row, dateCandidates),
      actor_email: getFirstString(row, emailCandidates),
      action: getFirstString(row, actionCandidates),
      details: getFirstAny(row, detailsCandidates) ?? row,
    }));

    logs.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });

    return NextResponse.json({ ok: true, logs: logs.slice(0, 50) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
