"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  clearPortalExitIntent,
  clearRecentLoginMarker,
  forceClientLogout,
  hasPortalExitIntent,
  markRecentLogin,
  supabase,
} from "@/lib/supabaseClient";

const DEFAULT_AFTER_LOGIN = "/home";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        if (!data.session?.user) return;
        if (hasPortalExitIntent()) {
          clearPortalExitIntent();
          clearRecentLoginMarker();
          await forceClientLogout();
          return;
        }
        router.replace(DEFAULT_AFTER_LOGIN);
      })
      .catch(console.error);

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;
      if (!session?.user) return;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        clearPortalExitIntent();
        markRecentLogin();
        router.replace(DEFAULT_AFTER_LOGIN);
        return;
      }
      router.replace(DEFAULT_AFTER_LOGIN);
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
        markRecentLogin();
        router.replace(DEFAULT_AFTER_LOGIN);
      }
    } catch (err) {
      console.error(err);
      setMsg("Erro inesperado ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordRecovery() {
    setMsg("");
    setMsgType("error");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMsg("Informe seu e-mail para redefinir a senha.");
      return;
    }

    setRecoveryLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    setRecoveryLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsgType("success");
    setMsg("Enviamos um link de redefinição para seu e-mail.");
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
                className="w-full rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />

              <input
                className="w-full rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={sendPasswordRecovery}
                  disabled={loading || recoveryLoading}
                  className="text-xs font-medium text-slate-700 underline underline-offset-2 disabled:opacity-50"
                >
                  {recoveryLoading ? "Enviando..." : "Esqueci minha senha"}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || recoveryLoading || !email.trim() || !password}
                className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
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
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Acesso institucional</p>
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
