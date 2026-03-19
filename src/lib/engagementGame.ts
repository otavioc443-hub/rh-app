export const DAILY_GAME_SLUG = "pulse-sprint";
export const DAILY_GAME_TITLE = "Pulse Sprint";

export const DAILY_GAME_CONFIG = {
  durationMs: 36_000,
  rounds: 24,
  gridSize: 9,
  roundSpacingMs: 1_350,
  visibleMs: 920,
  graceMs: 120,
  basePoints: 55,
  pointsPerHit: 14,
  comboPointMultiplier: 4,
  maxSpeedBonus: 90,
  maxAccuracyBonus: 75,
  streakBonusStep: 10,
  streakBonusCap: 7,
} as const;

export type DailyGameRound = {
  index: number;
  cell: number;
  tone: "amber" | "emerald" | "blue";
  startMs: number;
  endMs: number;
};

export type DailyGameHit = {
  roundIndex: number;
  hitAtMs: number;
};

export type DailyGameScoreBreakdown = {
  validHits: number;
  misses: number;
  accuracy: number;
  avgReactionMs: number | null;
  comboBest: number;
  basePoints: number;
  performancePoints: number;
  streakBonus: number;
  totalPoints: number;
  nextStreak: number;
};

export type DailyGamePlayerSnapshot = {
  scoreCurrent: number;
  scoreTotal: number;
  streak: number;
  displayName: string;
  departmentName: string | null;
  lastPlayedDate: string | null;
  canPlayToday: boolean;
  rankPosition: number | null;
};

export type DailyGameLeaderboardEntry = {
  userId: string;
  displayName: string;
  departmentName: string | null;
  scoreCurrent: number;
  scoreTotal: number;
  streak: number;
  rankPosition: number;
  isCurrentUser?: boolean;
};

export type DailyGamePlayerOfDay = {
  userId: string;
  displayName: string;
  departmentName: string | null;
  totalPointsAwarded: number;
};

function hashSeed(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDailyGameRounds(seed: string): DailyGameRound[] {
  const nextSeed = hashSeed(seed)();
  const random = mulberry32(nextSeed);
  const tones: DailyGameRound["tone"][] = ["amber", "emerald", "blue"];
  let previousCell = -1;
  const rounds: DailyGameRound[] = [];

  for (let index = 0; index < DAILY_GAME_CONFIG.rounds; index += 1) {
    let cell = Math.floor(random() * DAILY_GAME_CONFIG.gridSize);
    if (cell === previousCell) {
      cell = (cell + 1 + Math.floor(random() * (DAILY_GAME_CONFIG.gridSize - 1))) % DAILY_GAME_CONFIG.gridSize;
    }
    previousCell = cell;
    const startMs = index * DAILY_GAME_CONFIG.roundSpacingMs;
    rounds.push({
      index,
      cell,
      tone: tones[index % tones.length],
      startMs,
      endMs: startMs + DAILY_GAME_CONFIG.visibleMs,
    });
  }

  return rounds;
}

export function scoreDailyGameSession(
  rounds: DailyGameRound[],
  hits: DailyGameHit[],
  previousStreak: number
): DailyGameScoreBreakdown {
  const uniqueHits = new Map<number, number>();
  for (const hit of hits) {
    if (!Number.isInteger(hit.roundIndex) || !Number.isFinite(hit.hitAtMs)) continue;
    if (hit.roundIndex < 0 || hit.roundIndex >= rounds.length) continue;
    if (hit.hitAtMs < 0 || hit.hitAtMs > DAILY_GAME_CONFIG.durationMs + 5_000) continue;
    const existing = uniqueHits.get(hit.roundIndex);
    if (existing === undefined || hit.hitAtMs < existing) uniqueHits.set(hit.roundIndex, hit.hitAtMs);
  }

  let validHits = 0;
  let comboBest = 0;
  let currentCombo = 0;
  let reactionSum = 0;

  rounds.forEach((round) => {
    const hitAtMs = uniqueHits.get(round.index);
    const isValid =
      typeof hitAtMs === "number" &&
      hitAtMs >= round.startMs &&
      hitAtMs <= round.endMs + DAILY_GAME_CONFIG.graceMs;

    if (isValid && typeof hitAtMs === "number") {
      validHits += 1;
      currentCombo += 1;
      comboBest = Math.max(comboBest, currentCombo);
      reactionSum += Math.max(0, hitAtMs - round.startMs);
      return;
    }

    currentCombo = 0;
  });

  const misses = rounds.length - validHits;
  const accuracy = rounds.length ? validHits / rounds.length : 0;
  const avgReactionMs = validHits ? Math.round(reactionSum / validHits) : null;
  const speedRatio =
    avgReactionMs === null
      ? 0
      : Math.max(0, Math.min(1, (DAILY_GAME_CONFIG.visibleMs - avgReactionMs) / DAILY_GAME_CONFIG.visibleMs));
  const speedBonus = Math.round(speedRatio * DAILY_GAME_CONFIG.maxSpeedBonus);
  const accuracyBonus = Math.round(accuracy * DAILY_GAME_CONFIG.maxAccuracyBonus);
  const hitPoints = validHits * DAILY_GAME_CONFIG.pointsPerHit;
  const comboPoints = comboBest * DAILY_GAME_CONFIG.comboPointMultiplier;
  const performancePoints = hitPoints + comboPoints + speedBonus + accuracyBonus;
  const nextStreak = Math.max(1, previousStreak + 1);
  const streakBonus =
    Math.min(nextStreak, DAILY_GAME_CONFIG.streakBonusCap) * DAILY_GAME_CONFIG.streakBonusStep;
  const totalPoints = DAILY_GAME_CONFIG.basePoints + performancePoints + streakBonus;

  return {
    validHits,
    misses,
    accuracy: Number((accuracy * 100).toFixed(2)),
    avgReactionMs,
    comboBest,
    basePoints: DAILY_GAME_CONFIG.basePoints,
    performancePoints,
    streakBonus,
    totalPoints,
    nextStreak,
  };
}

export function buildDailyMotivationMessage(
  streak: number,
  canPlayToday: boolean,
  scoreCurrent: number
) {
  if (!canPlayToday) return "Desafio concluido hoje. Volte amanha para manter sua sequencia.";
  if (streak >= 7) return "Sua sequencia esta forte. Mais uma rodada e voce pressiona o topo do ranking.";
  if (streak >= 3) return "Consistencia gera destaque. Garanta mais um dia sem quebrar o ritmo.";
  if (scoreCurrent > 0) return "Seu saldo esta valendo. Entre hoje para defender sua posicao.";
  return "Uma rodada por dia. Se faltar, o placar atual zera. Vale entrar agora.";
}

export function buildDailyShareText(result: {
  totalPoints: number;
  streak: number;
  displayName: string;
}) {
  return `${result.displayName} fez ${result.totalPoints} pontos no ${DAILY_GAME_TITLE} e chegou a ${result.streak} dia(s) de sequencia no portal interno.`;
}

export function formatCompactPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
