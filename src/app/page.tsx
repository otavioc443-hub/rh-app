"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_AFTER_LOGIN = "/home";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        if (data.session?.user) router.replace(DEFAULT_AFTER_LOGIN);
      })
      .catch(console.error);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session?.user) router.replace(DEFAULT_AFTER_LOGIN);
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

      if (data.user) router.replace(DEFAULT_AFTER_LOGIN);
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
    setMsg("Enviamos um link de redefinicao para seu e-mail.");
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
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-6 mb-4">
              <img src="/logo.png" alt="Solida" className="h-16 w-auto" />

              <span className="h-12 w-[2px] bg-slate-300" />

              <img src="/logo2.png" alt="Area" className="h-12 w-auto" />
            </div>

            <p className="mt-1 text-sm text-gray-600">Acesso ao Portal de RH</p>
          </div>

          <form onSubmit={signIn} className="mt-6 space-y-3">
            <input
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />

            <input
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
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
              className="w-full px-4 py-3 rounded-lg bg-black text-white font-medium disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {msg && (
              <p className={`text-sm mt-2 text-center ${msgType === "success" ? "text-emerald-700" : "text-red-600"}`}>
                {msg}
              </p>
            )}

            <p className="text-xs text-gray-500 mt-4 text-center">
              Ao acessar, voce concorda com as diretrizes internas de uso.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
