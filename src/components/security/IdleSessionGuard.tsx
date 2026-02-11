"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const WARNING_AT_MS = IDLE_LIMIT_MS - WARNING_BEFORE_MS;

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
};

export default function IdleSessionGuard({ children, redirectTo = "/" }: Props) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bc = useMemo(() => {
    if (typeof window === "undefined") return null;
    return "BroadcastChannel" in window ? new BroadcastChannel("auth-events") : null;
  }, []);

  function clearAllTimers() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    idleTimerRef.current = null;
    warnTimerRef.current = null;
    countdownRef.current = null;
  }

  async function forceLogout(reason: "idle" | "manual" | "sync" = "idle") {
    clearAllTimers();
    setShowWarning(false);

    try {
      bc?.postMessage({ type: "LOGOUT", reason, at: Date.now() });
      localStorage.setItem("logout", String(Date.now()));
    } catch {}

    await supabase.auth.signOut();
    router.push(redirectTo);
  }

  function startCountdown() {
    setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));
    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
  }

  function resetIdleTimers() {
    clearAllTimers();
    setShowWarning(false);

    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, WARNING_AT_MS);

    idleTimerRef.current = setTimeout(() => void forceLogout("idle"), IDLE_LIMIT_MS);
  }

  function onActivity() {
    resetIdleTimers();
  }

  function staySignedIn() {
    resetIdleTimers();
  }

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const onVis = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    document.addEventListener("visibilitychange", onVis);

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "logout") void forceLogout("sync");
    };
    window.addEventListener("storage", onStorage);

    bc?.addEventListener("message", (ev) => {
      if (ev?.data?.type === "LOGOUT") void forceLogout("sync");
    });

    resetIdleTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
      bc?.close();
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Sessão prestes a expirar</h2>
            <p className="mt-2 text-sm text-gray-600">
              Por segurança, sua sessão será encerrada em{" "}
              <span className="font-semibold">{secondsLeft}s</span>.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={staySignedIn}
                className="flex-1 rounded-xl bg-black px-4 py-2 text-white"
              >
                Continuar sessão
              </button>
              <button
                onClick={() => void forceLogout("manual")}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2"
              >
                Sair agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
