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

export type DailyDifficultyKey = "easy" | "medium" | "hard";

export type DailyDifficultyConfig = {
  key: DailyDifficultyKey;
  label: string;
  summary: string;
  durationMs: number;
  rounds: number;
  roundSpacingMs: number;
  visibleMs: number;
  graceMs: number;
  targetScale: number;
  bonusMultiplier: number;
};

const DAILY_DIFFICULTY_CYCLE: DailyDifficultyKey[] = ["easy", "medium", "hard", "easy", "medium"];

export const DAILY_DIFFICULTY_CONFIG: Record<DailyDifficultyKey, DailyDifficultyConfig> = {
  easy: {
    key: "easy",
    label: "Fácil",
    summary: "Alvos maiores, mais tempo de reação e bônus moderado.",
    durationMs: 38_000,
    rounds: 20,
    roundSpacingMs: 1_550,
    visibleMs: 1_080,
    graceMs: 140,
    targetScale: 1.08,
    bonusMultiplier: 1,
  },
  medium: {
    key: "medium",
    label: "Médio",
    summary: "Ritmo equilibrado para manter consistência diária.",
    durationMs: 36_000,
    rounds: 24,
    roundSpacingMs: 1_350,
    visibleMs: 920,
    graceMs: 120,
    targetScale: 1,
    bonusMultiplier: 1.08,
  },
  hard: {
    key: "hard",
    label: "Difícil",
    summary: "Mais alvos, menos tempo de reação e bônus superior.",
    durationMs: 34_000,
    rounds: 28,
    roundSpacingMs: 1_140,
    visibleMs: 760,
    graceMs: 100,
    targetScale: 0.92,
    bonusMultiplier: 1.18,
  },
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
  difficulty: DailyDifficultyKey;
  difficultyLabel: string;
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

export function isWeekend(date: Date) {
  const weekday = getFortalezaWeekday(date);
  return weekday === "Sat" || weekday === "Sun";
}

function getFortalezaWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza",
    weekday: "short",
  }).format(date);
}

export function isBusinessDay(date: Date) {
  return !isWeekend(date);
}

export function getNextBusinessDay(date: Date) {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (!isBusinessDay(next));
  return next;
}

export function getDailyDifficulty(date = new Date()) {
  const weekday = getFortalezaWeekday(date);
  if (weekday === "Sat" || weekday === "Sun") return null;
  const index =
    weekday === "Mon" ? 0 : weekday === "Tue" ? 1 : weekday === "Wed" ? 2 : weekday === "Thu" ? 3 : 4;
  const key = DAILY_DIFFICULTY_CYCLE[index] ?? "medium";
  return DAILY_DIFFICULTY_CONFIG[key];
}

export function getBusinessDaysBetween(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start.getTime() === end.getTime()) return 0;
  const direction = start < end ? 1 : -1;
  let count = 0;
  const cursor = new Date(start);

  while (cursor.getTime() !== end.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    if (isBusinessDay(cursor)) count += direction;
  }

  return count;
}

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

export function buildDailyGameRounds(seed: string, difficulty: DailyDifficultyConfig = DAILY_DIFFICULTY_CONFIG.medium): DailyGameRound[] {
  const nextSeed = hashSeed(seed)();
  const random = mulberry32(nextSeed);
  const tones: DailyGameRound["tone"][] = ["amber", "emerald", "blue"];
  let previousCell = -1;
  const rounds: DailyGameRound[] = [];

  for (let index = 0; index < difficulty.rounds; index += 1) {
    let cell = Math.floor(random() * DAILY_GAME_CONFIG.gridSize);
    if (cell === previousCell) {
      cell = (cell + 1 + Math.floor(random() * (DAILY_GAME_CONFIG.gridSize - 1))) % DAILY_GAME_CONFIG.gridSize;
    }
    previousCell = cell;
    const startMs = index * difficulty.roundSpacingMs;
    rounds.push({
      index,
      cell,
      tone: tones[index % tones.length],
      startMs,
      endMs: startMs + difficulty.visibleMs,
    });
  }

  return rounds;
}

export function scoreDailyGameSession(
  rounds: DailyGameRound[],
  hits: DailyGameHit[],
  previousStreak: number,
  difficulty: DailyDifficultyConfig = DAILY_DIFFICULTY_CONFIG.medium
): DailyGameScoreBreakdown {
  const uniqueHits = new Map<number, number>();
  for (const hit of hits) {
    if (!Number.isInteger(hit.roundIndex) || !Number.isFinite(hit.hitAtMs)) continue;
    if (hit.roundIndex < 0 || hit.roundIndex >= rounds.length) continue;
    if (hit.hitAtMs < 0 || hit.hitAtMs > difficulty.durationMs + 5_000) continue;
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
      hitAtMs <= round.endMs + difficulty.graceMs;

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
      : Math.max(0, Math.min(1, (difficulty.visibleMs - avgReactionMs) / difficulty.visibleMs));
  const speedBonus = Math.round(speedRatio * DAILY_GAME_CONFIG.maxSpeedBonus);
  const accuracyBonus = Math.round(accuracy * DAILY_GAME_CONFIG.maxAccuracyBonus);
  const hitPoints = validHits * DAILY_GAME_CONFIG.pointsPerHit;
  const comboPoints = comboBest * DAILY_GAME_CONFIG.comboPointMultiplier;
  const performancePoints = Math.round((hitPoints + comboPoints + speedBonus + accuracyBonus) * difficulty.bonusMultiplier);
  const nextStreak = Math.max(1, previousStreak + 1);
  const streakBonus =
    Math.min(nextStreak, DAILY_GAME_CONFIG.streakBonusCap) * DAILY_GAME_CONFIG.streakBonusStep;
  const totalPoints = Math.round((DAILY_GAME_CONFIG.basePoints + performancePoints + streakBonus) * difficulty.bonusMultiplier);

  return {
    difficulty: difficulty.key,
    difficultyLabel: difficulty.label,
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
  scoreCurrent: number,
  options?: { weekend?: boolean; difficultyLabel?: string | null; nextBusinessDayLabel?: string | null }
) {
  if (options?.weekend) {
    return options.nextBusinessDayLabel
      ? `Hoje e dia de recarregar as energias. O proximo desafio abre em ${options.nextBusinessDayLabel}.`
      : "Hoje e dia de recarregar as energias. O proximo desafio abre no proximo dia util.";
  }
  if (!canPlayToday) return "Desafio concluido hoje. Volte no proximo dia util para manter sua sequencia.";
  if (streak >= 7) return `Sua sequencia esta forte. O nivel ${options?.difficultyLabel ?? "de hoje"} pode consolidar sua liderança.`;
  if (streak >= 3) return "Consistencia gera destaque. Garanta mais um dia util sem quebrar o ritmo.";
  if (scoreCurrent > 0) return "Seu saldo esta valendo. Entre hoje para defender sua posicao.";
  return "Uma rodada por dia util. Se faltar em um dia util, o placar atual zera.";
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
