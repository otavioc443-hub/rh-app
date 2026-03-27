"use client";

import { useState } from "react";

export function RecurringAssignmentsButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRun() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/lms/admin/assignments/recurring/run", { method: "POST" });
      const data = (await response.json()) as { created?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao processar atribuicoes recorrentes.");
      setMessage(data.created ? `${data.created} atribuicao(oes) recorrente(s) gerada(s).` : "Nenhuma atribuicao recorrente precisava ser gerada agora.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao processar atribuicoes recorrentes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={loading}
        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
      >
        {loading ? "Processando recorrencias..." : "Gerar recorrencias agora"}
      </button>
      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
    </div>
  );
}
