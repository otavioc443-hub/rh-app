import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getBusinessDaysBetween,
  getDailyDifficulty,
  getNextBusinessDay,
  isBusinessDay,
  type DailyGameLeaderboardEntry,
  type DailyGameDepartmentRankingEntry,
  type DailyGamePlayerOfDay,
} from "@/lib/engagementGame";

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

type LeaderboardCollaboratorRow = {
  user_id: string | null;
  nome: string | null;
  cargo: string | null;
  departamento?: string | null;
  setor?: string | null;
};

type DepartmentRankingPlayerRow = {
  user_id: string;
  display_name?: string | null;
  department_id?: string | null;
  department_name: string | null;
  score_current: number;
  score_total: number;
  streak?: number;
  last_played_date?: string | null;
  updated_at?: string | null;
};

type EngagementGameCompanyProfileRow = {
  id: string;
  full_name: string | null;
  company_id: string | null;
  department_id: string | null;
};

type EngagementGameDepartmentRow = {
  id: string;
  name: string | null;
};

function normalizeDepartmentName(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim() || null;
}

function resolveCurrentDepartmentName({
  collaborator,
  profile,
  playerDepartmentName,
  departmentById,
}: {
  collaborator?: Pick<LeaderboardCollaboratorRow, "setor" | "departamento"> | null;
  profile?: Pick<EngagementGameCompanyProfileRow, "department_id"> | null;
  playerDepartmentName?: string | null;
  departmentById?: Map<string, string>;
}) {
  return (
    normalizeDepartmentName(collaborator?.setor) ||
    normalizeDepartmentName(collaborator?.departamento) ||
    (profile?.department_id ? normalizeDepartmentName(departmentById?.get(profile.department_id)) : null) ||
    normalizeDepartmentName(playerDepartmentName) ||
    "Setor não informado"
  );
}

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

export function parseLocalDate(value: string) {
  return new Date(`${value}T12:00:00-03:00`);
}

export function isWeekendDate(date: Date) {
  return !isBusinessDay(date);
}

export function getTodayDifficulty(date = new Date()) {
  return getDailyDifficulty(date);
}

export function getNextBusinessDayLabel(date = new Date()) {
  const next = getNextBusinessDay(date);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Fortaleza",
  }).format(next);
}

export function getUserStreak(lastPlayedDate: string | null, storedStreak: number, today = new Date()) {
  if (!lastPlayedDate || storedStreak <= 0) return 0;
  const lastDate = parseLocalDate(lastPlayedDate);
  const gap = getBusinessDaysBetween(lastDate, today);
  if (gap <= 0) return storedStreak;
  if (gap === 1) return storedStreak;
  return 0;
}

export function shouldResetForMissedBusinessDay(lastPlayedDate: string | null, today = new Date()) {
  if (!lastPlayedDate) return false;
  return getBusinessDaysBetween(parseLocalDate(lastPlayedDate), today) > 1;
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

  let departmentName =
    normalizeDepartmentName(collaborator?.setor) ||
    normalizeDepartmentName(collaborator?.departamento);

  if (!departmentName && profile?.department_id) {
    const { data: department, error: departmentError } = await supabaseAdmin
      .from("departments")
      .select("id,name")
      .eq("id", profile.department_id)
      .maybeSingle<{ id: string; name: string | null }>();
    if (departmentError && departmentError.code !== "PGRST116") throw new Error(departmentError.message);
    departmentName = normalizeDepartmentName(department?.name);
  }

  const displayName =
    (collaborator?.nome ?? "").trim() ||
    (profile?.full_name ?? "").trim() ||
    (profile?.email ?? "").trim() ||
    "Colaborador";

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
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,company_id,department_id")
    .eq("company_id", companyId)
    .eq("active", true);
  if (profilesError) throw new Error(profilesError.message);

  const profiles = (profilesData ?? []) as EngagementGameCompanyProfileRow[];
  const companyUserIds = profiles.map((profile) => profile.id).filter(Boolean);
  if (!companyUserIds.length) return [] as DailyGameLeaderboardEntry[];

  const { data, error } = await supabaseAdmin
    .from("engagement_game_players")
    .select("user_id,display_name,department_name,score_current,score_total,streak,last_played_date,updated_at")
    .in("user_id", companyUserIds)
    .gt("score_current", 0)
    .order("score_current", { ascending: false })
    .order("streak", { ascending: false })
    .order("last_played_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as DepartmentRankingPlayerRow[]).map((item, index) => ({
    user_id: item.user_id,
    display_name: item.display_name ?? "Colaborador",
    department_name: item.department_name,
    score_current: item.score_current,
    score_total: item.score_total,
    streak: item.streak ?? 0,
    last_played_date: item.last_played_date ?? null,
    updated_at: item.updated_at ?? null,
    rank_position: index + 1,
  }));
  const userIds = rows.map((item) => item.user_id).filter(Boolean);
  const departmentIds = Array.from(new Set(profiles.map((profile) => profile.department_id).filter(Boolean))) as string[];
  const [collaboratorsRes, departmentsRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("colaboradores").select("user_id,nome,cargo,departamento,setor").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    departmentIds.length
      ? supabaseAdmin.from("departments").select("id,name").in("id", departmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (collaboratorsRes.error) throw new Error(collaboratorsRes.error.message);
  if (departmentsRes.error) throw new Error(departmentsRes.error.message);
  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile] as const));
  const departmentById = new Map(
    ((departmentsRes.data ?? []) as EngagementGameDepartmentRow[])
      .filter((item) => item.id)
      .map((item) => [item.id, normalizeDepartmentName(item.name) ?? "Setor não informado"] as const)
  );
  const collaboratorByUserId = new Map(
    ((collaboratorsRes.data ?? []) as LeaderboardCollaboratorRow[])
      .filter((item) => item.user_id)
      .map((item) => [item.user_id as string, item] as const)
  );
  return rows.map((item) => {
    const collaborator = collaboratorByUserId.get(item.user_id);
    const profile = profileByUserId.get(item.user_id);
    return {
      userId: item.user_id,
      displayName: (collaborator?.nome ?? "").trim() || item.display_name,
      departmentName: resolveCurrentDepartmentName({
        collaborator,
        profile,
        playerDepartmentName: item.department_name,
        departmentById,
      }),
      roleName: (collaborator?.cargo ?? "").trim() || null,
      scoreCurrent: Number(item.score_current || 0),
      scoreTotal: Number(item.score_total || 0),
      streak: Number(item.streak || 0),
      rankPosition: Number(item.rank_position || 0),
      isCurrentUser: item.user_id === currentUserId,
    };
  });
}

export async function loadEngagementGameDepartmentRanking(
  companyId: string | null,
  currentDepartmentName?: string | null
) {
  if (!companyId) return [] as DailyGameDepartmentRankingEntry[];
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,company_id,department_id")
    .eq("company_id", companyId)
    .eq("active", true);
  if (profilesError) throw new Error(profilesError.message);

  const profiles = (profilesData ?? []) as EngagementGameCompanyProfileRow[];
  const companyUserIds = profiles.map((profile) => profile.id).filter(Boolean);
  if (!companyUserIds.length) return [] as DailyGameDepartmentRankingEntry[];

  const { data, error } = await supabaseAdmin
    .from("engagement_game_players")
    .select("user_id,department_id,department_name,score_current,score_total")
    .in("user_id", companyUserIds)
    .gt("score_current", 0);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DepartmentRankingPlayerRow[];
  const userIds = rows.map((item) => item.user_id).filter(Boolean);
  const departmentIds = Array.from(new Set(profiles.map((profile) => profile.department_id).filter(Boolean))) as string[];
  const [collaboratorsRes, departmentsRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("colaboradores").select("user_id,departamento,setor").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    departmentIds.length
      ? supabaseAdmin.from("departments").select("id,name").in("id", departmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (collaboratorsRes.error) throw new Error(collaboratorsRes.error.message);
  if (departmentsRes.error) throw new Error(departmentsRes.error.message);

  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile] as const));
  const collaboratorByUserId = new Map(
    ((collaboratorsRes.data ?? []) as LeaderboardCollaboratorRow[])
      .filter((item) => item.user_id)
      .map((item) => [item.user_id as string, item] as const)
  );
  const departmentById = new Map(
    ((departmentsRes.data ?? []) as EngagementGameDepartmentRow[])
      .filter((item) => item.id)
      .map((item) => [item.id, normalizeDepartmentName(item.name) ?? "Setor não informado"] as const)
  );

  const grouped = new Map<string, { scoreCurrent: number; scoreTotal: number; playerCount: number }>();
  for (const item of rows) {
    const departmentName = resolveCurrentDepartmentName({
      collaborator: collaboratorByUserId.get(item.user_id),
      profile: profileByUserId.get(item.user_id),
      playerDepartmentName: item.department_name,
      departmentById,
    });
    const current = grouped.get(departmentName) ?? { scoreCurrent: 0, scoreTotal: 0, playerCount: 0 };
    current.scoreCurrent += Number(item.score_current || 0);
    current.scoreTotal += Number(item.score_total || 0);
    current.playerCount += 1;
    grouped.set(departmentName, current);
  }

  const currentDepartmentKey = normalizeDepartmentName(currentDepartmentName) || "Setor não informado";
  return Array.from(grouped.entries())
    .filter(([, stats]) => stats.scoreCurrent > 0)
    .map(([departmentName, stats]) => ({
      departmentName,
      scoreCurrent: stats.scoreCurrent,
      scoreTotal: stats.scoreTotal,
      playerCount: stats.playerCount,
      averageScore: stats.playerCount > 0 ? Math.round(stats.scoreCurrent / stats.playerCount) : 0,
      rankPosition: 0,
      isCurrentUserDepartment: departmentName === currentDepartmentKey,
    }))
    .sort((a, b) => b.scoreCurrent - a.scoreCurrent || b.averageScore - a.averageScore || a.departmentName.localeCompare(b.departmentName))
    .map((item, index) => ({ ...item, rankPosition: index + 1 }))
    .slice(0, 8);
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
  const currentDate = new Date();
  if (!isBusinessDay(currentDate)) return false;
  if (!lastPlayedDate) return true;
  return lastPlayedDate !== getLocalFortalezaDate(currentDate);
}

export function normalizeEngagementGameSlug(value: string | null | undefined) {
  return value === "trilha-pulse" ? "trilha-pulse" : "pulse-sprint";
}

export function getEngagementGameTitle(gameSlug: string) {
  return gameSlug === "trilha-pulse" ? "Trilha Pulse" : "Pulse Sprint";
}

export async function hasCompletedEngagementGameToday(userId: string, gameSlug: string, today = getLocalFortalezaDate()) {
  const { data, error } = await supabaseAdmin
    .from("engagement_game_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("game_slug", normalizeEngagementGameSlug(gameSlug))
    .eq("play_date", today)
    .eq("session_state", "completed")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}
