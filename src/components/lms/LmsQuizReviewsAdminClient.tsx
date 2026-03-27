"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import type { LmsQuizReviewRow } from "@/lib/lms/types";

function reviewStatusLabel(status?: string | null) {
  if (status === "reviewed") return "Revisada";
  if (status === "auto_graded") return "Corrigida automaticamente";
  return "Aguardando revisao";
}

function reviewStatusClasses(status?: string | null) {
  if (status === "reviewed") return "bg-emerald-100 text-emerald-700";
  if (status === "auto_graded") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

export function LmsQuizReviewsAdminClient({ rows }: { rows: LmsQuizReviewRow[] }) {
  const [items, setItems] = useState(rows);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return items.filter((row) => {
      if (!normalized) return true;
      return `${row.user_name} ${row.course_title} ${row.lesson_title ?? ""} ${row.quiz.title}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [items, search]);

  async function handleReview(row: LmsQuizReviewRow) {
    const score = Number(scores[row.attempt.id] ?? row.attempt.reviewed_score ?? row.attempt.score ?? 0);
    setSavingId(row.attempt.id);
    setFeedback((current) => ({ ...current, [row.attempt.id]: "" }));
    try {
      const response = await fetch(`/api/lms/admin/quiz-attempts/${row.attempt.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          reviewerComment: comments[row.attempt.id] ?? "",
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { item?: LmsQuizReviewRow; error?: string };
      if (!response.ok || !json.item) throw new Error(json.error || "Falha ao revisar a avaliacao.");
      setItems((current) => current.map((item) => (item.attempt.id === row.attempt.id ? json.item! : item)));
      setFeedback((current) => ({ ...current, [row.attempt.id]: "Avaliacao revisada com sucesso." }));
    } catch (error) {
      setFeedback((current) => ({ ...current, [row.attempt.id]: error instanceof Error ? error.message : "Falha ao revisar a avaliacao." }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ClipboardCheck size={22} />}
        title="Correcoes de avaliacao"
        subtitle="Revise respostas discursivas, publique a nota final e libere o resultado para o colaborador."
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por colaborador, curso, aula ou avaliacao"
          className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
        />
      </div>

      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Colaborador</th>
                <th className="px-6 py-3">Curso</th>
                <th className="px-6 py-3">Avaliacao</th>
                <th className="px-6 py-3">Tentativa</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Acao</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const expanded = activeId === row.attempt.id;
                  const currentScore = scores[row.attempt.id] ?? String(row.attempt.reviewed_score ?? row.attempt.score ?? 0);
                  return (
                    <>
                      <tr key={row.attempt.id} className="border-t border-slate-100 align-top">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{row.user_name}</div>
                          {row.user_role ? <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{row.user_role}</div> : null}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{row.course_title}</td>
                        <td className="px-6 py-4 text-slate-700">
                          <div>{row.quiz.title}</div>
                          {row.lesson_title ? <div className="mt-1 text-xs text-slate-500">{row.lesson_title}</div> : null}
                        </td>
                        <td className="px-6 py-4 text-slate-700">#{row.attempt.attempt_number}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${reviewStatusClasses(row.attempt.review_status)}`}>
                            {reviewStatusLabel(row.attempt.review_status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => setActiveId(expanded ? null : row.attempt.id)}
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800"
                          >
                            {expanded ? "Fechar" : "Corrigir"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-slate-100 bg-slate-50/70">
                          <td colSpan={6} className="px-6 py-5">
                            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                                {row.questions.map((question, index) => (
                                  <div key={question.id} className="rounded-2xl border border-slate-100 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pergunta {index + 1}</div>
                                    <div className="mt-2 text-sm font-semibold text-slate-900">{question.statement}</div>
                                    {question.help_text ? <div className="mt-2 text-xs text-slate-500">{question.help_text}</div> : null}
                                    <div className="mt-3 space-y-2">
                                      {question.submitted_answers.length ? (
                                        question.submitted_answers.map((answer, answerIndex) => (
                                          <div key={`${question.id}-${answerIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                                            {answer.answer_text || question.options.find((option) => option.id === answer.option_id)?.text || "Sem resposta"}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
                                          Sem resposta registrada.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Orientacao</div>
                                  <div className="mt-2 text-sm text-slate-700">
                                    Defina a nota final da tentativa e registre um comentario curto para o colaborador.
                                  </div>
                                </div>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold text-slate-800">Nota final da tentativa</span>
                                  <input
                                    type="number"
                                    value={currentScore}
                                    onChange={(event) => setScores((current) => ({ ...current, [row.attempt.id]: event.target.value }))}
                                    className="h-12 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
                                  />
                                </label>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold text-slate-800">Comentario do revisor</span>
                                  <textarea
                                    value={comments[row.attempt.id] ?? row.attempt.reviewer_comment ?? ""}
                                    onChange={(event) => setComments((current) => ({ ...current, [row.attempt.id]: event.target.value }))}
                                    className="min-h-[140px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                                    placeholder="Explique o resultado, pontos fortes e o que precisa ser ajustado."
                                  />
                                </label>
                                <button
                                  type="button"
                                  disabled={savingId === row.attempt.id}
                                  onClick={() => void handleReview(row)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                  <CheckCircle2 size={16} />
                                  {savingId === row.attempt.id ? "Salvando..." : "Salvar revisao"}
                                </button>
                                {feedback[row.attempt.id] ? <div className="text-sm text-slate-600">{feedback[row.attempt.id]}</div> : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    Nenhuma avaliacao aguardando revisao manual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </TableShell>
    </div>
  );
}
