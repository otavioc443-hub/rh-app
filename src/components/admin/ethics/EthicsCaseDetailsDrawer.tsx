"use client";

import { useEffect, useState } from "react";
import { CalendarClock, FileText, Paperclip, Shield, UserRound, X } from "lucide-react";
import { EthicsHistoryTimeline } from "@/components/admin/ethics/EthicsHistoryTimeline";
import { EthicsRiskBadge } from "@/components/admin/ethics/EthicsRiskBadge";
import { EthicsStatusBadge } from "@/components/admin/ethics/EthicsStatusBadge";
import type { EthicsCaseRecord, EthicsCaseStatus } from "@/lib/ethicsCases/types";

type EthicsCaseDetailsDrawerProps = {
  open: boolean;
  item: EthicsCaseRecord | null;
  assignees: Array<{ id: string; name: string }>;
  saving: boolean;
  onClose: () => void;
  onUpdateStatus: (status: EthicsCaseStatus, comment: string) => void;
  onAssign: (assignedTo: string | null, comment: string) => void;
  onNote: (comment: string) => void;
  onCloseCase: (comment: string) => void;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSlaLabel(item: EthicsCaseRecord) {
  const SLA_BY_STATUS: Record<string, number> = {
    Recebido: 24,
    "Em triagem": 48,
    "Em análise": 72,
    "Em investigação": 120,
    Concluído: 24,
    Encerrado: 0,
    Reaberto: 24,
  };
  const hours = SLA_BY_STATUS[item.status] ?? 0;
  return hours ? `${hours}h previstas para a fase atual` : "Fase sem SLA configurado";
}

export function EthicsCaseDetailsDrawer({
  open,
  item,
  assignees,
  saving,
  onClose,
  onUpdateStatus,
  onAssign,
  onNote,
  onCloseCase,
}: EthicsCaseDetailsDrawerProps) {
  const [status, setStatus] = useState<EthicsCaseStatus>("Recebido");
  const [statusComment, setStatusComment] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [assignComment, setAssignComment] = useState("");
  const [internalComment, setInternalComment] = useState("");
  const [closingComment, setClosingComment] = useState("");

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setAssignedTo(item.assigned_to ?? "");
    setStatusComment("");
    setAssignComment("");
    setInternalComment("");
    setClosingComment("");
  }, [item]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" className="hidden flex-1 bg-slate-950/45 lg:block" onClick={onClose} />
      <aside className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Detalhes do caso</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.protocol}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.subject}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-6">
            <section className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                <div className="mt-2"><EthicsStatusBadge status={item.status} /></div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risco</p>
                <div className="mt-2"><EthicsRiskBadge risk={item.risk_level} /></div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Origem</p>
                <p className="mt-2 text-sm text-slate-700">{item.is_anonymous ? "Anônima" : "Identificada"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Responsável atual</p>
                <p className="mt-2 text-sm text-slate-700">{item.assigned_to_name ?? "Não atribuído"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Abertura</p>
                <p className="mt-2 text-sm text-slate-700">{formatDateTime(item.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prazo / SLA</p>
                <p className="mt-2 text-sm text-slate-700">{getSlaLabel(item)}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-950">
                <FileText size={18} />
                <h3 className="text-lg font-semibold">Dados gerais da denúncia</h3>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo de ocorrência</p>
                  <p className="mt-2 text-sm text-slate-700">{item.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Última atualização</p>
                  <p className="mt-2 text-sm text-slate-700">{formatDateTime(item.last_update_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Relator</p>
                  <p className="mt-2 text-sm text-slate-700">{item.is_anonymous ? "Não identificado" : item.reporter_name ?? "Não informado"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contato do relator</p>
                  <p className="mt-2 text-sm text-slate-700">{item.is_anonymous ? "Não aplicável" : item.reporter_email ?? "Não informado"}</p>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Descrição completa</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.description}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-950">
                <Paperclip size={18} />
                <h3 className="text-lg font-semibold">Anexos</h3>
              </div>
              {item.attachments.length ? (
                <ul className="mt-4 space-y-3">
                  {item.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a href={attachment.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
                        {attachment.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Nenhum anexo associado ao caso.</p>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-950">
                <CalendarClock size={18} />
                <h3 className="text-lg font-semibold">Histórico de movimentações</h3>
              </div>
              <div className="mt-5">
                <EthicsHistoryTimeline history={item.history} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-950">
                <Shield size={18} />
                <h3 className="text-lg font-semibold">Ações do caso</h3>
              </div>

              <div className="mt-5 grid gap-5">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Alterar status</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr,1.2fr,auto]">
                    <select value={status} onChange={(event) => setStatus(event.target.value as EthicsCaseStatus)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none">
                      <option value="Recebido">Recebido</option>
                      <option value="Em triagem">Em triagem</option>
                      <option value="Em análise">Em análise</option>
                      <option value="Em investigação">Em investigação</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Encerrado">Encerrado</option>
                      <option value="Reaberto">Reaberto</option>
                    </select>
                    <input value={statusComment} onChange={(event) => setStatusComment(event.target.value)} placeholder="Comentário da mudança" className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    <button type="button" disabled={saving} onClick={() => onUpdateStatus(status, statusComment)} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                      Salvar
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Atribuir responsável</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr,1.2fr,auto]">
                    <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none">
                      <option value="">Não atribuído</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name}
                        </option>
                      ))}
                    </select>
                    <input value={assignComment} onChange={(event) => setAssignComment(event.target.value)} placeholder="Observação da atribuição" className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    <button type="button" disabled={saving} onClick={() => onAssign(assignedTo || null, assignComment)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60">
                      Atribuir
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Registrar andamento / observações internas</p>
                  <textarea value={internalComment} onChange={(event) => setInternalComment(event.target.value)} rows={4} placeholder="Descreva a atualização interna..." className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none" />
                  <div className="mt-3 flex justify-end">
                    <button type="button" disabled={saving || !internalComment.trim()} onClick={() => onNote(internalComment)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60">
                      Registrar andamento
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 text-rose-700">
                    <UserRound size={16} />
                    <p className="text-sm font-semibold">Encerrar caso</p>
                  </div>
                  <textarea value={closingComment} onChange={(event) => setClosingComment(event.target.value)} rows={3} placeholder="Motivo do encerramento" className="mt-3 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none" />
                  <div className="mt-3 flex justify-end">
                    <button type="button" disabled={saving} onClick={() => onCloseCase(closingComment)} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">
                      Encerrar caso
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
