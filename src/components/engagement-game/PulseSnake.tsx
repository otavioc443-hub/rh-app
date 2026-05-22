"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ArrowRight, Play, RotateCcw, Trophy } from "lucide-react";
import {
  DAILY_GAME_TITLE,
  formatCompactPoints,
  type DailyDifficultyKey,
  type DailyGameLeaderboardEntry,
  type DailyGameRound,
} from "@/lib/engagementGame";

type StatusResponse = {
  game: {
    title: string;
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
    displayName: string;
    scoreCurrent: number;
    scoreTotal: number;
    streak: number;
    canPlayToday: boolean;
    playedToday: boolean;
    rankPosition: number | null;
  };
  leaderboard: DailyGameLeaderboardEntry[];
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
    validHits: number;
    accuracy: number;
    comboBest: number;
    nextStreak: number;
    scoreCurrent: number;
    scoreTotal: number;
    rankPosition: number | null;
  };
  leaderboard: DailyGameLeaderboardEntry[];
};

type Cell = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type GameState = "idle" | "playing" | "finished";

const BOARD_SIZE = 14;
const INITIAL_SNAKE: Cell[] = [
  { x: 6, y: 7 },
  { x: 5, y: 7 },
  { x: 4, y: 7 },
];

function sameCell(a: Cell, b: Cell) {
  return a.x === b.x && a.y === b.y;
}

function nextCell(head: Cell, direction: Direction): Cell {
  if (direction === "up") return { x: head.x, y: head.y - 1 };
  if (direction === "down") return { x: head.x, y: head.y + 1 };
  if (direction === "left") return { x: head.x - 1, y: head.y };
  return { x: head.x + 1, y: head.y };
}

function isOpposite(current: Direction, next: Direction) {
  return (
    (current === "up" && next === "down") ||
    (current === "down" && next === "up") ||
    (current === "left" && next === "right") ||
    (current === "right" && next === "left")
  );
}

function makeFood(snake: Cell[], seed: number): Cell {
  for (let offset = 0; offset < BOARD_SIZE * BOARD_SIZE; offset += 1) {
    const value = (seed * 37 + offset * 19) % (BOARD_SIZE * BOARD_SIZE);
    const cell = { x: value % BOARD_SIZE, y: Math.floor(value / BOARD_SIZE) };
    if (!snake.some((part) => sameCell(part, cell))) return cell;
  }
  return { x: 0, y: 0 };
}

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function DirectionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

export function PulseSnakePage({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [rounds, setRounds] = useState<DailyGameRound[]>([]);
  const [durationMs, setDurationMs] = useState(36_000);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [snake, setSnake] = useState<Cell[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Cell>({ x: 10, y: 7 });
  const [direction, setDirection] = useState<Direction>("right");
  const [queuedDirection, setQueuedDirection] = useState<Direction>("right");
  const [foodHits, setFoodHits] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(36_000);
  const [result, setResult] = useState<SubmitResponse["result"] | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyGameLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitGuardRef = useRef(false);

  const maxFoods = rounds.length || status?.game.difficulty?.rounds || 20;
  const canStart = Boolean(status?.player.canPlayToday && !status.game.isWeekend && gameState !== "playing");
  const scorePreview = Math.min(foodHits.length, maxFoods);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/institucional/jogo-diario/status", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as StatusResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar o jogo.");
      setStatus(json);
      setLeaderboard(json.leaderboard ?? []);
      setDurationMs(json.game.durationMs);
      setRemainingMs(json.game.durationMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o jogo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const finishGame = useCallback(async () => {
    if (!sessionId || submitGuardRef.current) return;
    submitGuardRef.current = true;
    setGameState("finished");
    setBusy(true);
    try {
      const cappedHits = foodHits.slice(0, rounds.length);
      const hits = cappedHits.map((_, index) => ({
        roundIndex: rounds[index]?.index ?? index,
        hitAtMs: (rounds[index]?.startMs ?? index * 1000) + 1,
      }));
      const res = await fetch("/api/institucional/jogo-diario/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, hits }),
      });
      const json = (await res.json().catch(() => ({}))) as SubmitResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao concluir a rodada.");
      setResult(json.result);
      setLeaderboard(json.leaderboard ?? []);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao concluir a rodada.");
    } finally {
      setBusy(false);
    }
  }, [foodHits, rounds, sessionId]);

  useEffect(() => {
    if (gameState !== "playing" || !startedAt) return undefined;
    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(0, durationMs - (Date.now() - startedAt));
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) void finishGame();
    }, 200);
    return () => window.clearInterval(timer);
  }, [durationMs, finishGame, gameState, startedAt]);

  useEffect(() => {
    if (gameState !== "playing") return undefined;
    const speed = status?.game.difficulty?.key === "hard" ? 105 : status?.game.difficulty?.key === "easy" ? 150 : 125;
    const timer = window.setInterval(() => {
      setSnake((current) => {
        const nextDirection = isOpposite(direction, queuedDirection) ? direction : queuedDirection;
        setDirection(nextDirection);
        const head = nextCell(current[0], nextDirection);
        const hitWall = head.x < 0 || head.y < 0 || head.x >= BOARD_SIZE || head.y >= BOARD_SIZE;
        const hitSelf = current.some((part, index) => index > 0 && sameCell(part, head));
        if (hitWall || hitSelf) {
          void finishGame();
          return current;
        }

        const ate = sameCell(head, food);
        const nextSnake = [head, ...current];
        if (!ate) nextSnake.pop();
        if (ate) {
          setFoodHits((prev) => {
            const next = [...prev, Date.now() - (startedAt ?? Date.now())];
            return next;
          });
          setFood(makeFood(nextSnake, Date.now() + nextSnake.length * 11));
        }
        return nextSnake;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [direction, finishGame, food, gameState, maxFoods, queuedDirection, startedAt, status?.game.difficulty?.key]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowUp") setQueuedDirection("up");
      if (event.key === "ArrowDown") setQueuedDirection("down");
      if (event.key === "ArrowLeft") setQueuedDirection("left");
      if (event.key === "ArrowRight") setQueuedDirection("right");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function startGame() {
    if (!canStart) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/institucional/jogo-diario/start", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as StartResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao iniciar o jogo.");
      submitGuardRef.current = false;
      setSessionId(json.sessionId);
      setRounds(json.rounds);
      setDurationMs(json.durationMs);
      setRemainingMs(json.durationMs);
      setSnake(INITIAL_SNAKE);
      setFood({ x: 10, y: 7 });
      setDirection("right");
      setQueuedDirection("right");
      setFoodHits([]);
      setStartedAt(Date.now());
      setGameState("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar o jogo.");
    } finally {
      setBusy(false);
    }
  }

  const boardCells = useMemo(() => Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({ x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) })), []);

  const Wrapper = embedded ? "div" : "main";

  return (
    <Wrapper className={embedded ? "space-y-6" : "mx-auto max-w-7xl space-y-6 px-4 py-6"}>
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/institucional/rede-social?tab=game" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft size={16} /> Voltar ao PulseHub
          </Link>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Mesmas regras do {DAILY_GAME_TITLE}
          </span>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[linear-gradient(120deg,#022c22_0%,#064e3b_48%,#0f172a_100%)] px-6 py-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Trilha Pulse</p>
            <h1 className="mt-2 text-3xl font-semibold">Desafio da cobrinha</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50/90">
              Colete o maximo de pontos antes do tempo acabar. A rodada usa o mesmo limite diario, ranking por empresa e sequencia do Pulse Sprint.
            </p>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div
                className="grid aspect-square w-full max-w-[620px] rounded-3xl border border-emerald-900/10 bg-slate-950 p-3 shadow-inner"
                style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
              >
                {boardCells.map((cell) => {
                  const isHead = sameCell(cell, snake[0]);
                  const isSnake = snake.some((part) => sameCell(part, cell));
                  const isFood = sameCell(cell, food);
                  return (
                    <div key={`${cell.x}-${cell.y}`} className="aspect-square p-[2px]">
                      <div
                        className={clsx(
                          "h-full w-full rounded-md transition-colors",
                          isHead && "bg-emerald-300",
                          !isHead && isSnake && "bg-emerald-500",
                          isFood && "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.8)]",
                          !isSnake && !isFood && "bg-slate-900"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rodada</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{scorePreview}/{maxFoods}</p>
                <p className="mt-1 text-sm text-slate-600">coletas validas</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tempo</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{Math.ceil(remainingMs / 1000)}s</p>
                <p className="mt-1 text-sm text-slate-600">{status?.game.difficulty?.label ?? "Nivel diario"}</p>
              </div>
              <div className="grid justify-center gap-2">
                <div className="flex justify-center">
                  <DirectionButton label="Cima" onClick={() => setQueuedDirection("up")}><ArrowUp size={20} /></DirectionButton>
                </div>
                <div className="flex gap-2">
                  <DirectionButton label="Esquerda" onClick={() => setQueuedDirection("left")}><ArrowLeftIcon size={20} /></DirectionButton>
                  <DirectionButton label="Baixo" onClick={() => setQueuedDirection("down")}><ArrowDown size={20} /></DirectionButton>
                  <DirectionButton label="Direita" onClick={() => setQueuedDirection("right")}><ArrowRight size={20} /></DirectionButton>
                </div>
              </div>
              <button
                type="button"
                disabled={!canStart || busy || loading}
                onClick={() => void startGame()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gameState === "finished" ? <RotateCcw size={18} /> : <Play size={18} />}
                {status?.game.isWeekend ? "Indisponivel no fim de semana" : status?.player.canPlayToday ? "Iniciar Trilha Pulse" : "Rodada diaria concluida"}
              </button>
            </aside>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seu placar</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatCompactPoints(status?.player.scoreCurrent ?? 0)}</p>
            <p className="mt-1 text-sm text-slate-600">Sequencia: {status?.player.streak ?? 0} dia(s)</p>
            {result ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                +{formatCompactPoints(result.totalPoints)} pontos nesta rodada. {result.validHits} coleta(s) validas.
              </div>
            ) : null}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              <p className="text-sm font-semibold text-slate-950">Ranking da empresa</p>
            </div>
            <div className="mt-4 space-y-2">
              {leaderboard.length ? (
                leaderboard.map((entry) => (
                  <div key={entry.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{entry.rankPosition}. {entry.displayName}</p>
                      <p className="text-xs text-slate-500">{entry.departmentName ?? "Sem setor"}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{formatCompactPoints(entry.scoreCurrent)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Ranking sera exibido apos as primeiras rodadas.</p>
              )}
            </div>
          </div>
        </aside>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </Wrapper>
  );
}
