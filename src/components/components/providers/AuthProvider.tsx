"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AuthState, Role } from "@/lib/auth/types";

type ProfileRow = {
  full_name: string | null;
  avatar_url: string | null;
  role: Role | null;
  company_id: string | null;
  department_id: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

declare global {
  interface Window {
    __logoutManual?: () => Promise<void>;
  }
}

// ⏱️ ajuste aqui se quiser (ex.: 10 min = 10 * 60 * 1000)
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// eventos que “contam” como atividade do usuário
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    fullName: null,
    avatarUrl: null,
    role: null,
    companyId: null,
    departmentId: null,
  });

  // Auditoria
  const sessionIdRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // Idle control
  const idleTimerRef = useRef<number | null>(null);
  const isIdleLogoutRunningRef = useRef(false);

  async function callSessionAudit(body: Record<string, unknown>) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const res = await fetch("/api/session-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        console.warn("session-audit error", payload);
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async function createAuditSession(params: {
    userId: string;
    companyId: string | null;
    departmentId: string | null;
  }) {
    const payload = await callSessionAudit({
      action: "start",
      userId: params.userId,
      companyId: params.companyId,
      departmentId: params.departmentId,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    return typeof payload?.sessionId === "string" ? payload.sessionId : null;
  }

  async function updateLastSeen() {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    await callSessionAudit({ action: "heartbeat", sessionId });
  }

  async function closeAuditSession(reason: "manual" | "idle" | "token_expired") {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    try {
      await callSessionAudit({ action: "end", sessionId, reason });
    } catch {
      // silencioso
    } finally {
      sessionIdRef.current = null;
    }
  }

  function clearIdleTimer() {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function resetIdleTimer() {
    // só roda idle se estiver logado
    if (!state.userId) return;

    clearIdleTimer();

    idleTimerRef.current = window.setTimeout(async () => {
      // evita reentrância (multi disparo)
      if (isIdleLogoutRunningRef.current) return;
      isIdleLogoutRunningRef.current = true;

      try {
        // grava auditoria
        await closeAuditSession("idle");

        // encerra sessão
        await supabase.auth.signOut();

        // redireciona (mais confiável que router aqui)
        window.location.href = "/";
      } finally {
        isIdleLogoutRunningRef.current = false;
      }
    }, IDLE_TIMEOUT_MS);
  }

  async function loadAuth() {
    setState((s) => ({ ...s, loading: true }));

    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    // sem sessão
    if (userErr || !userRes.user) {
      // se antes tinha usuário e agora não tem, fecha auditoria
      if (lastUserIdRef.current) {
        await closeAuditSession("token_expired");
      }

      lastUserIdRef.current = null;
      clearIdleTimer();

      setState((s) => ({
        ...s,
        loading: false,
        userId: null,
        email: null,
        fullName: null,
        avatarUrl: null,
        role: null,
        companyId: null,
        departmentId: null,
      }));
      return;
    }

    const user = userRes.user;

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role, company_id, department_id")
      .eq("id", user.id)
      .single<ProfileRow>();

    const companyId = profErr ? null : profile?.company_id ?? null;
    const departmentId = profErr ? null : profile?.department_id ?? null;

    setState({
      loading: false,
      userId: user.id,
      email: user.email ?? null,
      fullName: profErr ? null : profile?.full_name ?? null,
      avatarUrl: profErr ? null : profile?.avatar_url ?? null,
      role: profErr ? null : profile?.role ?? null,
      companyId,
      departmentId,
    });

    // Auditoria: cria sessão só quando troca/entra
    const isNewLogin = lastUserIdRef.current !== user.id;

    if (isNewLogin) {
      // fecha sessão anterior (se existir)
      if (lastUserIdRef.current) {
        await closeAuditSession("token_expired");
      }

      lastUserIdRef.current = user.id;

      sessionIdRef.current = await createAuditSession({
        userId: user.id,
        companyId,
        departmentId,
      });
    }

    // inicia/reset idle sempre que autenticar
    resetIdleTimer();
  }

  // load inicial + monitor auth state
  useEffect(() => {
    loadAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⏱️ Heartbeat: atualiza last_seen_at a cada 60s
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!state.userId) return;
      updateLastSeen();
    }, 60_000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  // 🧠 Idle: escuta eventos e reseta timer
  useEffect(() => {
    if (!state.userId) return;

    const onActivity = () => resetIdleTimer();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    // garante timer ativo
    resetIdleTimer();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      clearIdleTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]);

  // helper pro logout manual (seu botão já chama isso)
  useEffect(() => {
    window.__logoutManual = async () => {
      // encerra auditoria como manual antes do signOut
      await closeAuditSession("manual");
    };

    return () => {
      delete window.__logoutManual;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => state, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext deve ser usado dentro de <AuthProvider />");
  return ctx;
}
