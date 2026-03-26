"use client";

import { useState } from "react";
import type { LmsLessonDiscussion } from "@/lib/lms/types";

export function LessonDiscussionPanel({
  courseId,
  lessonId,
  initialItems,
}: {
  courseId: string;
  lessonId: string;
  initialItems: LmsLessonDiscussion[];
}) {
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit() {
    if (!message.trim()) {
      setFeedback("Escreva sua duvida antes de enviar.");
      return;
    }

    setLoading(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/lms/lessons/${lessonId}/discussion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, message }),
      });
      const json = (await response.json().catch(() => ({}))) as { item?: LmsLessonDiscussion; error?: string };
      if (!response.ok || !json.item) throw new Error(json.error || "Falha ao enviar duvida.");
      setItems((current) => [...current, json.item!]);
      setMessage("");
      setFeedback("Duvida enviada. O time responsavel foi notificado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar duvida.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Duvidas da aula</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">Perguntas e orientacoes</h3>
        <p className="mt-1 text-sm text-slate-600">
          Registre aqui qualquer duvida sobre o conteudo. O RH e os responsaveis do treinamento recebem essa sinalizacao no portal.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{item.author_name ?? "Colaborador"}</div>
                <div className="text-xs text-slate-500">
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}
                </div>
              </div>
              {item.author_role ? <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{item.author_role}</div> : null}
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.message}</p>
              {item.admin_response ? (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                      {item.status === "resolved" ? "Resposta final" : "Resposta do time"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.responder_name ?? "Time responsável"}
                      {item.responded_at
                        ? ` · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.responded_at))}`
                        : ""}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.admin_response}</p>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Ainda nao ha duvidas registradas nesta aula.
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Escreva sua duvida, comentario ou ponto que precisa de esclarecimento."
          className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Enviando..." : "Enviar duvida"}
          </button>
          {feedback ? <span className="text-sm text-slate-600">{feedback}</span> : null}
        </div>
      </div>
    </section>
  );
}
