// src/lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Sessao apenas por aba/janela: ao fechar o navegador, exige novo login.
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    },
  }
);

const PORTAL_EXIT_INTENT_KEY = "portal_exit_intent";
const RECENT_LOGIN_KEY = "portal_recent_login_at";
const PORTAL_LOGOUT_SIGNAL_KEY = "portal_logout_signal";
const SESSION_AUDIT_ID_KEY = "portal_session_audit_id";

function clearSupabaseStorageBucket(storage: Storage | undefined) {
  if (!storage) return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    // Supabase v2 normalmente salva token em "sb-<ref>-auth-token".
    if (key.startsWith("sb-") || key.includes("supabase.auth.") || key.includes("auth-token")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => storage.removeItem(k));
}

function clearSupabaseCookieBucket() {
  if (typeof document === "undefined") return;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const entry of cookies) {
    const rawName = entry.split("=")[0]?.trim();
    if (!rawName) continue;
    if (rawName.startsWith("sb-") || rawName.includes("supabase.auth.") || rawName.includes("auth-token")) {
      document.cookie = `${rawName}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${rawName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    }
  }
}

export function clearLocalSupabaseSession() {
  if (typeof window === "undefined") return;
  try {
    clearSupabaseStorageBucket(window.localStorage);
    clearSupabaseStorageBucket(window.sessionStorage);
    window.sessionStorage.removeItem(PORTAL_EXIT_INTENT_KEY);
    window.sessionStorage.removeItem(RECENT_LOGIN_KEY);
    window.sessionStorage.removeItem(SESSION_AUDIT_ID_KEY);
    clearSupabaseCookieBucket();
  } catch {
    // noop
  }
}

export async function forceClientLogout() {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Mesmo com falha de rede, limpamos o storage local para forcar novo login.
  } finally {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PORTAL_LOGOUT_SIGNAL_KEY, String(Date.now()));
      } catch {
        // noop
      }
    }
    clearLocalSupabaseSession();
  }
}

export function isPortalLogoutSignalKey(key: string | null) {
  return key === PORTAL_LOGOUT_SIGNAL_KEY;
}

export function setSessionAuditId(sessionId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!sessionId) {
      window.sessionStorage.removeItem(SESSION_AUDIT_ID_KEY);
      return;
    }
    window.sessionStorage.setItem(SESSION_AUDIT_ID_KEY, sessionId);
  } catch {
    // noop
  }
}

export function getSessionAuditId() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_AUDIT_ID_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function markPortalExitIntent() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PORTAL_EXIT_INTENT_KEY, "1");
  } catch {
    // noop
  }
}

export function hasPortalExitIntent() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PORTAL_EXIT_INTENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPortalExitIntent() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PORTAL_EXIT_INTENT_KEY);
  } catch {
    // noop
  }
}

export function markRecentLogin() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RECENT_LOGIN_KEY, String(Date.now()));
  } catch {
    // noop
  }
}

export function hasRecentLoginMarker(maxAgeMs = 10_000) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(RECENT_LOGIN_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts <= maxAgeMs;
  } catch {
    return false;
  }
}

export function clearRecentLoginMarker() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RECENT_LOGIN_KEY);
  } catch {
    // noop
  }
}
