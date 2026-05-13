"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { forceClientLogout, markPasswordRecoveryIntent, supabase } from "@/lib/supabaseClient";

const PORTAL_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rh-app-seven.vercel.app").replace(/\/$/, "");
const RATE_LIMIT_SECONDS = 60;

function getInitialEmail() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("email")?.trim().toLowerCase() ?? "";
}

function getLastRecoverySentAt() {
  if (typeof window === "undefined") return 0;
  return Number(window.sessionStorage.getItem("password_recovery_sent_at") ?? "0") || 0;
}

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState(getInitialEmail);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const elapsed = Math.floor((Date.now() - getLastRecoverySentAt()) / 1000);
      setSecondsLeft(Math.max(0, RATE_LIMIT_SECONDS - elapsed));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const canSend = useMemo(() => Boolean(email.trim()) && !loading && secondsLeft === 0, [email, loading, secondsLeft]);

  async function sendRecovery(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setSuccess(false);
      setMessage("Informe seu e-mail para redefinir a senha.");
      return;
    }

    setLoading(true);
    setSuccess(false);
    setMessage("");

    await forceClientLogout();
    markPasswordRecoveryIntent();
    const redirectTo = `${PORTAL_ORIGIN}/auth/recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.sessionStorage.setItem("password_recovery_sent_at", String(Date.now()));
    setSecondsLeft(RATE_LIMIT_SECONDS);
    setSuccess(true);
    setMessage("Enviamos um link seguro para criar uma nova senha. Verifique sua caixa de entrada e o spam.");
  }

  return (
    <main className="relative min-h-screen w-full bg-[url('/bg-login.jpg')] bg-cover bg-center bg-no-repeat">
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative flex min-h-screen w-full items-center justify-start p-6 md:pl-24">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex items-center justify-center gap-6">
              <Image src="/logo.png" alt="Solida" width={160} height={64} className="h-16 w-auto" />
              <span className="h-12 w-[2px] bg-slate-300" />
              <Image src="/logo2.png" alt="Area" width={120} height={48} className="h-12 w-auto" />
            </div>
            <h1 className="text-xl font-semibold text-slate-950">Recuperar senha</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Informe seu e-mail cadastrado para receber um link de criação de nova senha.
            </p>
          </div>

          <form onSubmit={sendRecovery} className="mt-6 space-y-3">
            <input
              className="w-full rounded-lg border p-3 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="E-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              <MailCheck size={18} />
              {loading ? "Enviando..." : secondsLeft > 0 ? `Aguarde ${secondsLeft}s` : "Enviar link de redefinição"}
            </button>

            {message ? (
              <p className={`text-center text-sm ${success ? "text-emerald-700" : "text-red-600"}`}>{message}</p>
            ) : null}
          </form>

          <Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:underline">
            <ArrowLeft size={16} />
            Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  );
}
