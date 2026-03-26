"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LmsActionButton({
  endpoint,
  label,
  pendingLabel,
  className,
  body,
  onSuccess,
}: {
  endpoint: string;
  label: string;
  pendingLabel?: string;
  className?: string;
  body?: Record<string, unknown>;
  onSuccess?: (data: Record<string, unknown>) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Falha ao executar a acao.");
      onSuccess?.(data);
      router.refresh();
      setMessage("Feito.");
      setTimeout(() => setMessage(""), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao executar a acao.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={pending}
        className={className ?? "rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-60"}
      >
        {pending ? pendingLabel ?? "Processando..." : label}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}
