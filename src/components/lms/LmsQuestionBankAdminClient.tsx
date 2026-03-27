"use client";

import { useState } from "react";
import type { LmsQuestionBankItem } from "@/lib/lms/types";

export function LmsQuestionBankAdminClient({ items: initialItems }: { items: LmsQuestionBankItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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
      <div className="grid gap-4">
        {items.map((item) => (
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
        {!items.length ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Nenhuma pergunta salva no banco ainda.
          </div>
        ) : null}
      </div>
    </div>
  );
}
