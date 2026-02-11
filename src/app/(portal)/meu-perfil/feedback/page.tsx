"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  full_name?: string;
  avatar_url?: string;
};

type CriterionKey =
  | "clima"
  | "lideranca"
  | "comunicacao"
  | "processos"
  | "bemestar"
  | "treinamento";

const CRITERIA: { key: CriterionKey; label: string; helper?: string }[] = [
  { key: "clima", label: "Clima e Cultura", helper: "Como você percebe o ambiente e relações no dia a dia?" },
  { key: "lideranca", label: "Liderança", helper: "Clareza, apoio, direcionamento e exemplo." },
  { key: "comunicacao", label: "Comunicação", helper: "Informações chegam com clareza e no tempo certo?" },
  { key: "processos", label: "Processos", helper: "Fluxos funcionam bem? Há burocracia excessiva?" },
  { key: "bemestar", label: "Bem-estar", helper: "Rotina saudável, equilíbrio e respeito." },
  { key: "treinamento", label: "Treinamento e Desenvolvimento", helper: "Oportunidades de aprender e evoluir." },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export default function FeedbackPage() {
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({ full_name: "", avatar_url: "" });

  const [scores, setScores] = useState<Record<CriterionKey, number>>({
    clima: 5,
    lideranca: 5,
    comunicacao: 5,
    processos: 5,
    bemestar: 5,
    treinamento: 5,
  });

  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");

  function hydrateFromUser(user: any) {
    setUserEmail(user?.email ?? null);
    setUserId(user?.id ?? null);

    const md = (user?.user_metadata ?? {}) as Record<string, any>;
    const full_name = (md.full_name || md.name || "").toString();
    const avatar_url = (md.avatar_url || md.picture || "").toString();

    setProfile({ full_name, avatar_url });
  }

  async function refreshProfile() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user) hydrateFromUser(user);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      if (data.user) hydrateFromUser(data.user);
      setBooting(false);
    }

    init();

    // ✅ atualiza automaticamente quando sessão muda (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user) hydrateFromUser(user);
      else {
        setUserEmail(null);
        setUserId(null);
        setProfile({ full_name: "", avatar_url: "" });
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const displayName = useMemo(() => {
    const name = profile.full_name?.trim();
    if (name) return name;
    if (userEmail) return userEmail.split("@")[0];
    return "Colaborador";
  }, [profile.full_name, userEmail]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  function setScore(key: CriterionKey, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!userId) {
      setMsg("Você precisa estar logado para enviar feedback.");
      return;
    }

    if (!comment.trim()) {
      setMsg("Escreva um comentário geral antes de enviar.");
      return;
    }

    setLoading(true);

    const payload = {
      user_id: userId,
      user_email: userEmail,
      scores,
      comment: comment.trim(),
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("feedbacks").insert([payload]);

    setLoading(false);

    if (error) {
      setMsg("Erro ao enviar: " + error.message);
      return;
    }

    setComment("");
    setScores({
      clima: 5,
      lideranca: 5,
      comunicacao: 5,
      processos: 5,
      bemestar: 5,
      treinamento: 5,
    });
    setMsg("Feedback enviado com sucesso ✅ Obrigado!");

    // opcional: atualiza perfil se algo mudou no metadata
    refreshProfile();
  }

  if (booting) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white border rounded-2xl shadow p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold">Feedback</h1>
          <p className="mt-2 text-gray-600">Carregando…</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/fundo.jpg')" }}
    >
      {/* fundo mais apagado */}
      <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px]" />

      {/* logos topo direito */}
      <div className="fixed top-5 right-6 z-50 flex items-center gap-4 bg-white/85 backdrop-blur-md border rounded-xl px-4 py-2 shadow">
        <img src="/logo.png" alt="Sólida" className="h-8 w-auto object-contain" />
        <div className="h-6 w-px bg-gray-300" />
        <img src="/logo2.png" alt="Área" className="h-7 w-auto object-contain" />
      </div>

      {/* sidebar fixa canto esquerdo */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-[300px] border-r bg-white/92 backdrop-blur-md shadow-sm p-6">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="h-14 w-14 rounded-full object-cover border"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-black text-white flex items-center justify-center font-semibold">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{displayName}</p>
            <p className="text-xs text-gray-600 truncate">
              {userEmail ? userEmail : "Não logado"}
            </p>
          </div>
        </div>

        <div className="mt-5 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">SER – Feedback</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            Suas respostas ajudam a fortalecer cultura, processos e bem-estar.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <a href="/perfil" className="text-sm underline">
            Meu Perfil
          </a>
          <a href="/" className="text-sm underline">
            Voltar
          </a>
        </div>
      </aside>

      {/* conteúdo com espaço para sidebar e topo */}
      <div className="relative z-10 ml-[300px] min-h-screen px-8 py-10 pt-24">
        <div className="max-w-5xl">
          <section className="bg-white/96 backdrop-blur-md border rounded-2xl shadow-lg p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Feedback</h1>
                <p className="text-sm text-gray-600 mt-2">
                  {userEmail
                    ? "Avalie todos os critérios abaixo e deixe um comentário geral."
                    : "Você não está logado. Faça login na Home para responder."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              <div className="space-y-7">
                {CRITERIA.map((c) => (
                  <div key={c.key} className="border rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-semibold">{c.label}</p>
                        {c.helper && (
                          <p className="text-xs text-gray-600 mt-1">{c.helper}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setScore(c.key, n)}
                            className={`h-11 w-11 rounded-xl border transition ${
                              scores[c.key] === n
                                ? "bg-black text-white"
                                : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-sm font-medium">Comentário geral</label>
                <textarea
                  className="mt-2 w-full border rounded-xl p-4 min-h-[220px]"
                  placeholder="Descreva sugestões, pontos de atenção e exemplos práticos…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Dica: cite situações (sem expor pessoas) e proponha melhorias.
                </p>
              </div>

              <button
                disabled={loading || !userId}
                className="w-full px-4 py-4 rounded-xl bg-black text-white font-medium disabled:opacity-60"
                type="submit"
              >
                {loading ? "Enviando..." : "Enviar feedback"}
              </button>

              {msg && <p className="text-sm text-center">{msg}</p>}

              <p className="text-xs text-gray-500 text-center">
                Ao enviar, você concorda com as diretrizes internas de uso.
              </p>
            </form>
          </section>

          <div className="h-10" />
        </div>
      </div>
    </main>
  );
}
