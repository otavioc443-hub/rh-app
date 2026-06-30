"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  clearPortalExitIntent,
  clearPasswordRecoveryIntent,
  clearRecentLoginMarker,
  forceClientLogout,
  hasPasswordRecoveryIntent,
  hasPortalExitIntent,
  markPasswordRecoveryIntent,
  markRecentLogin,
  supabase,
} from "@/lib/supabaseClient";

const DEFAULT_AFTER_LOGIN = "/home";
function sanitizeRedirect(path: string | null) {
  if (!path) return DEFAULT_AFTER_LOGIN;
  if (!path.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  if (path.startsWith("//")) return DEFAULT_AFTER_LOGIN;
  if (path.includes("http://") || path.includes("https://")) return DEFAULT_AFTER_LOGIN;

  const blocked = ["/", "/auth", "/auth/callback", "/auth/recovery", "/set-password", "/recuperar-senha"];
  if (blocked.some((route) => path === route || path.startsWith(`${route}/`))) return DEFAULT_AFTER_LOGIN;

  return path;
}

function getLoginRedirectTarget() {
  if (typeof window === "undefined") return DEFAULT_AFTER_LOGIN;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("next") || params.get("redirectedFrom");
  const fromStorage = window.localStorage.getItem("redirectedFrom");
  return sanitizeRedirect(fromQuery || fromStorage);
}

function clearStoredRedirectTarget() {
  try {
    window.localStorage.removeItem("redirectedFrom");
  } catch {}
}

function hasAuthLinkParams() {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return Boolean(
    url.searchParams.get("code") ||
      url.searchParams.get("token_hash") ||
      (hash.get("access_token") && hash.get("refresh_token"))
  );
}

function moveAuthLinkToSetPassword() {
  if (typeof window === "undefined") return;
  markPasswordRecoveryIntent();
  const target = `/set-password${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);

  useEffect(() => {
    let alive = true;

    if (hasAuthLinkParams()) {
      moveAuthLinkToSetPassword();
      return () => {
        alive = false;
      };
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        if (!data.session?.user) return;
        if (hasPasswordRecoveryIntent()) {
          router.replace("/set-password");
          return;
        }
        if (hasPortalExitIntent()) {
          clearPortalExitIntent();
          clearRecentLoginMarker();
          await forceClientLogout();
          return;
        }
        const target = getLoginRedirectTarget();
        clearStoredRedirectTarget();
        router.replace(target);
      })
      .catch(console.error);

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;
      if (!session?.user) return;

      if (event === "PASSWORD_RECOVERY") {
        clearPortalExitIntent();
        markPasswordRecoveryIntent();
        router.replace("/set-password");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (hasPasswordRecoveryIntent()) {
          router.replace("/set-password");
          return;
        }
        clearPortalExitIntent();
        markRecentLogin();
        const target = getLoginRedirectTarget();
        clearStoredRedirectTarget();
        router.replace(target);
        return;
      }
      const target = getLoginRedirectTarget();
      clearStoredRedirectTarget();
      router.replace(target);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function signIn(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg("");
    setMsgType("error");
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      if (data.user) {
        clearPasswordRecoveryIntent();
        markRecentLogin();
        const target = getLoginRedirectTarget();
        clearStoredRedirectTarget();
        router.replace(target);
      }
    } catch (err) {
      console.error(err);
      setMsg("Erro inesperado ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  }

  function updateCapsLockState(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }

  return (
    <main
      className="
        relative min-h-screen w-full
        bg-[url('/bg-login.jpg')] bg-cover bg-center bg-no-repeat
      "
    >
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative min-h-screen w-full flex items-center justify-start p-6 md:pl-24">
        <div className="w-full max-w-md space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl backdrop-blur-md">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex items-center justify-center gap-6">
                <Image src="/logo.png" alt="Solida" width={160} height={64} className="h-16 w-auto" />
                <span className="h-12 w-[2px] bg-slate-300" />
                <Image src="/logo2.png" alt="Area" width={120} height={48} className="h-12 w-auto" />
              </div>

              <p className="mt-1 text-sm text-gray-600">Acesso ao Portal de RH</p>
            </div>

            <form onSubmit={signIn} className="mt-6 space-y-3">
              <input
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />

              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 pr-12 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={updateCapsLockState}
                    onKeyUp={updateCapsLockState}
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-black"
                    aria-label={showPassword ? "Ocultar senha" : "Visualizar senha"}
                    title={showPassword ? "Ocultar senha" : "Visualizar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {capsLockOn ? <p className="text-xs font-medium text-amber-700">Caps Lock est&aacute; ativo.</p> : null}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => router.push(`/recuperar-senha${email.trim() ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ""}`)}
                  disabled={loading}
                  className="text-xs font-medium text-slate-700 underline underline-offset-2 disabled:opacity-50"
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {msg ? (
                <p className={`mt-2 text-center text-sm ${msgType === "success" ? "text-emerald-700" : "text-red-600"}`}>
                  {msg}
                </p>
              ) : null}

              <p className="mt-4 text-center text-xs text-gray-500">
                Ao acessar, você concorda com as diretrizes internas de uso.
              </p>
            </form>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/85 px-5 py-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)] backdrop-blur-md">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Acesso institucional</p>
            <div className="mt-3 flex justify-center">
              <Link
                href="/canal-de-etica"
                className="inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.65)] transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Canal de Ética
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showPrivacyNotice ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-20 w-[calc(100%-2.5rem)] max-w-[360px] sm:bottom-6 sm:right-6">
          <div className="pointer-events-auto rounded-[28px] border border-white/60 bg-white/92 p-5 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.65)] backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Privacidade e LGPD</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Consulte fora do portal as diretrizes de privacidade, tratamento de dados e políticas de LGPD.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyNotice(false)}
                className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                aria-label="Fechar aviso de privacidade"
                title="Fechar aviso de privacidade"
              >
                Fechar
              </button>
            </div>
            <div className="mt-4">
              <Link
                href="/privacidade"
                className="inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Políticas de LGPD
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
