"use client";

import { useState } from "react";

export function OnboardingAssignmentsButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRun() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/lms/admin/assignments/onboarding/run", { method: "POST" });
      const data = (await response.json()) as { created?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao gerar atribuicoes de onboarding.");
      setMessage(data.created ? `${data.created} atribuicao(oes) de onboarding gerada(s).` : "Nenhuma atribuicao de onboarding precisava ser criada agora.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao gerar atribuicoes de onboarding.");
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
        {loading ? "Processando onboarding..." : "Gerar onboarding agora"}
      </button>
      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
    </div>
  );
}
