import { NextResponse } from "next/server";
import { buildDailyMotivationMessage } from "@/lib/engagementGame";
import {
  canPlayToday,
  ensureEngagementGamePlayer,
  getAuthenticatedPortalUser,
  getLocalFortalezaDate,
  getNextBusinessDayLabel,
  getTodayDifficulty,
  getUserStreak,
  isWeekendDate,
  isEngagementGameAdmin,
  loadEngagementGameLeaderboard,
  loadEngagementGamePlayerOfDay,
  loadEngagementGameRankPosition,
  syncEngagementGameResets,
} from "@/lib/server/engagementGameServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const user = await getAuthenticatedPortalUser();
    if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

    await syncEngagementGameResets();
    const [player, isAdmin] = await Promise.all([ensureEngagementGamePlayer(user.id), isEngagementGameAdmin(user.id)]);
    const [leaderboard, rankPosition, playerOfDay, recentHistoryRes] = await Promise.all([
      loadEngagementGameLeaderboard(player.company_id, user.id),
      loadEngagementGameRankPosition(player.company_id, user.id),
      loadEngagementGamePlayerOfDay(player.company_id),
      supabaseAdmin
        .from("engagement_game_score_history")
        .select("event_type,points_delta,score_current_after,streak_after,event_date,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(7),
    ]);

    if (recentHistoryRes.error) throw new Error(recentHistoryRes.error.message);

    const now = new Date();
    const today = getLocalFortalezaDate(now);
    const weekend = isWeekendDate(now);
    const difficulty = getTodayDifficulty(now);
    const playedToday = player.last_played_date === today;
    const effectiveStreak = getUserStreak(player.last_played_date, player.streak, now);
    const playable = weekend ? false : isAdmin ? true : canPlayToday(player.last_played_date);
    const message = buildDailyMotivationMessage(effectiveStreak, playable, player.score_current, {
      weekend,
      difficultyLabel: difficulty?.label ?? null,
      nextBusinessDayLabel: weekend ? getNextBusinessDayLabel(now) : null,
    });

    return NextResponse.json({
      game: {
        slug: "pulse-sprint",
        title: "Pulse Sprint",
        summary: weekend
          ? "Nos finais de semana o desafio faz uma pausa e retorna no proximo dia util."
          : `Toque os pulsos de energia na grade antes que eles sumam. Nivel de hoje: ${difficulty?.label ?? "Medio"}.`,
        durationMs: difficulty?.durationMs ?? 0,
        difficulty: difficulty
          ? {
              key: difficulty.key,
              label: difficulty.label,
              summary: difficulty.summary,
              targetScale: difficulty.targetScale,
              rounds: difficulty.rounds,
            }
          : null,
        isWeekend: weekend,
        nextBusinessDayLabel: weekend ? getNextBusinessDayLabel(now) : null,
      },
      player: {
        userId: player.user_id,
        displayName: player.display_name,
        departmentName: player.department_name,
        scoreCurrent: player.score_current,
        scoreTotal: player.score_total,
        streak: effectiveStreak,
        lastPlayedDate: player.last_played_date,
        canPlayToday: playable,
        playedToday,
        isAdmin,
        rankPosition,
      },
      leaderboard,
      playerOfDay,
      recentHistory: recentHistoryRes.data ?? [],
      message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar status do jogo." },
      { status: 500 }
    );
  }
}
