"use client";

type Props = {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  onLogin: () => void;
  loading: boolean;
  msg: string;
};

export default function OldLoginLayout({
  email,
  setEmail,
  password,
  setPassword,
  onLogin,
  loading,
  msg,
}: Props) {
  return (
    <main className="min-h-screen w-full bg-[#EDEDED]">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[520px_1fr]">
        {/* ESQUERDA */}
        <section className="bg-[#EDEDED] flex items-center justify-center p-10">
          <div className="w-full max-w-[420px]">
            <div className="rounded-2xl border border-[#2b2b2b]/50 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] p-10">
              {/* Logos */}
              <div className="flex items-center justify-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Sólida"
                  className="h-12 w-auto object-contain"
                />
                <div className="h-9 w-px bg-gray-300" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo2.png"
                  alt="Área"
                  className="h-11 w-auto object-contain"
                />
              </div>

              <p className="mt-4 text-center text-sm text-gray-600">
                Acesso ao Portal de RH
              </p>

              {/* Inputs */}
              <div className="mt-8 space-y-4">
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-400"
                  placeholder="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />

                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-400"
                  placeholder="Senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onLogin();
                  }}
                />

                <button
                  onClick={onLogin}
                  disabled={loading || !email.trim() || !password}
                  className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>

                {msg && <p className="text-sm text-center text-gray-700">{msg}</p>}

                <p className="mt-2 text-xs text-gray-500 text-center">
                  Ao acessar, você concorda com as diretrizes internas de uso.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DIREITA (✅ SEM CORTE — igual à referência) */}
        <section className="hidden lg:flex bg-[#EDEDED] items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fundo.jpg"
            alt="Equipe"
            className="h-full w-full object-contain"
          />
        </section>
      </div>
    </main>
  );
}
