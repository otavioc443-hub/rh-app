"use client";

import { useMemo, useState } from "react";
import type { LmsQuestionBankItem } from "@/lib/lms/types";

export function LmsQuestionBankAdminClient({ items: initialItems }: { items: LmsQuestionBankItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [questionType, setQuestionType] = useState("all");
  const [reviewMode, setReviewMode] = useState("all");
  const [mediaMode, setMediaMode] = useState("all");
  const [reuseMode, setReuseMode] = useState("all");
  const [author, setAuthor] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "usage">("recent");
  const authors = useMemo(() => Array.from(new Set(items.map((item) => item.author_name).filter(Boolean))).sort(), [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const matchesSearch =
          !normalizedSearch ||
          [item.title, item.statement, item.author_name ?? "", item.help_text ?? ""].join(" ").toLowerCase().includes(normalizedSearch);
        const matchesType = questionType === "all" || item.question_type === questionType;
        const matchesReview =
          reviewMode === "all" ||
          (reviewMode === "manual" && !!item.requires_manual_review) ||
          (reviewMode === "automatic" && !item.requires_manual_review);
        const hasMedia = Boolean(item.image_url || item.options.some((option) => option.image_url));
        const matchesMedia = mediaMode === "all" || (mediaMode === "with_media" ? hasMedia : !hasMedia);
        const wasReused = (item.usage_count ?? 0) > 0;
        const matchesReuse = reuseMode === "all" || (reuseMode === "reused" ? wasReused : !wasReused);
        const matchesAuthor = author === "all" || item.author_name === author;
        return matchesSearch && matchesType && matchesReview && matchesMedia && matchesReuse && matchesAuthor;
      })
      .sort((left, right) => {
        if (sortBy === "usage") return (right.usage_count ?? 0) - (left.usage_count ?? 0);
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      });
  }, [author, items, mediaMode, questionType, reviewMode, reuseMode, search, sortBy]);

  const manualReviewCount = items.filter((item) => item.requires_manual_review).length;
  const reusableCount = items.filter((item) => (item.usage_count ?? 0) > 0).length;

  async function handleDelete(id: string) {
    setLoadingId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/lms/admin/question-bank/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao remover pergunta.");
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Pergunta removida do banco.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao remover pergunta.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
      <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Curadoria de perguntas</div>
          <h2 className="mt-3 text-2xl font-semibold">Organize o banco como um acervo confiavel para o RH.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
            Aqui vale manter perguntas realmente reaproveitaveis, com boa redacao, metodo de correcao claro e nivel de exigencia coerente com a jornada.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Itens totais</div>
              <div className="mt-2 text-2xl font-semibold">{items.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Com revisao manual</div>
              <div className="mt-2 text-2xl font-semibold">{manualReviewCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Ja reutilizadas</div>
              <div className="mt-2 text-2xl font-semibold">{reusableCount}</div>
            </div>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Refinar busca</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Encontre a pergunta certa mais rapido</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por titulo, enunciado ou autor"
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select value={questionType} onChange={(event) => setQuestionType(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="all">Todos os tipos</option>
                <option value="single_choice">Objetiva</option>
                <option value="multiple_choice">Multipla escolha</option>
                <option value="true_false">Verdadeiro ou falso</option>
                <option value="short_text">Resposta curta</option>
                <option value="essay">Discursiva</option>
                <option value="image_choice">Escolha por imagem</option>
              </select>
              <select value={reviewMode} onChange={(event) => setReviewMode(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="all">Toda correcao</option>
                <option value="automatic">Correcao automatica</option>
                <option value="manual">Revisao manual</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select value={mediaMode} onChange={(event) => setMediaMode(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="all">Com ou sem imagem</option>
                <option value="with_media">Somente com imagem</option>
                <option value="without_media">Somente sem imagem</option>
              </select>
              <select value={reuseMode} onChange={(event) => setReuseMode(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="all">Todas as reutilizacoes</option>
                <option value="reused">Ja reutilizadas</option>
                <option value="fresh">Ainda nao reutilizadas</option>
              </select>
              <select value={author} onChange={(event) => setAuthor(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
                <option value="all">Todos os autores</option>
                {authors.map((item) => (
                  <option key={item} value={item ?? ""}>{item}</option>
                ))}
              </select>
            </div>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "recent" | "usage")} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900">
              <option value="recent">Ordenar por atualizacao recente</option>
              <option value="usage">Ordenar por mais reutilizadas</option>
            </select>
          </div>
        </div>
      </section>
      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {item.author_name ?? "Sem autor"} | {item.question_type} | {item.usage_count ?? 0} uso(s)
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                disabled={loadingId === item.id}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {loadingId === item.id ? "Removendo..." : "Remover"}
              </button>
            </div>
            <div className="mt-4 text-sm font-medium text-slate-900">{item.statement}</div>
            {item.help_text ? <div className="mt-2 text-sm text-slate-600">{item.help_text}</div> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">{item.question_type}</span>
              <span className={`rounded-full px-3 py-1 font-semibold ${item.requires_manual_review ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {item.requires_manual_review ? "Revisao manual" : "Correcao automatica"}
              </span>
              <span className={`rounded-full px-3 py-1 font-semibold ${(item.usage_count ?? 0) > 0 ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                {(item.usage_count ?? 0) > 0 ? `${item.usage_count ?? 0} reutilizacao(oes)` : "Ainda nao reutilizada"}
              </span>
              {item.image_url || item.options.some((option) => option.image_url) ? (
                <span className="rounded-full bg-fuchsia-100 px-3 py-1 font-semibold text-fuchsia-700">Com apoio visual</span>
              ) : null}
            </div>
            {item.options.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {item.options.map((option) => (
                  <div key={option.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {option.text} {option.is_correct ? <strong className="text-emerald-700">| correta</strong> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {!filteredItems.length ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Nenhuma pergunta encontrada com esse recorte.
          </div>
        ) : null}
      </div>
    </div>
  );
}
