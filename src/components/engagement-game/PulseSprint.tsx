"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  Bolt,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronUp,
  Crown,
  Flame,
  Medal,
  Play,
  RefreshCcw,
  Rocket,
  Share2,
  Target,
  Trophy,
} from "lucide-react";
import {
  DAILY_GAME_CONFIG,
  DAILY_GAME_TITLE,
  formatCompactPoints,
  type DailyGameHit,
  type DailyDifficultyKey,
  type DailyGameLeaderboardEntry,
  type DailyGameRound,
} from "@/lib/engagementGame";

type StatusResponse = {
  game: {
    slug: string;
    title: string;
    summary: string;
    durationMs: number;
    difficulty: {
      key: DailyDifficultyKey;
      label: string;
      summary: string;
      targetScale: number;
      rounds: number;
    } | null;
    isWeekend: boolean;
    nextBusinessDayLabel: string | null;
  };
  player: {
    userId: string;
    displayName: string;
    departmentName: string | null;
    scoreCurrent: number;
    scoreTotal: number;
    streak: number;
    lastPlayedDate: string | null;
    canPlayToday: boolean;
    playedToday: boolean;
    isAdmin: boolean;
    rankPosition: number | null;
  };
  leaderboard: DailyGameLeaderboardEntry[];
  playerOfDay: {
    userId: string;
    displayName: string;
    departmentName: string | null;
    totalPointsAwarded: number;
  } | null;
  recentHistory: Array<{
    event_type: string;
    points_delta: number;
    score_current_after: number;
    streak_after: number;
    event_date: string;
    created_at: string;
  }>;
  message: string;
};

type StartResponse = {
  sessionId: string;
  rounds: DailyGameRound[];
  durationMs: number;
  difficulty: {
    key: DailyDifficultyKey;
    label: string;
    summary: string;
    targetScale: number;
    rounds: number;
  };
};

type SubmitResponse = {
  result: {
    totalPoints: number;
    difficulty: DailyDifficultyKey;
    difficultyLabel: string;
    basePoints: number;
    performancePoints: number;
    streakBonus: number;
    validHits: number;
    misses: number;
    accuracy: number;
    avgReactionMs: number | null;
    comboBest: number;
    nextStreak: number;
    scoreCurrent: number;
    scoreTotal: number;
    rankPosition: number | null;
    shareText: string;
  };
  leaderboard: DailyGameLeaderboardEntry[];
};

const GRID_CELLS = Array.from({ length: 9 }, (_, index) => index);

function whenLabel(value: string | null) {
  if (!value) return "Ainda sem rodada concluida";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Fortaleza",
  }).format(date);
}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function OverlayModal({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.65)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function getHistoryEntryLabel(eventType: string) {
  if (eventType === "play_awarded") return "Rodada concluida";
  if (eventType === "manual_adjustment") return "Ajuste de rodada";
  return "Reset por falta";
}

function CompactLeaderboard({
  leaderboard,
}: {
  leaderboard: DailyGameLeaderboardEntry[];
}) {
  return (
    <div className="space-y-2.5">
      {leaderboard.length ? (
        leaderboard.map((entry) => (
          <div
            key={entry.userId}
            className={clsx(
              "flex items-center justify-between gap-3 rounded-2xl border px-3 py-3",
              entry.rankPosition === 1
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-50",
              entry.isCurrentUser && "ring-2 ring-[#0a66c2]/20"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900 shadow-sm">
                  {entry.rankPosition}
                </span>
                <p className="truncate text-sm font-semibold text-slate-900">{entry.displayName}</p>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">
                {(entry.departmentName ?? "Area interna")} • {entry.streak} dia(s) uteis
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{formatCompactPoints(entry.scoreCurrent)}</p>
              <p className="text-[11px] text-slate-500">placar atual</p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-500">O ranking ainda sera formado apos as primeiras rodadas.</p>
      )}
    </div>
  );
}

export function PulseSprintWidget({
  className = "",
}: {
  className?: string;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/institucional/jogo-diario/status", { cache: "no-store" });
      const json = (await res.json()) as StatusResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar widget.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar widget.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={clsx("rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.32)]", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jogo diario</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{DAILY_GAME_TITLE}</p>
        </div>
        <Link href="/institucional/jogo-diario" className="text-sm font-semibold text-[#0a66c2] hover:underline">
          Abrir
        </Link>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">Carregando ranking...</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      {data ? (
        <>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Seu placar atual</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{formatCompactPoints(data.player.scoreCurrent)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">streak</p>
                <p className="mt-1 text-lg font-semibold text-amber-600">{data.player.streak}x</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{data.message}</p>
          </div>

          {data.playerOfDay ? (
            <div className="mt-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Jogador do dia</p>
              <p className="mt-1 text-base font-semibold">{data.playerOfDay.displayName}</p>
              <p className="mt-1 text-sm text-white/75">
                {(data.playerOfDay.departmentName ?? "Area interna")} • {formatCompactPoints(data.playerOfDay.totalPointsAwarded)} pts na rodada de hoje
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-900">Top 5 da empresa</p>
            <div className="mt-3">
              <CompactLeaderboard leaderboard={data.leaderboard} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function PulseSprintPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<DailyGameRound[]>([]);
  const [durationMs, setDurationMs] = useState<number>(DAILY_GAME_CONFIG.durationMs);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hits, setHits] = useState<DailyGameHit[]>([]);
  const [result, setResult] = useState<SubmitResponse["result"] | null>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "finished">("idle");
  const [copied, setCopied] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [showWeekendModal, setShowWeekendModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeDifficulty, setActiveDifficulty] = useState<StatusResponse["game"]["difficulty"] | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const rankingRef = useRef<HTMLElement | null>(null);
  const startedAtRef = useRef<number>(0);
  const submitGuardRef = useRef(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/institucional/jogo-diario/status", { cache: "no-store" });
      const json = (await res.json()) as StatusResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar o jogo.");
      setStatus(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o jogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status) return;
    setActiveDifficulty(status.game.difficulty);
    setShowWeekendModal(status.game.isWeekend);
  }, [status]);

  const activeRound = useMemo(() => {
    if (gameState !== "playing") return null;
    return rounds.find((round) => elapsedMs >= round.startMs && elapsedMs <= round.endMs) ?? null;
  }, [elapsedMs, gameState, rounds]);

  const hitLookup = useMemo(() => new Set(hits.map((item) => item.roundIndex)), [hits]);

  useEffect(() => {
    if (gameState !== "playing") return undefined;
    const tick = () => {
      const nextElapsed = performance.now() - startedAtRef.current;
      setElapsedMs(nextElapsed);
      if (nextElapsed >= durationMs && !submitGuardRef.current) {
        submitGuardRef.current = true;
        setGameState("finished");
      } else {
        requestAnimationFrame(tick);
      }
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, gameState]);

  const submitRound = useCallback(async () => {
    if (!sessionId || !status || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/institucional/jogo-diario/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, hits }),
      });
      const json = (await res.json()) as SubmitResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao finalizar a rodada.");
      setResult(json.result);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              player: {
                ...prev.player,
                scoreCurrent: json.result.scoreCurrent,
                scoreTotal: json.result.scoreTotal,
                streak: json.result.nextStreak,
                canPlayToday: false,
                rankPosition: json.result.rankPosition,
              },
              leaderboard: json.leaderboard,
              message: "Rodada concluida. Seu placar de hoje ja foi registrado.",
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar a rodada.");
    } finally {
      setSubmitting(false);
    }
  }, [hits, sessionId, status, submitting]);

  useEffect(() => {
    if (gameState !== "finished" || !submitGuardRef.current) return;
    void submitRound();
  }, [gameState, submitRound]);

  useEffect(() => {
    if (result) setShowResultModal(true);
  }, [result]);

  const startRound = useCallback(async () => {
    setStarting(true);
    setError("");
    setResult(null);
    setCopied(false);
    setShowResultModal(false);
    setShowIntroModal(false);
    submitGuardRef.current = false;
    try {
      const res = await fetch("/api/institucional/jogo-diario/start", { method: "POST" });
      const json = (await res.json()) as StartResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao iniciar.");
      setSessionId(json.sessionId);
      setRounds(json.rounds);
      setDurationMs(json.durationMs);
      setActiveDifficulty(json.difficulty);
      setHits([]);
      setElapsedMs(0);
      startedAtRef.current = performance.now();
      setGameState("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar o jogo.");
    } finally {
      setStarting(false);
    }
  }, []);

  const handleStart = useCallback(() => {
    if (!status) return;
    if (status.game.isWeekend) {
      setShowWeekendModal(true);
      return;
    }
    if (!status.player.canPlayToday || gameState === "playing") return;
    setShowIntroModal(true);
  }, [gameState, status]);

  const handleCellTap = useCallback(
    (cellIndex: number) => {
      if (!activeRound || cellIndex !== activeRound.cell) return;
      if (hitLookup.has(activeRound.index)) return;
      setHits((prev) => [...prev, { roundIndex: activeRound.index, hitAtMs: Math.round(elapsedMs) }]);
    },
    [activeRound, elapsedMs, hitLookup]
  );

  const shareText = result?.shareText ?? "";

  const handleCopy = useCallback(async () => {
    if (!shareText) return;
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [shareText]);

  const handleDownloadCard = useCallback(async () => {
    if (!resultCardRef.current || !result) return;
    const dataUrl = await toPng(resultCardRef.current, { cacheBust: true, pixelRatio: 2 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "pulse-sprint-resultado.png";
    link.click();
  }, [result]);

  const progress = Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100));
  const primaryActionLabel = status?.game.isWeekend
    ? "Indisponivel hoje"
    : status?.player.canPlayToday
    ? "Jogar agora"
    : "Rodada concluida hoje";
  const compactMessage = status?.game.isWeekend
    ? "O desafio retorna no proximo dia util."
    : status?.player.canPlayToday
    ? `Sua rodada ${activeDifficulty?.label?.toLowerCase() ?? "de hoje"} esta pronta.`
    : "Rodada concluida hoje.";
  const streakLabel = `${status?.player.streak ?? 0} dia(s) uteis`;
  const introMessage =
    status?.message ??
    "Preparado para mais uma rodada? Seu desempenho de hoje pode melhorar sua posicao no ranking.";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section
        className={clsx(
          "relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_28%),linear-gradient(135deg,#f8fafc,#ffffff)] shadow-[0_28px_80px_-48px_rgba(15,23,42,0.45)]",
          heroCollapsed ? "p-4" : "p-6"
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            <Rocket size={14} /> Engajamento diario
          </div>
          <button
            type="button"
            onClick={() => setHeroCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {heroCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            {heroCollapsed ? "Expandir" : "Minimizar"}
          </button>
        </div>

        {heroCollapsed ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-slate-950">{DAILY_GAME_TITLE}</h1>
                <p className="mt-1 text-sm text-slate-600">{compactMessage}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  {formatCompactPoints(status?.player.scoreCurrent ?? 0)} pts
                </div>
                <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                  {status?.player.streak ?? 0}x streak util
                </div>
                <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  {status?.player.rankPosition ? `#${status.player.rankPosition}` : "Sem rank"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={starting || loading || !status?.player.canPlayToday || gameState === "playing"}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Play size={16} />
                {primaryActionLabel}
              </button>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw size={15} /> Atualizar
              </button>
              <Link
                href="/institucional/rede-social"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Share2 size={15} /> Abrir PulseHub
              </Link>
            </div>
          </div>
        ) : null}

        <div className={clsx("grid gap-6", heroCollapsed ? "hidden" : "lg:grid-cols-[1.15fr_0.85fr]")}>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{DAILY_GAME_TITLE}</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
              Desafio diario com nivel automatico por dia util. Toque os pulsos de energia na grade e acumule pontos base, bonus de performance e bonus de streak.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Placar atual</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatCompactPoints(status?.player.scoreCurrent ?? 0)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sequencia</p>
                <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-amber-600">
                  <Flame size={24} /> {status?.player.streak ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">dias uteis</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {activeDifficulty ? `Nivel ${activeDifficulty.label}` : "Posicao"}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {activeDifficulty ? `${activeDifficulty.rounds}` : status?.player.rankPosition ? `#${status.player.rankPosition}` : "--"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeDifficulty ? "alvos previstos" : "ranking atual"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-white/75 p-4">
              <p className="text-sm font-semibold text-slate-900">Mensagem do dia</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {status?.message ?? "Carregando sua motivacao diaria..."}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={starting || loading || !status?.player.canPlayToday || gameState === "playing"}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Play size={16} />
                {primaryActionLabel}
              </button>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw size={16} /> Atualizar
              </button>
              <Link
                href="/institucional/rede-social"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Share2 size={16} /> Abrir PulseHub
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Como funciona</p>
            <div className="mt-4 space-y-3">
              {[ 
                {
                  icon: Target,
                  title: "1 rodada por dia util",
                  body: "Jogou no dia util, soma. Pulou um dia util, seu placar atual zera.",
                },
                { icon: Bolt, title: "Nivel automatico", body: "Facil, medio e dificil se revezam automaticamente entre segunda e sexta." },
                { icon: Trophy, title: "Top 5 visivel", body: "O ranking da empresa aparece aqui, na area institucional e no PulseHub." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-2xl bg-white p-2 shadow-sm">
                      <item.icon size={16} className="text-slate-700" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Pontuacao: base diaria + performance no desafio + bonus progressivo de streak em dias uteis.
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Arena</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">
                {gameState === "playing" ? "Desafio em andamento" : "Arena pronta para iniciar"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/institucional/rede-social"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={15} /> Voltar ao PulseHub
              </Link>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                Ultima rodada: {whenLabel(status?.player.lastPlayedDate ?? null)}
              </div>
            </div>
          </div>

          {gameState === "playing" ? (
            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-950 p-2.5 text-white">
                    <Target size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Pulse Grid 3x3 {activeDifficulty ? `• ${activeDifficulty.label}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activeDifficulty?.summary ?? "Um alvo por vez. Reaja antes do pulso mudar."}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">tempo</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))}s</p>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#0ea5e9)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mx-auto mt-4 grid max-w-[360px] grid-cols-3 gap-2.5 sm:max-w-[390px]">
                {GRID_CELLS.map((cell) => {
                  const isActive = activeRound?.cell === cell;
                  const wasHit = activeRound ? hitLookup.has(activeRound.index) && activeRound.cell === cell : false;
                  const toneClass =
                    activeRound?.tone === "amber"
                      ? "from-amber-400 to-orange-500"
                      : activeRound?.tone === "emerald"
                      ? "from-emerald-400 to-teal-500"
                      : "from-sky-400 to-blue-500";

                  return (
                    <button
                      key={cell}
                      type="button"
                      onClick={() => handleCellTap(cell)}
                      className={clsx(
                        "aspect-square rounded-[1.2rem] border border-slate-200 bg-slate-50 transition",
                        gameState === "playing" && "hover:border-slate-300 hover:bg-slate-100",
                        isActive && `border-transparent bg-gradient-to-br ${toneClass} text-white shadow-[0_18px_40px_-24px_rgba(14,165,233,0.65)]`,
                        wasHit && "scale-[0.97]"
                      )}
                    >
                      <div
                        className="flex h-full items-center justify-center"
                        style={isActive ? { transform: `scale(${activeDifficulty?.targetScale ?? 1})` } : undefined}
                      >
                        {isActive ? <Bolt size={22} /> : <span className="text-[11px] font-semibold text-slate-300">pulse</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">hits</p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-950">{hits.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">rodadas</p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-950">{activeDifficulty?.rounds ?? DAILY_GAME_CONFIG.rounds}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">estado</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-950">
                    {gameState === "playing" ? "Em andamento" : submitting ? "Processando" : "Pronto"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">A arena fica visivel apenas depois do inicio da rodada.</p>
              <p className="mt-2 text-sm text-slate-600">
                Abra o modal do desafio e clique em <span className="font-semibold">Iniciar desafio</span> para liberar o tabuleiro.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section
            ref={rankingRef}
            className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                <Crown size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Top 5</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Ranking da empresa</p>
              </div>
            </div>
            <div className="mt-4">
              <CompactLeaderboard leaderboard={status?.leaderboard ?? []} />
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                <ChartNoAxesColumn size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Historico</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Ultimos movimentos</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(status?.recentHistory ?? []).length ? (
                status?.recentHistory.map((entry) => (
                  <div key={`${entry.created_at}-${entry.event_type}`} className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">{getHistoryEntryLabel(entry.event_type)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.event_date} • streak {entry.streak_after} • atual {formatCompactPoints(entry.score_current_after)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Seu historico aparecera apos a primeira rodada.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {result ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resultado</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">Rodada registrada com sucesso</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Share2 size={16} /> {copied ? "Copiado" : "Copiar resultado"}
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadCard()}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Medal size={16} /> Baixar card
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Pontos totais", value: result.totalPoints },
                { label: "Hits validos", value: result.validHits },
                { label: "Precisao", value: `${result.accuracy.toFixed(0)}%` },
                { label: "Combo maximo", value: result.comboBest },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>

            <div
              ref={resultCardRef}
              className="rounded-[1.75rem] bg-[linear-gradient(135deg,#0f172a,#1e293b)] p-5 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.8)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Card do dia</p>
              <p className="mt-2 text-3xl font-semibold">{result.totalPoints} pts</p>
              <p className="mt-2 text-sm text-white/75">
                streak {result.nextStreak} • rank {result.rankPosition ? `#${result.rankPosition}` : "em formacao"}
              </p>
              <div className="mt-6 rounded-3xl bg-white/10 px-4 py-4">
                <p className="text-sm font-semibold">{status?.player.displayName}</p>
                <p className="mt-1 text-sm text-white/75">{result.shareText}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <OverlayModal open={showWeekendModal} title="Pausa do desafio">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Hoje e dia de recarregar as energias!</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          O proximo desafio estara disponivel no proximo dia util{status?.game.nextBusinessDayLabel ? `, ${status.game.nextBusinessDayLabel}` : ""}.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowWeekendModal(false)}
            className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ok, entendi
          </button>
        </div>
      </OverlayModal>

      <OverlayModal open={showIntroModal} title="Desafio do dia">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Preparado para mais uma rodada?</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Nivel de hoje</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{status?.game.difficulty?.label ?? "Medio"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sequencia atual</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{streakLabel}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Arena</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{status?.game.difficulty?.rounds ?? DAILY_GAME_CONFIG.rounds} alvos</p>
          </div>
        </div>
        <p className="mt-5 text-base leading-relaxed text-slate-600">{introMessage}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowIntroModal(false)}
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Agora nao
          </button>
          <button
            type="button"
            onClick={() => void startRound()}
            disabled={starting}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            <Play size={16} />
            Iniciar desafio
          </button>
        </div>
      </OverlayModal>

      <OverlayModal open={showResultModal && !!result} title="Resultado da rodada">
        {result ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Mandou bem!</h2>
            <p className="mt-3 text-base text-slate-600">
              Voce concluiu o nivel {result.difficultyLabel} com {formatCompactPoints(result.totalPoints)} pontos.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pontuacao do dia</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{formatCompactPoints(result.totalPoints)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Nivel jogado</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{result.difficultyLabel}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Posicao</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{result.rankPosition ? `#${result.rankPosition}` : "Em formacao"}</p>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">Top 5 da empresa</p>
              <div className="mt-3 max-h-[260px] overflow-auto pr-1">
                <CompactLeaderboard leaderboard={status?.leaderboard ?? []} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResultModal(false);
                  rankingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Ver ranking completo
              </button>
            </div>
          </>
        ) : null}
      </OverlayModal>
    </div>
  );
}
