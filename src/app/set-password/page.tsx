"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Circle, Eye, EyeOff } from "lucide-react";
import {
  clearPasswordRecoveryIntent,
  clearPortalExitIntent,
  markPasswordRecoveryIntent,
  markRecentLogin,
  supabase,
} from "@/lib/supabaseClient";

function sanitizeRedirect(path: string | null) {
  const fallback = "/home";
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;

  const blocked = ["/", "/auth", "/auth/callback", "/set-password"];
  if (blocked.some((b) => path === b || path.startsWith(b + "/"))) return fallback;

  if (path.includes("http://") || path.includes("https://")) return fallback;
  return path;
}

function passwordValidationMessage(value: string) {
  if (value.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "Inclua pelo menos uma letra maiuscula.";
  if (!/[a-z]/.test(value)) return "Inclua pelo menos uma letra minuscula.";
  if (!/[0-9]/.test(value)) return "Inclua pelo menos um numero.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Inclua pelo menos um caractere especial.";
  return null;
}

function passwordChecklist(value: string, confirmValue: string) {
  return [
    { label: "Pelo menos 8 caracteres", done: value.length >= 8 },
    { label: "Uma letra maiuscula", done: /[A-Z]/.test(value) },
    { label: "Uma letra minuscula", done: /[a-z]/.test(value) },
    { label: "Um numero", done: /[0-9]/.test(value) },
    { label: "Um caractere especial", done: /[^A-Za-z0-9]/.test(value) },
    { label: "Senhas iguais", done: Boolean(value) && value === confirmValue },
  ];
}

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("auth session missing") || lower.includes("session") || lower.includes("expired")) {
    return "Sua sessao de redefinicao expirou ou o link ja foi usado. Solicite um novo link para definir a senha.";
  }
  return message;
}

function passwordStrength(value: string) {
  const completed = passwordChecklist(value, value).slice(0, 5).filter((item) => item.done).length;
  if (!value) return { label: "Informe uma senha", width: "0%", color: "bg-slate-200" };
  if (completed <= 2) return { label: "Senha fraca", width: "33%", color: "bg-rose-500" };
  if (completed <= 4) return { label: "Senha boa", width: "66%", color: "bg-amber-500" };
  return { label: "Senha forte", width: "100%", color: "bg-emerald-600" };
}

function isSessionMessage(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("expirado") || lower.includes("invalido") || lower.includes("sessao");
}

export default function SetPasswordPage() {
  const router = useRouter();

  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (code) {
          markPasswordRecoveryIntent();
          await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, document.title, "/set-password");
          return;
        }

        if (tokenHash && type) {
          markPasswordRecoveryIntent();
          await supabase.auth.verifyOtp({
            type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
            token_hash: tokenHash,
          });
          window.history.replaceState({}, document.title, "/set-password");
          return;
        }

        if (accessToken && refreshToken) {
          markPasswordRecoveryIntent();
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          window.history.replaceState({}, document.title, "/set-password");
        }
      }

      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (url.searchParams.get("flow") === "recovery") markPasswordRecoveryIntent();
      const hasAuthParams = Boolean(
        url.searchParams.get("code") ||
          url.searchParams.get("token_hash") ||
          hash.get("access_token")
      );

      if (hasAuthParams) {
        await tryRecoverSessionFromUrl();
      }

      let { data } = await supabase.auth.getUser();

      if (!data.user) {
        await tryRecoverSessionFromUrl();
        const secondTry = await supabase.auth.getUser();
        data = secondTry.data;
      }

      if (!data.user) {
        setMsg("Link de redefinicao invalido ou expirado. Solicite um novo link.");
        setLinkInvalid(true);
        setLoading(false);
        return;
      }

      setUserEmail(data.user.email ?? null);
      setLinkInvalid(false);
      clearPortalExitIntent();
      setLoading(false);
    }

    check();
  }, [router]);

  async function save() {
    setMsg("");
    setSuccess(false);

    const validation = passwordValidationMessage(pass1);
    if (validation) {
      setMsg(validation);
      return;
    }
    if (pass1 !== pass2) {
      setMsg("As senhas nao conferem.");
      return;
    }

    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const message = "Sua sessao de redefinicao expirou ou o link ja foi usado. Solicite um novo link para definir a senha.";
      setMsg(message);
      setLinkInvalid(true);
      setSaving(false);
      console.warn("Falha ao redefinir senha: sessao ausente antes de salvar.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: pass1 });
    setSaving(false);

    if (error) {
      const friendlyMessage = friendlyAuthError(error.message);
      setMsg(friendlyMessage);
      if (isSessionMessage(friendlyMessage)) setLinkInvalid(true);
      console.warn("Falha ao redefinir senha:", error.message);
      return;
    }

    setMsg("Senha definida com sucesso. Voce sera direcionado para o portal.");
    setSuccess(true);
    setLinkInvalid(false);
    clearPortalExitIntent();
    clearPasswordRecoveryIntent();
    markRecentLogin();

    try {
      localStorage.removeItem("redirectedFrom");
    } catch {}

    setTimeout(() => router.replace(finalRedirect), 600);
  }

  const checks = passwordChecklist(pass1, pass2);
  const strength = passwordStrength(pass1);
  const canSave = checks.every((item) => item.done) && !saving && !linkInvalid && !success;

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
        {userEmail ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Definindo senha para <span className="font-semibold text-slate-900">{userEmail}</span>
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {linkInvalid ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 shrink-0" size={17} />
                <div>
                  <p className="font-semibold">Este link expirou ou ja foi usado.</p>
                  <p className="mt-1 text-xs leading-5">Solicite um novo link para continuar com a redefinicao da senha.</p>
                </div>
              </div>
              <Link href="/recuperar-senha" className="mt-3 block rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white">
                Solicitar novo link
              </Link>
            </div>
          ) : null}

          <div className="relative">
            <input
              className="w-full rounded-xl border border-slate-200 p-3 pr-12 text-sm outline-none focus:border-slate-300"
              placeholder="Nova senha"
              type={showPass1 ? "text" : "password"}
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              disabled={saving || linkInvalid || success}
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPass1 ? "Ocultar senha" : "Visualizar senha"}
              title={showPass1 ? "Ocultar senha" : "Visualizar senha"}
              onClick={() => setShowPass1((value) => !value)}
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              disabled={saving || linkInvalid || success}
            >
              {showPass1 ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-slate-200 p-3 pr-12 text-sm outline-none focus:border-slate-300"
              placeholder="Confirmar senha"
              type={showPass2 ? "text" : "password"}
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              disabled={saving || linkInvalid || success}
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPass2 ? "Ocultar senha" : "Visualizar senha"}
              title={showPass2 ? "Ocultar senha" : "Visualizar senha"}
              onClick={() => setShowPass2((value) => !value)}
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              disabled={saving || linkInvalid || success}
            >
              {showPass2 ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
            </div>
            <p className="mt-1 text-xs font-medium text-slate-600">{strength.label}</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <ul className="space-y-2">
              {checks.map((item) => {
                const Icon = item.done ? CheckCircle2 : Circle;
                return (
                  <li key={item.label} className={item.done ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2 text-slate-500"}>
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            onClick={save}
            disabled={!canSave}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar senha"}
          </button>

          {msg ? <p className="text-sm text-slate-700 text-center">{msg}</p> : null}
          {success ? (
            <button
              type="button"
              onClick={() => router.replace(finalRedirect)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ir para o portal
            </button>
          ) : null}
          {isSessionMessage(msg) && !linkInvalid ? (
            <Link href="/recuperar-senha" className="block text-center text-sm font-semibold text-slate-900 underline underline-offset-2">
              Solicitar novo link
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
