import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  LmsBadge,
  LmsChallenge,
  LmsChallengeParticipant,
  LmsGameSession,
  LmsGamificationAdminData,
  LmsGamificationOverview,
  LmsLeaderboardRow,
  LmsRewardRule,
  LmsUserBadge,
  LmsUserStreak,
  LmsUserXp,
} from "@/lib/lms/types";

type LmsAccessContext = {
  userId: string;
  companyId: string | null;
  departmentId: string | null;
  role: string;
  email?: string | null;
};

type ProfileShape = {
  id: string;
  full_name: string | null;
  email?: string | null;
  company_id: string | null;
  department_id: string | null;
};

const DEFAULT_REWARD_RULES: Record<string, number> = {
  lesson_completed: 25,
  course_completed: 150,
  quiz_passed: 70,
  quiz_perfect: 30,
  certificate_issued: 40,
  streak_day: 15,
  challenge_completed: 120,
  battle_participation: 50,
};

function isMissingRelation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIsoDate() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

function seasonLabelFor(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function seasonKeyFor(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function xpNeededForLevel(level: number) {
  return 200 + Math.max(0, level - 1) * 150;
}

function computeLevel(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }
  return { level, nextLevelXp: xpNeededForLevel(level), currentLevelProgressXp: remaining };
}

async function loadRewardRules(companyId: string | null) {
  try {
    let query = supabaseAdmin.from("reward_rules").select("*").eq("is_active", true);
    if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    const { data, error } = await query;
    if (error) throw error;
    const rules = new Map<string, number>();
    for (const row of (data ?? []) as LmsRewardRule[]) rules.set(row.action_key, row.xp_reward);
    return rules;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return new Map<string, number>(Object.entries(DEFAULT_REWARD_RULES));
  }
}

async function ensureUserXp(context: LmsAccessContext) {
  const { data: existing, error } = await supabaseAdmin
    .from("user_xp")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle<LmsUserXp>();
  if (error && !isMissingRelation(error)) throw error;
  if (existing) return existing;

  const inserted = await supabaseAdmin
    .from("user_xp")
    .insert({
      user_id: context.userId,
      company_id: context.companyId,
      department_id: context.departmentId,
      total_xp: 0,
      level: 1,
      season_xp: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle<LmsUserXp>();

  if (inserted.error) throw inserted.error;
  return inserted.data!;
}

async function updateXpRow(current: LmsUserXp, amount: number) {
  const totalXp = Math.max(0, current.total_xp + amount);
  const seasonXp = Math.max(0, current.season_xp + amount);
  const level = computeLevel(totalXp).level;
  const { data, error } = await supabaseAdmin
    .from("user_xp")
    .update({
      total_xp: totalXp,
      season_xp: seasonXp,
      level,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .select("*")
    .maybeSingle<LmsUserXp>();
  if (error) throw error;
  return data!;
}

async function ensureUserStreak(context: LmsAccessContext) {
  const { data, error } = await supabaseAdmin
    .from("user_streaks")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle<LmsUserStreak>();
  if (error && !isMissingRelation(error)) throw error;
  if (data) return data;

  const inserted = await supabaseAdmin
    .from("user_streaks")
    .insert({
      user_id: context.userId,
      current_streak: 0,
      best_streak: 0,
      last_activity_on: null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .maybeSingle<LmsUserStreak>();
  if (inserted.error) throw inserted.error;
  return inserted.data!;
}

async function fetchProfilesMap(companyId: string | null) {
  let query = supabaseAdmin.from("profiles").select("id,full_name,email,company_id,department_id").eq("active", true);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw error;
  return new Map<string, ProfileShape>(((data ?? []) as ProfileShape[]).map((row) => [row.id, row]));
}

async function fetchDepartmentNames() {
  const { data, error } = await supabaseAdmin.from("departments").select("id,name");
  if (error && !isMissingRelation(error)) throw error;
  return new Map<string, string>(((data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
}

async function grantBadgeIfEligible(context: LmsAccessContext, slug: string) {
  const [{ data: badge }, { data: existing }] = await Promise.all([
    supabaseAdmin.from("badges").select("*").eq("slug", slug).eq("is_active", true).maybeSingle<LmsBadge>(),
    supabaseAdmin
      .from("user_badges")
      .select("id")
      .eq("user_id", context.userId)
      .eq("badge_id", (
        await supabaseAdmin.from("badges").select("id").eq("slug", slug).maybeSingle<{ id: string }>()
      ).data?.id ?? "")
      .maybeSingle<{ id: string }>(),
  ]);

  if (!badge || existing) return null;

  const { data, error } = await supabaseAdmin
    .from("user_badges")
    .insert({
      user_id: context.userId,
      badge_id: badge.id,
      awarded_at: new Date().toISOString(),
      season_key: seasonKeyFor(),
    })
    .select("*")
    .maybeSingle<LmsUserBadge>();
  if (error) throw error;

  if (badge.points_reward > 0) {
    const xp = await ensureUserXp(context);
    await updateXpRow(xp, badge.points_reward);
  }

  return data;
}

async function syncChallenges(context: LmsAccessContext) {
  try {
    let challengeQuery = supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("status", "active")
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString());
    if (context.companyId) challengeQuery = challengeQuery.or(`company_id.eq.${context.companyId},company_id.is.null`);
    const { data: challengeRows, error: challengesError } = await challengeQuery;
    if (challengesError) throw challengesError;

    if (!challengeRows?.length) return;

    const [progressRes, attemptsRes, streak] = await Promise.all([
      supabaseAdmin.from("lms_user_progress").select("status,completed_lessons,progress_percent").eq("user_id", context.userId),
      supabaseAdmin.from("lms_quiz_attempts").select("score,passed").eq("user_id", context.userId),
      ensureUserStreak(context),
    ]);

    const completedCourses = ((progressRes.data ?? []) as Array<{ status: string }>).filter((row) => row.status === "completed").length;
    const completedLessons = ((progressRes.data ?? []) as Array<{ completed_lessons: number }>).reduce((sum, row) => sum + (row.completed_lessons ?? 0), 0);
    const bestQuizScore = Math.max(0, ...(((attemptsRes.data ?? []) as Array<{ score: number | null }>).map((row) => row.score ?? 0)));

    for (const challenge of (challengeRows ?? []) as LmsChallenge[]) {
      let progressValue = 0;
      if (challenge.target_metric === "completed_lessons") progressValue = completedLessons;
      if (challenge.target_metric === "completed_courses") progressValue = completedCourses;
      if (challenge.target_metric === "best_quiz_score") progressValue = bestQuizScore;
      if (challenge.target_metric === "study_streak") progressValue = streak.current_streak;

      const completed = progressValue >= (challenge.target_value ?? 0);
      const { data: existing } = await supabaseAdmin
        .from("challenge_participants")
        .select("*")
        .eq("challenge_id", challenge.id)
        .eq("user_id", context.userId)
        .maybeSingle<LmsChallengeParticipant>();

      const wasCompleted = Boolean(existing?.completed);
      await supabaseAdmin.from("challenge_participants").upsert(
        {
          id: existing?.id,
          challenge_id: challenge.id,
          user_id: context.userId,
          progress_value: progressValue,
          completed,
          completed_at: completed ? existing?.completed_at ?? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "challenge_id,user_id" },
      );

      if (completed && !wasCompleted && challenge.xp_reward > 0) {
        const xp = await ensureUserXp(context);
        await updateXpRow(xp, challenge.xp_reward);
      }
    }
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
  }
}

export async function awardGamificationXp(context: LmsAccessContext, actionKey: string, amountOverride?: number) {
  try {
    const rewardRules = await loadRewardRules(context.companyId);
    const amount = amountOverride ?? rewardRules.get(actionKey) ?? DEFAULT_REWARD_RULES[actionKey] ?? 0;
    if (!amount) return null;
    const xp = await ensureUserXp(context);
    return await updateXpRow(xp, amount);
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return null;
  }
}

export async function registerStudyActivity(context: LmsAccessContext) {
  try {
    const streak = await ensureUserStreak(context);
    const today = todayIsoDate();
    if (streak.last_activity_on === today) return streak;

    const nextStreak = streak.last_activity_on === yesterdayIsoDate() ? streak.current_streak + 1 : 1;
    const bestStreak = Math.max(streak.best_streak, nextStreak);
    const { data, error } = await supabaseAdmin
      .from("user_streaks")
      .update({
        current_streak: nextStreak,
        best_streak: bestStreak,
        last_activity_on: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", streak.id)
      .select("*")
      .maybeSingle<LmsUserStreak>();
    if (error) throw error;

    await awardGamificationXp(context, "streak_day");
    await syncChallenges(context);

    if (bestStreak >= 3) await grantBadgeIfEligible(context, "ritmo-constante");
    if (bestStreak >= 7) await grantBadgeIfEligible(context, "maratonista");
    return data;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return null;
  }
}

export async function refreshGamificationState(context: LmsAccessContext) {
  try {
    const [xp, streak, progressRes, attemptsRes] = await Promise.all([
      ensureUserXp(context),
      ensureUserStreak(context),
      supabaseAdmin.from("lms_user_progress").select("status").eq("user_id", context.userId),
      supabaseAdmin.from("lms_quiz_attempts").select("score,passed").eq("user_id", context.userId),
    ]);

    const completedCourses = ((progressRes.data ?? []) as Array<{ status: string }>).filter((row) => row.status === "completed").length;
    const perfectQuiz = ((attemptsRes.data ?? []) as Array<{ score: number | null; passed: boolean }>).some(
      (row) => row.passed && (row.score ?? 0) >= 100,
    );

    if (xp.total_xp > 0) await grantBadgeIfEligible(context, "primeiro-xp");
    if (completedCourses >= 1) await grantBadgeIfEligible(context, "curso-concluido");
    if (completedCourses >= 5) await grantBadgeIfEligible(context, "colecionador-de-certificados");
    if (streak.current_streak >= 7) await grantBadgeIfEligible(context, "maratonista");
    if (perfectQuiz) await grantBadgeIfEligible(context, "quiz-perfect");
    if (xp.level >= 5) await grantBadgeIfEligible(context, "lenda-do-aprendizado");

    await syncChallenges(context);
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
  }
}

export async function getLearnerGamificationOverview(context: LmsAccessContext): Promise<LmsGamificationOverview> {
  try {
    const [xp, streak, badgesRes, challengesRes, participantsRes, sessionsRes, departmentNames, profilesMap] = await Promise.all([
      ensureUserXp(context),
      ensureUserStreak(context),
      supabaseAdmin
        .from("user_badges")
        .select("id,user_id,badge_id,awarded_at,season_key,badge:badges(*)")
        .eq("user_id", context.userId)
        .order("awarded_at", { ascending: false }),
      context.companyId
        ? supabaseAdmin
            .from("challenges")
            .select("*")
            .eq("status", "active")
            .or(`company_id.eq.${context.companyId},company_id.is.null`)
            .order("ends_at", { ascending: true })
        : supabaseAdmin.from("challenges").select("*").eq("status", "active").order("ends_at", { ascending: true }),
      supabaseAdmin.from("challenge_participants").select("*").eq("user_id", context.userId),
      context.companyId
        ? supabaseAdmin
            .from("game_sessions")
            .select("*")
            .eq("status", "live")
            .or(`company_id.eq.${context.companyId},company_id.is.null`)
            .order("created_at", { ascending: false })
            .limit(4)
        : supabaseAdmin.from("game_sessions").select("*").eq("status", "live").order("created_at", { ascending: false }).limit(4),
      fetchDepartmentNames(),
      fetchProfilesMap(context.companyId),
    ]);

    const leaderboard = await getLeaderboardForCompany(context.companyId, context.departmentId);
    const participantByChallenge = new Map<string, LmsChallengeParticipant>(((participantsRes.data ?? []) as LmsChallengeParticipant[]).map((row) => [row.challenge_id, row]));
    const badges = ((badgesRes.data ?? []) as Array<{
      id: string;
      user_id: string;
      badge_id: string;
      awarded_at: string;
      season_key: string | null;
      badge: LmsBadge | LmsBadge[] | null;
    }>).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      badge_id: row.badge_id,
      awarded_at: row.awarded_at,
      season_key: row.season_key,
      badge: Array.isArray(row.badge) ? row.badge[0] ?? null : row.badge,
    }));
    const nextLevelXp = computeLevel(xp.total_xp).nextLevelXp;

    return {
      xp,
      streak,
      badges,
      activeChallenges: ((challengesRes.data ?? []) as LmsChallenge[]).map((challenge) => ({
        ...challenge,
        participant: participantByChallenge.get(challenge.id) ?? null,
      })),
      leaderboard: leaderboard.map((row) => ({
        ...row,
        department_name: row.department_name ? departmentNames.get(row.department_name) ?? row.department_name : row.department_name,
        full_name: profilesMap.get(row.user_id)?.full_name ?? row.full_name,
      })),
      battles: (sessionsRes.data ?? []) as LmsGameSession[],
      seasonLabel: seasonLabelFor(),
      nextLevelXp,
    };
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return {
      xp: null,
      streak: null,
      badges: [],
      activeChallenges: [],
      leaderboard: [],
      battles: [],
      seasonLabel: seasonLabelFor(),
      nextLevelXp: xpNeededForLevel(1),
    };
  }
}

export async function getLeaderboardForCompany(companyId: string | null, departmentId?: string | null, limit = 10): Promise<LmsLeaderboardRow[]> {
  try {
    let xpQuery = supabaseAdmin.from("user_xp").select("*").order("total_xp", { ascending: false }).limit(limit);
    if (companyId) xpQuery = xpQuery.eq("company_id", companyId);
    if (departmentId) xpQuery = xpQuery.eq("department_id", departmentId);
    const [{ data: xpRows, error }, profilesMap, departmentNames, badgesRes, streaksRes] = await Promise.all([
      xpQuery,
      fetchProfilesMap(companyId),
      fetchDepartmentNames(),
      supabaseAdmin.from("user_badges").select("user_id"),
      supabaseAdmin.from("user_streaks").select("user_id,current_streak"),
    ]);
    if (error) throw error;

    const badgeCount = new Map<string, number>();
    for (const row of (badgesRes.data ?? []) as Array<{ user_id: string }>) {
      badgeCount.set(row.user_id, (badgeCount.get(row.user_id) ?? 0) + 1);
    }

    const streakCount = new Map<string, number>();
    for (const row of (streaksRes.data ?? []) as Array<{ user_id: string; current_streak: number }>) {
      streakCount.set(row.user_id, row.current_streak ?? 0);
    }

    return ((xpRows ?? []) as LmsUserXp[]).map((row, index) => {
      const profile = profilesMap.get(row.user_id);
      return {
        user_id: row.user_id,
        full_name: profile?.full_name?.trim() || profile?.email || "Colaborador",
        department_name: row.department_id ? departmentNames.get(row.department_id) ?? row.department_id : null,
        rank: index + 1,
        xp: row.total_xp,
        level: row.level,
        badges: badgeCount.get(row.user_id) ?? 0,
        streak: streakCount.get(row.user_id) ?? 0,
      };
    });
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return [];
  }
}

export async function getAdminGamificationDashboard(companyId: string | null): Promise<LmsGamificationAdminData> {
  try {
    let xpQuery = supabaseAdmin.from("user_xp").select("*");
    if (companyId) xpQuery = xpQuery.eq("company_id", companyId);

    const [xpRes, streaksRes, badgeRes, leaderboard, profilesMap, departmentNames, challengesRes] = await Promise.all([
      xpQuery,
      supabaseAdmin.from("user_streaks").select("*"),
      supabaseAdmin
        .from("user_badges")
        .select("id,user_id,badge:badges(title)")
        .order("awarded_at", { ascending: false }),
      getLeaderboardForCompany(companyId, null, 8),
      fetchProfilesMap(companyId),
      fetchDepartmentNames(),
      companyId
        ? supabaseAdmin.from("challenges").select("id").eq("status", "active").or(`company_id.eq.${companyId},company_id.is.null`)
        : supabaseAdmin.from("challenges").select("id").eq("status", "active"),
    ]);

    const xpRows = (xpRes.data ?? []) as LmsUserXp[];
    const streakRows = (streaksRes.data ?? []) as LmsUserStreak[];
    const badgeRows = (badgeRes.data ?? []) as Array<{ badge?: { title?: string | null } | null }>;

    const topDepartmentsMap = new Map<string, { xp: number; learners: number }>();
    for (const row of xpRows) {
      if (!row.department_id) continue;
      const current = topDepartmentsMap.get(row.department_id) ?? { xp: 0, learners: 0 };
      current.xp += row.total_xp;
      current.learners += 1;
      topDepartmentsMap.set(row.department_id, current);
    }

    const topDepartments = Array.from(topDepartmentsMap.entries())
      .map(([departmentId, entry]) => ({
        departmentName: departmentNames.get(departmentId) ?? departmentId,
        xp: entry.xp,
        completionRate: entry.learners ? Math.round(entry.xp / entry.learners) : 0,
      }))
      .sort((left, right) => right.xp - left.xp)
      .slice(0, 5);

    const topBadgesMap = new Map<string, number>();
    for (const row of badgeRows) {
      const title = row.badge?.title?.trim();
      if (!title) continue;
      topBadgesMap.set(title, (topBadgesMap.get(title) ?? 0) + 1);
    }

    const activeLearners = new Set(xpRows.filter((row) => row.total_xp > 0).map((row) => row.user_id)).size;
    const totalXpDistributed = xpRows.reduce((sum, row) => sum + row.total_xp, 0);
    const averageStreak = streakRows.length ? Math.round((streakRows.reduce((sum, row) => sum + row.current_streak, 0) / streakRows.length) * 10) / 10 : 0;

    return {
      totalXpDistributed,
      activeLearners,
      activeChallenges: (challengesRes.data ?? []).length,
      averageStreak,
      topDepartments,
      topBadges: Array.from(topBadgesMap.entries())
        .map(([title, total]) => ({ title, total }))
        .sort((left, right) => right.total - left.total)
        .slice(0, 5),
      seasonLabel: seasonLabelFor(),
      leaderboard: leaderboard.map((row) => ({
        ...row,
        full_name: profilesMap.get(row.user_id)?.full_name ?? row.full_name,
      })),
    };
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return {
      totalXpDistributed: 0,
      activeLearners: 0,
      activeChallenges: 0,
      averageStreak: 0,
      topDepartments: [],
      topBadges: [],
      seasonLabel: seasonLabelFor(),
      leaderboard: [],
    };
  }
}
