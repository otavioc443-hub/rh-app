"use client";

import { useState } from "react";
import { ChevronDown, MessageSquarePlus } from "lucide-react";
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
  const [expanded, setExpanded] = useState(initialItems.length > 0);

  async function handleSubmit() {
    if (!message.trim()) {
      setFeedback("Escreva seu comentario antes de enviar.");
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
      if (!response.ok || !json.item) throw new Error(json.error || "Falha ao enviar comentario.");
      setItems((current) => [...current, json.item!]);
      setMessage("");
      setExpanded(true);
      setFeedback("Comentario enviado. O time responsavel foi notificado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar comentario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-[#171717] p-6 text-white shadow-sm">
      <button type="button" onClick={() => setExpanded((current) => !current)} className="flex w-full items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white/80">
            <MessageSquarePlus size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Comentarios</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Dvidas e conversa desta aula</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60">{items.length} itens</span>
          <ChevronDown size={18} className={`text-white/65 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded ? (
        <div className="mt-5 space-y-5">
          <div className="space-y-3">
            {items.length ? (
              items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-800 bg-white/5 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">{item.author_name ?? "Colaborador"}</div>
                    <div className="text-xs text-white/45">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}
                    </div>
                  </div>
                  {item.author_role ? <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/35">{item.author_role}</div> : null}
                  <p className="mt-3 text-sm leading-6 text-white/80">{item.message}</p>
                  {item.admin_response ? (
                    <div className="mt-4 rounded-2xl border border-sky-900/40 bg-sky-950/20 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                          {item.status === "resolved" ? "Resposta final" : "Resposta do time"}
                        </div>
                        <div className="text-xs text-white/45">
                          {item.responder_name ?? "Time responsavel"}
                          {item.responded_at
                            ? ` · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.responded_at))}`
                            : ""}
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/80">{item.admin_response}</p>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-white/5 px-4 py-8 text-center text-sm text-white/45">
                Ainda nao ha comentarios nesta aula.
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-white/5 p-4">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escreva sua duvida ou observacao..."
              className="min-h-[110px] w-full rounded-2xl border border-slate-700 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/35"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {loading ? "Enviando..." : "Enviar comentario"}
              </button>
              {feedback ? <span className="text-sm text-white/60">{feedback}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
