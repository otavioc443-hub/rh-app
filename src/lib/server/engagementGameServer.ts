import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DailyGameLeaderboardEntry, DailyGamePlayerOfDay } from "@/lib/engagementGame";

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

type GamePlayerRow = {
  user_id: string;
  company_id: string | null;
  department_id: string | null;
  display_name: string;
  department_name: string | null;
  score_current: number;
  score_total: number;
  sessions_played: number;
  streak: number;
  best_session_score: number;
  last_played_date: string | null;
  reset_status: "ready" | "played_today" | "reset_after_miss";
};

type PortalProfileRow = {
  role: string | null;
};

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  department_name: string | null;
  score_current: number;
  score_total: number;
  streak: number;
  rank_position: number;
};

export async function getAuthenticatedPortalUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const supabaseServer = createServerClient(
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

  const { data } = await supabaseServer.auth.getUser();
  if (!data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function syncEngagementGameResets() {
  await supabaseAdmin.rpc("engagement_game_sync_all_resets");
}

export function getLocalFortalezaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function loadPortalRole(userId: string) {
  const { data, error } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle<PortalProfileRow>();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return (data?.role ?? "").trim().toLowerCase() || null;
}

export async function isEngagementGameAdmin(userId: string) {
  return (await loadPortalRole(userId)) === "admin";
}

export async function ensureEngagementGamePlayer(userId: string) {
  const [{ data: profile, error: profileError }, { data: collaborator, error: collaboratorError }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,full_name,email,company_id,department_id")
        .eq("id", userId)
        .maybeSingle<{
          id: string;
          full_name: string | null;
          email: string | null;
          company_id: string | null;
          department_id: string | null;
        }>(),
      supabaseAdmin
        .from("colaboradores")
        .select("user_id,nome,departamento,setor")
        .eq("user_id", userId)
        .maybeSingle<{
          user_id: string | null;
          nome: string | null;
          departamento: string | null;
          setor: string | null;
        }>(),
    ]);

  if (profileError) throw new Error(profileError.message);
  if (collaboratorError && collaboratorError.code !== "PGRST116") throw new Error(collaboratorError.message);

  let departmentName: string | null = null;
  if (profile?.department_id) {
    const { data: department, error: departmentError } = await supabaseAdmin
      .from("departments")
      .select("id,name")
      .eq("id", profile.department_id)
      .maybeSingle<{ id: string; name: string | null }>();
    if (departmentError && departmentError.code !== "PGRST116") throw new Error(departmentError.message);
    departmentName = (department?.name ?? "").trim() || null;
  }

  const displayName =
    (collaborator?.nome ?? "").trim() ||
    (profile?.full_name ?? "").trim() ||
    (profile?.email ?? "").trim() ||
    "Colaborador";

  if (!departmentName) {
    departmentName =
      (collaborator?.setor ?? "").trim() ||
      (collaborator?.departamento ?? "").trim() ||
      null;
  }

  const payload = {
    user_id: userId,
    company_id: profile?.company_id ?? null,
    department_id: profile?.department_id ?? null,
    display_name: displayName,
    department_name: departmentName,
  };

  const { error } = await supabaseAdmin.from("engagement_game_players").upsert(payload, {
    onConflict: "user_id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);

  const { data: player, error: playerError } = await supabaseAdmin
    .from("engagement_game_players")
    .select(
      "user_id,company_id,department_id,display_name,department_name,score_current,score_total,sessions_played,streak,best_session_score,last_played_date,reset_status"
    )
    .eq("user_id", userId)
    .maybeSingle<GamePlayerRow>();
  if (playerError) throw new Error(playerError.message);
  if (!player) throw new Error("Jogador nao encontrado.");
  return player;
}

export async function loadEngagementGameLeaderboard(companyId: string | null, currentUserId?: string) {
  if (!companyId) return [] as DailyGameLeaderboardEntry[];
  const { data, error } = await supabaseAdmin
    .from("engagement_game_leaderboard")
    .select("user_id,display_name,department_name,score_current,score_total,streak,rank_position")
    .eq("company_id", companyId)
    .order("rank_position", { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LeaderboardRow[]).map((item) => ({
    userId: item.user_id,
    displayName: item.display_name,
    departmentName: item.department_name,
    scoreCurrent: Number(item.score_current || 0),
    scoreTotal: Number(item.score_total || 0),
    streak: Number(item.streak || 0),
    rankPosition: Number(item.rank_position || 0),
    isCurrentUser: item.user_id === currentUserId,
  }));
}

export async function loadEngagementGameRankPosition(companyId: string | null, userId: string) {
  if (!companyId) return null;
  const { data, error } = await supabaseAdmin
    .from("engagement_game_leaderboard")
    .select("rank_position")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle<{ rank_position: number }>();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data?.rank_position ?? null;
}

export async function loadEngagementGamePlayerOfDay(companyId: string | null) {
  if (!companyId) return null;
  const localToday = getLocalFortalezaDate();

  const { data, error } = await supabaseAdmin
    .from("engagement_game_sessions")
    .select("user_id,total_points_awarded")
    .eq("company_id", companyId)
    .eq("play_date", localToday)
    .eq("session_state", "completed")
    .order("total_points_awarded", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = (data?.[0] ?? null) as
    | {
        user_id: string;
        total_points_awarded: number;
      }
    | null;

  if (!row) return null;
  const { data: player, error: playerError } = await supabaseAdmin
    .from("engagement_game_players")
    .select("display_name,department_name")
    .eq("user_id", row.user_id)
    .maybeSingle<{ display_name: string | null; department_name: string | null }>();
  if (playerError && playerError.code !== "PGRST116") throw new Error(playerError.message);
  return {
    userId: row.user_id,
    displayName: player?.display_name ?? "Colaborador",
    departmentName: player?.department_name ?? null,
    totalPointsAwarded: Number(row.total_points_awarded || 0),
  } satisfies DailyGamePlayerOfDay;
}

export function canPlayToday(lastPlayedDate: string | null) {
  if (!lastPlayedDate) return true;
  const today = getLocalFortalezaDate();
  return lastPlayedDate !== today;
}
