import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PresenceRow = {
  user_id: string;
  last_seen_at: string;
  logout_at: string | null;
};

const ONLINE_WINDOW_MINUTES = 2;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { userIds?: string[] };
    const userIds = Array.from(new Set((body.userIds ?? []).filter(Boolean))).slice(0, 100);
    if (!userIds.length) return NextResponse.json({ presence: {} });

    const { data, error } = await supabaseAdmin
      .from("session_audit")
      .select("user_id,last_seen_at,logout_at")
      .in("user_id", userIds)
      .order("last_seen_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const latestByUser = new Map<string, PresenceRow>();
    for (const row of (data ?? []) as PresenceRow[]) {
      if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
    }

    const threshold = Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000;
    const presence: Record<string, { online: boolean; lastSeenAt: string | null }> = {};
    for (const userId of userIds) {
      const row = latestByUser.get(userId);
      const lastSeenMs = row ? new Date(row.last_seen_at).getTime() : 0;
      presence[userId] = {
        online: !!row && !row.logout_at && !Number.isNaN(lastSeenMs) && lastSeenMs >= threshold,
        lastSeenAt: row?.last_seen_at ?? null,
      };
    }

    return NextResponse.json({ presence });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao consultar presenca." },
      { status: 500 }
    );
  }
}
