import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { buildDailyGameRounds } from "@/lib/engagementGame";
import {
  canPlayToday,
  ensureEngagementGamePlayer,
  getAuthenticatedPortalUser,
  getNextBusinessDayLabel,
  getTodayDifficulty,
  isWeekendDate,
  isEngagementGameAdmin,
  syncEngagementGameResets,
} from "@/lib/server/engagementGameServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    const user = await getAuthenticatedPortalUser();
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    await syncEngagementGameResets();
    const [player, isAdmin] = await Promise.all([ensureEngagementGamePlayer(user.id), isEngagementGameAdmin(user.id)]);
    const now = new Date();
    if (isWeekendDate(now)) {
      return NextResponse.json(
        {
          error: "Hoje nao ha rodada.",
          isWeekend: true,
          nextBusinessDayLabel: getNextBusinessDayLabel(now),
        },
        { status: 409 }
      );
    }
    const difficulty = getTodayDifficulty(now);
    if (!difficulty) {
      return NextResponse.json({ error: "Nivel do dia indisponivel." }, { status: 409 });
    }
    if (!isAdmin && !canPlayToday(player.last_played_date)) {
      return NextResponse.json({ error: "Voce ja jogou hoje." }, { status: 409 });
    }

    const { data: pendingSession, error: pendingError } = await supabaseAdmin
      .from("engagement_game_sessions")
      .select("id,challenge_seed,started_at,expires_at")
      .eq("user_id", user.id)
      .eq("session_state", "started")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; challenge_seed: string; started_at: string; expires_at: string }>();
    if (pendingError && pendingError.code !== "PGRST116") throw new Error(pendingError.message);

    if (pendingSession) {
      const notExpired = new Date(pendingSession.expires_at).getTime() > Date.now();
      if (notExpired) {
        return NextResponse.json({
          sessionId: pendingSession.id,
          rounds: buildDailyGameRounds(pendingSession.challenge_seed, difficulty),
          durationMs: difficulty.durationMs,
          difficulty,
        });
      }

      await supabaseAdmin
        .from("engagement_game_sessions")
        .update({ session_state: "expired" })
        .eq("id", pendingSession.id);
    }

    const seed = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("engagement_game_sessions")
      .insert({
        user_id: user.id,
        company_id: player.company_id,
        department_id: player.department_id,
        challenge_seed: seed,
        challenge_config: difficulty,
        expires_at: expiresAt,
      })
      .select("id")
      .single<{ id: string }>();

    if (sessionError) throw new Error(sessionError.message);

    return NextResponse.json({
      sessionId: session.id,
      rounds: buildDailyGameRounds(seed, difficulty),
      durationMs: difficulty.durationMs,
      difficulty,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar o desafio." },
      { status: 500 }
    );
  }
}
