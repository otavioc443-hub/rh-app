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
  const [loading, setLoading] = useState(false);

  // ✅ mais confiável que getSession no load: escuta mudanças de auth
  useEffect(() => {
    let alive = true;

    // log rápido para depurar sessão
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        console.log("ON LOAD SESSION:", data.session?.user?.id);
        if (data.session?.user) router.replace(DEFAULT_AFTER_LOGIN);
      })
      .catch(console.error);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      console.log("AUTH STATE:", _event, session?.user?.id);
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
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      console.log("AUTH DATA:", data);
      console.log("AUTH ERROR:", error);

      if (error) {
        setMsg(error.message);
        return;
      }

      // ✅ força sincronizar a sessão antes de redirecionar
      const { data: sess } = await supabase.auth.getSession();
      console.log("SESSION USER:", sess.session?.user?.id);

      if (!sess.session?.user) {
        setMsg("Login realizado, mas a sessão não foi persistida. Verifique cookies/domínio.");
        return;
      }

      router.replace(DEFAULT_AFTER_LOGIN);
      router.refresh();
    } catch (err) {
      console.error(err);
      setMsg("Erro inesperado ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="
        relative min-h-screen w-full
        bg-[url('/bg-login.jpg')] bg-cover bg-center bg-no-repeat
      "
    >
      {/* overlay escuro */}
      <div className="absolute inset-0 bg-black/25" />

      {/* conteúdo */}
      <div className="relative min-h-screen w-full flex items-center justify-start p-6 md:pl-24">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-8">
          {/* Logos */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-6 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Sólida" className="h-16 w-auto" />

              <span className="h-12 w-[2px] bg-slate-300" />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo2.png" alt="Área" className="h-12 w-auto" />
            </div>

            <p className="mt-1 text-sm text-gray-600">Acesso ao Portal de RH</p>
          </div>

          {/* Form */}
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

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full px-4 py-3 rounded-lg bg-black text-white font-medium disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {msg && <p className="text-sm mt-2 text-center text-red-600">{msg}</p>}

            <p className="text-xs text-gray-500 mt-4 text-center">
              Ao acessar, você concorda com as diretrizes internas de uso.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
