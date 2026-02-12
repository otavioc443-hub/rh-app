"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function sanitizeRedirect(path: string | null) {
  const fallback = "/perfil";
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;

  // bloqueia rotas que podem causar loop
  const blocked = ["/", "/auth", "/auth/callback", "/set-password"];
  if (blocked.some((b) => path === b || path.startsWith(b + "/"))) return fallback;

  if (path.includes("http://") || path.includes("https://")) return fallback;
  return path;
}

export default function SetPasswordPage() {
  const router = useRouter();

  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // destino final após definir senha
  const finalRedirect = useMemo(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirectedFrom")
        : null;
    const fromLS =
      typeof window !== "undefined" ? localStorage.getItem("redirectedFrom") : null;

    return sanitizeRedirect(fromQuery || fromLS);
  }, []);

  useEffect(() => {
    async function check() {
      async function tryRecoverSessionFromUrl() {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (tokenHash && type) {
          await supabase.auth.verifyOtp({
            type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
            token_hash: tokenHash,
          });
          return;
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }

      let { data } = await supabase.auth.getUser();

      if (!data.user) {
        await tryRecoverSessionFromUrl();
        const secondTry = await supabase.auth.getUser();
        data = secondTry.data;
      }

      if (!data.user) {
        setMsg("Link de redefinicao invalido ou expirado. Solicite um novo link.");
        setLoading(false);
        return;
      }

      setLoading(false);
    }

    check();
  }, [router]);

  async function save() {
    setMsg("");

    if (pass1.length < 6) {
      setMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (pass1 !== pass2) {
      setMsg("As senhas não conferem.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pass1 });
    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Senha definida com sucesso! Redirecionando...");

    // limpa o destino após usar (boa prática)
    try {
      localStorage.removeItem("redirectedFrom");
    } catch {}

    setTimeout(() => router.replace(finalRedirect), 600);
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4">
          <p className="text-sm text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Definir senha</h1>
        <p className="mt-1 text-sm text-slate-600">
          Crie uma senha para acessar o Portal de RH.
        </p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-300"
            placeholder="Nova senha"
            type="password"
            value={pass1}
            onChange={(e) => setPass1(e.target.value)}
            disabled={saving}
          />
          <input
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-300"
            placeholder="Confirmar senha"
            type="password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            disabled={saving}
          />

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar senha"}
          </button>

          {msg && <p className="text-sm text-slate-700 text-center">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
