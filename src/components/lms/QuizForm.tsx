"use client";

import { useState } from "react";
import type { LmsQuizPayload } from "@/lib/lms/types";
import { quizzesService } from "@/lib/lms/quizzesService";

export function QuizForm({ payload }: { payload: LmsQuizPayload }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  async function handleSubmit() {
    setLoading(true);
    try {
      const response = await quizzesService.submit(payload.quiz.id, answers);
      if (response.requiresManualReview) {
        setResult("Respostas enviadas. Esta avaliacao depende de revisao antes do resultado final.");
      } else if (response.showScoreOnSubmit === false) {
        setResult(response.passed ? "Avaliacao enviada com sucesso." : "Avaliacao enviada para processamento.");
      } else {
        setResult(response.passed ? `Aprovado com ${response.score}%` : `Reprovado com ${response.score}%`);
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Falha ao enviar avaliacao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Avaliacao</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-900">{payload.quiz.title}</h3>
        {payload.quiz.instructions ? <p className="mt-2 text-sm leading-6 text-slate-600">{payload.quiz.instructions}</p> : null}
      </div>
      <div className="space-y-4">
        {payload.questions.map((question) => (
          <div key={question.id} className="rounded-2xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-900">{question.statement}</p>
            {question.help_text ? <p className="mt-2 text-xs leading-5 text-slate-500">{question.help_text}</p> : null}
            {question.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={question.image_url} alt={question.statement} className="mt-3 max-h-52 w-full rounded-2xl object-contain" />
            ) : null}
            {question.question_type === "short_text" || question.question_type === "essay" ? (
              <textarea
                value={answers[question.id]?.[0] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: [event.target.value] }))}
                className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                placeholder={question.question_type === "essay" ? "Digite aqui sua resposta discursiva." : "Digite aqui sua resposta curta."}
              />
            ) : (
              <div className="mt-3 space-y-2">
                {question.options.map((option) => {
                const checked = (answers[question.id] ?? []).includes(option.id);
                return (
                  <label key={option.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2 text-sm text-slate-700">
                    <input
                      type={question.question_type === "multiple_choice" ? "checkbox" : "radio"}
                      checked={checked}
                      name={question.id}
                      onChange={() =>
                        setAnswers((current) => {
                          const currentValues = current[question.id] ?? [];
                          if (question.question_type === "multiple_choice") {
                            return {
                              ...current,
                              [question.id]: checked ? currentValues.filter((value) => value !== option.id) : [...currentValues, option.id],
                            };
                          }
                          return { ...current, [question.id]: [option.id] };
                        })
                      }
                    />
                    <span className="flex-1">{option.text}</span>
                    {option.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={option.image_url} alt={option.text} className="h-14 w-14 rounded-xl object-cover" />
                    ) : null}
                  </label>
                );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Enviando..." : "Enviar avaliacao"}
        </button>
        {result ? <span className="text-sm font-medium text-slate-600">{result}</span> : null}
      </div>
    </div>
  );
}
