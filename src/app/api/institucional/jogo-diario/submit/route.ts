import { NextResponse } from "next/server";
import {
  DAILY_GAME_CONFIG,
  buildDailyGameRounds,
  buildDailyShareText,
  scoreDailyGameSession,
  type DailyGameHit,
} from "@/lib/engagementGame";
import {
  canPlayToday,
  ensureEngagementGamePlayer,
  getAuthenticatedPortalUser,
  getLocalFortalezaDate,
  isEngagementGameAdmin,
  loadEngagementGameLeaderboard,
  loadEngagementGameRankPosition,
  syncEngagementGameResets,
} from "@/lib/server/engagementGameServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SubmitBody = {
  sessionId?: string;
  hits?: Array<{ roundIndex?: number; hitAtMs?: number }>;
};

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedPortalUser();
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    const body = (await req.json().catch(() => null)) as SubmitBody | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) return NextResponse.json({ error: "Sessao invalida." }, { status: 400 });

    await syncEngagementGameResets();
    const [player, isAdmin] = await Promise.all([ensureEngagementGamePlayer(user.id), isEngagementGameAdmin(user.id)]);
    if (!isAdmin && !canPlayToday(player.last_played_date)) {
      return NextResponse.json({ error: "Voce ja concluiu a rodada de hoje." }, { status: 409 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("engagement_game_sessions")
      .select("id,user_id,challenge_seed,session_state,expires_at,started_at")
      .eq("id", sessionId)
      .maybeSingle<{
        id: string;
        user_id: string;
        challenge_seed: string;
        session_state: "started" | "completed" | "expired" | "cancelled";
        expires_at: string;
        started_at: string;
      }>();
    if (sessionError) throw new Error(sessionError.message);
    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
    }
    if (session.session_state !== "started") {
      return NextResponse.json({ error: "Sessao ja encerrada." }, { status: 409 });
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin.from("engagement_game_sessions").update({ session_state: "expired" }).eq("id", session.id);
      return NextResponse.json({ error: "Sessao expirada." }, { status: 409 });
    }

    const rawHits = Array.isArray(body?.hits) ? body?.hits : [];
    const hits: DailyGameHit[] = rawHits
      .map((item) => ({
        roundIndex: Number(item?.roundIndex),
        hitAtMs: Number(item?.hitAtMs),
      }))
      .filter((item) => Number.isInteger(item.roundIndex) && Number.isFinite(item.hitAtMs));

    const rounds = buildDailyGameRounds(session.challenge_seed);
    const localToday = getLocalFortalezaDate();
    const playedToday = player.last_played_date === localToday;
    const replayBaseStreak = isAdmin && playedToday ? Math.max(0, player.streak - 1) : player.streak;
    const breakdown = scoreDailyGameSession(rounds, hits, replayBaseStreak);

    let replacedSession:
      | {
          id: string;
          total_points_awarded: number;
        }
      | null = null;

    if (isAdmin && playedToday) {
      const { data: previousCompleted, error: previousCompletedError } = await supabaseAdmin
        .from("engagement_game_sessions")
        .select("id,total_points_awarded")
        .eq("user_id", user.id)
        .eq("play_date", localToday)
        .eq("session_state", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; total_points_awarded: number }>();
      if (previousCompletedError && previousCompletedError.code !== "PGRST116") throw new Error(previousCompletedError.message);
      replacedSession = previousCompleted ?? null;
    }

    const replacedPoints = Number(replacedSession?.total_points_awarded ?? 0);
    const baseCurrentScore = Math.max(0, player.score_current - replacedPoints);
    const baseTotalScore = Math.max(0, player.score_total - replacedPoints);
    const nextCurrentScore = baseCurrentScore + breakdown.totalPoints;
    const nextTotalScore = baseTotalScore + breakdown.totalPoints;
    const completedAt = new Date().toISOString();

    if (replacedSession) {
      const { error: previousSessionCancelError } = await supabaseAdmin
        .from("engagement_game_sessions")
        .update({ session_state: "cancelled" })
        .eq("id", replacedSession.id)
        .eq("session_state", "completed");
      if (previousSessionCancelError) throw new Error(previousSessionCancelError.message);
    }

    const { error: sessionUpdateError } = await supabaseAdmin
      .from("engagement_game_sessions")
      .update({
        session_state: "completed",
        completed_at: completedAt,
        hit_count: breakdown.validHits,
        miss_count: breakdown.misses,
        accuracy: breakdown.accuracy,
        avg_reaction_ms: breakdown.avgReactionMs,
        combo_best: breakdown.comboBest,
        base_points: breakdown.basePoints,
        performance_points: breakdown.performancePoints,
        streak_bonus: breakdown.streakBonus,
        total_points_awarded: breakdown.totalPoints,
        result_json: {
          rounds,
          hits,
          scoring: breakdown,
        },
      })
      .eq("id", session.id)
      .eq("session_state", "started");
    if (sessionUpdateError) throw new Error(sessionUpdateError.message);

    const nextSessionsPlayed = replacedSession ? player.sessions_played : player.sessions_played + 1;

    const { error: playerUpdateError } = await supabaseAdmin
      .from("engagement_game_players")
      .update({
        score_current: nextCurrentScore,
        score_total: nextTotalScore,
        sessions_played: nextSessionsPlayed,
        streak: breakdown.nextStreak,
        best_session_score: Math.max(player.best_session_score, breakdown.totalPoints),
        last_played_date: localToday,
        last_session_id: session.id,
        reset_status: "played_today",
      })
      .eq("user_id", user.id);
    if (playerUpdateError) throw new Error(playerUpdateError.message);

    if (replacedSession) {
      const { error: adjustmentError } = await supabaseAdmin.from("engagement_game_score_history").insert({
        user_id: user.id,
        company_id: player.company_id,
        session_id: replacedSession.id,
        event_type: "manual_adjustment",
        points_delta: -replacedPoints,
        score_current_after: baseCurrentScore,
        score_total_after: baseTotalScore,
        streak_after: replayBaseStreak,
        event_date: localToday,
        meta: {
          reason: "admin_replay_replace",
          replaced_session_id: replacedSession.id,
          replacement_session_id: session.id,
        },
      });
      if (adjustmentError) throw new Error(adjustmentError.message);
    }

    const { error: historyError } = await supabaseAdmin.from("engagement_game_score_history").insert({
      user_id: user.id,
      company_id: player.company_id,
      session_id: session.id,
      event_type: "play_awarded",
      points_delta: breakdown.totalPoints,
      score_current_after: nextCurrentScore,
      score_total_after: nextTotalScore,
      streak_after: breakdown.nextStreak,
      meta: {
        valid_hits: breakdown.validHits,
        misses: breakdown.misses,
        accuracy: breakdown.accuracy,
        avg_reaction_ms: breakdown.avgReactionMs,
        combo_best: breakdown.comboBest,
        replay_replaced_session_id: replacedSession?.id ?? null,
        replay_replaced_points: replacedPoints || 0,
      },
    });
    if (historyError) throw new Error(historyError.message);

    const [leaderboard, rankPosition] = await Promise.all([
      loadEngagementGameLeaderboard(player.company_id, user.id),
      loadEngagementGameRankPosition(player.company_id, user.id),
    ]);

    return NextResponse.json({
      ok: true,
      result: {
        totalPoints: breakdown.totalPoints,
        basePoints: breakdown.basePoints,
        performancePoints: breakdown.performancePoints,
        streakBonus: breakdown.streakBonus,
        validHits: breakdown.validHits,
        misses: breakdown.misses,
        accuracy: breakdown.accuracy,
        avgReactionMs: breakdown.avgReactionMs,
        comboBest: breakdown.comboBest,
        nextStreak: breakdown.nextStreak,
        scoreCurrent: nextCurrentScore,
        scoreTotal: nextTotalScore,
        rankPosition,
        shareText: buildDailyShareText({
          totalPoints: breakdown.totalPoints,
          streak: breakdown.nextStreak,
          displayName: player.display_name,
        }),
      },
      leaderboard,
      config: DAILY_GAME_CONFIG,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao concluir o desafio." },
      { status: 500 }
    );
  }
}
