"use client";

import { Fragment, useMemo, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { PageHeader, TableShell, TableWrap } from "@/components/ui/PageShell";
import type { LmsDiscussionStatus, LmsLessonDiscussionAdminRow } from "@/lib/lms/types";

function statusClasses(status: LmsDiscussionStatus) {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700";
  if (status === "answered") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

function statusLabel(status: LmsDiscussionStatus) {
  if (status === "resolved") return "Resolvida";
  if (status === "answered") return "Respondida";
  return "Pendente";
}

export function LmsLessonDiscussionsAdminClient({ rows }: { rows: LmsLessonDiscussionAdminRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | LmsDiscussionStatus>("all");
  const [items, setItems] = useState(rows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return items.filter((row) => {
      if (status !== "all" && (row.status ?? "pending") !== status) return false;
      if (!normalized) return true;
      return `${row.author_name ?? ""} ${row.course_title} ${row.lesson_title} ${row.message} ${row.admin_response ?? ""}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [items, search, status]);

  async function handleUpdate(rowId: string, nextStatus: LmsDiscussionStatus, useResponse: boolean) {
    setSavingId(rowId);
    setFeedback((current) => ({ ...current, [rowId]: "" }));
    try {
      const response = await fetch(`/api/lms/admin/discussions/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          adminResponse: useResponse ? responseDraft[rowId] ?? "" : null,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { item?: LmsLessonDiscussionAdminRow; error?: string };
      if (!response.ok || !json.item) throw new Error(json.error || "Falha ao atualizar a interacao.");
      setItems((current) => current.map((row) => (row.id === rowId ? json.item! : row)));
      setFeedback((current) => ({
        ...current,
        [rowId]: nextStatus === "resolved" ? "Interacao marcada como resolvida." : "Resposta enviada ao colaborador.",
      }));
      if (useResponse) {
        setResponseDraft((current) => ({ ...current, [rowId]: "" }));
      }
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [rowId]: error instanceof Error ? error.message : "Falha ao atualizar a interacao.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<MessageSquareText size={22} />}
        title="Duvidas das aulas"
        subtitle="Acompanhe perguntas dos colaboradores, responda orientacoes e marque interacoes como resolvidas."
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por colaborador, curso, aula ou conteudo da duvida"
            className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | LmsDiscussionStatus)}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900"
          >
            <option value="all">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="answered">Respondidas</option>
            <option value="resolved">Resolvidas</option>
          </select>
        </div>
      </div>

      <TableShell>
        <TableWrap>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3">Colaborador</th>
                <th className="px-6 py-3">Curso</th>
                <th className="px-6 py-3">Aula</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Acao</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const currentStatus = row.status ?? "pending";
                  const expanded = activeId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-t border-slate-100 align-top">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{row.author_name ?? "Colaborador"}</div>
                          {row.author_role ? <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{row.author_role}</div> : null}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{row.course_title}</td>
                        <td className="px-6 py-4 text-slate-700">{row.lesson_title}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(currentStatus)}`}>{statusLabel(currentStatus)}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.created_at))}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => setActiveId(expanded ? null : row.id)}
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800"
                          >
                            {expanded ? "Fechar" : "Tratar"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-slate-100 bg-slate-50/70">
                          <td colSpan={6} className="px-6 py-5">
                            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pergunta do colaborador</div>
                                  <p className="mt-3 text-sm leading-6 text-slate-700">{row.message}</p>
                                </div>
                                {row.admin_response ? (
                                  <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Ultima resposta</div>
                                    <p className="mt-2 text-sm leading-6 text-slate-700">{row.admin_response}</p>
                                    <div className="mt-2 text-xs text-slate-500">
                                      {row.responder_name ?? "Time responsavel"}
                                      {row.responded_at
                                        ? ` - ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.responded_at))}`
                                        : ""}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resposta interna</div>
                                  <textarea
                                    value={responseDraft[row.id] ?? row.admin_response ?? ""}
                                    onChange={(event) => setResponseDraft((current) => ({ ...current, [row.id]: event.target.value }))}
                                    placeholder="Escreva a orientacao que sera enviada ao colaborador."
                                    className="mt-3 min-h-[140px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                                  />
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    disabled={savingId === row.id}
                                    onClick={() => void handleUpdate(row.id, "answered", true)}
                                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                  >
                                    {savingId === row.id ? "Salvando..." : "Responder colaborador"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingId === row.id}
                                    onClick={() => void handleUpdate(row.id, "resolved", false)}
                                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                                  >
                                    Marcar como resolvida
                                  </button>
                                </div>
                                {feedback[row.id] ? <div className="text-sm text-slate-600">{feedback[row.id]}</div> : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    Nenhuma duvida registrada nas aulas ate o momento.
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
