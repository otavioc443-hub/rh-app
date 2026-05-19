"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Eye, RefreshCcw, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type InvoiceStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled";

type InvoiceRow = {
  id: string;
  user_id: string;
  reference_month: string;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  gross_amount: number | null;
  integration_provider: "sougov" | "portal_estadual" | "portal_municipal" | "custom";
  integration_url: string | null;
  status: InvoiceStatus;
  notes: string | null;
  sent_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceFileRow = {
  id: string;
  invoice_id: string;
  file_kind: "xml" | "pdf" | "other";
  file_name: string | null;
  created_at: string;
};

type CollaboratorRow = { user_id: string | null; nome: string | null; email: string | null };

function statusLabel(status: InvoiceStatus) {
  if (status === "draft") return "Rascunho";
  if (status === "submitted") return "Enviada";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Reprovada";
  return "Cancelada";
}

function statusClass(status: InvoiceStatus) {
  if (status === "draft") return "bg-slate-100 text-slate-700";
  if (status === "submitted") return "bg-sky-50 text-sky-700";
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-200 text-slate-700";
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function providerLabel(provider: InvoiceRow["integration_provider"]) {
  if (provider === "sougov") return "SouGov";
  if (provider === "portal_estadual") return "Portal estadual";
  if (provider === "portal_municipal") return "Portal municipal";
  return "Outro portal";
}

function fieldLabel(label: string, value: ReactNode) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}

export default function FinanceiroNotasFiscaisPage() {
  const { role, loading: roleLoading } = useUserRole();
  const canReview = role === "financeiro" || role === "admin" || role === "rh";

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [filesByInvoiceId, setFilesByInvoiceId] = useState<Record<string, InvoiceFileRow[]>>({});
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});
  const [reviewerUserId, setReviewerUserId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; kind: InvoiceFileRow["file_kind"]; url: string } | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setReviewerUserId(authData.user.id);

      const { data, error } = await supabase
        .from("collaborator_invoices")
        .select("id,user_id,reference_month,invoice_number,issue_date,due_date,gross_amount,integration_provider,integration_url,status,notes,sent_at,reviewed_at,reviewed_by,review_comment,created_at,updated_at")
        .order("reference_month", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const invoices = (data ?? []) as InvoiceRow[];
      setRows(invoices);

      const invoiceIds = invoices.map((item) => item.id);
      if (invoiceIds.length) {
        const filesRes = await supabase
          .from("collaborator_invoice_files")
          .select("id,invoice_id,file_kind,file_name,created_at")
          .in("invoice_id", invoiceIds)
          .order("created_at", { ascending: false });
        const map: Record<string, InvoiceFileRow[]> = {};
        if (!filesRes.error) {
          for (const file of (filesRes.data ?? []) as InvoiceFileRow[]) {
            (map[file.invoice_id] ??= []).push(file);
          }
        }
        setFilesByInvoiceId(map);
      } else {
        setFilesByInvoiceId({});
      }

      const userIds = Array.from(new Set(invoices.map((item) => item.user_id).filter(Boolean)));
      if (userIds.length) {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token ?? null;
        const namesRes = await fetch("/api/institucional/rede-social/author-names", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userIds }),
        });
        const namesJson = (await namesRes.json().catch(() => ({}))) as { names?: Record<string, string> };
        if (namesRes.ok && namesJson.names) {
          setNameByUserId(namesJson.names);
        } else {
          const { data: collabRows, error: collabErr } = await supabase
            .from("colaboradores")
            .select("user_id,nome,email")
            .in("user_id", userIds);
          if (!collabErr) {
            const map: Record<string, string> = {};
            for (const collaborator of (collabRows ?? []) as CollaboratorRow[]) {
              if (!collaborator.user_id) continue;
              map[collaborator.user_id] = collaborator.nome?.trim() || collaborator.email?.trim() || collaborator.user_id;
            }
            setNameByUserId(map);
          }
        }
      } else {
        setNameByUserId({});
      }
    } catch (error: unknown) {
      setRows([]);
      setFilesByInvoiceId({});
      setNameByUserId({});
      setMsg(error instanceof Error ? error.message : "Erro ao carregar notas fiscais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canReview) return;
    void load();
  }, [canReview]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  async function updateStatus(row: InvoiceRow, status: InvoiceStatus) {
    if (!reviewerUserId) return;
    if (status === "approved") {
      const files = filesByInvoiceId[row.id] ?? [];
      if (!row.invoice_number?.trim()) return setMsg("Para aprovar, a nota precisa ter numero.");
      if (!row.reference_month) return setMsg("Para aprovar, a nota precisa ter competencia.");
      if (!row.gross_amount || row.gross_amount <= 0) return setMsg("Para aprovar, a nota precisa ter valor bruto maior que zero.");
      const hasPdf = files.some((file) => file.file_kind === "pdf");
      const hasXml = files.some((file) => file.file_kind === "xml");
      if (!hasPdf && !hasXml) return setMsg("Para aprovar, anexe ao menos um XML ou PDF da nota.");
    }

    setSavingId(row.id);
    setMsg("");
    try {
      const { error } = await supabase
        .from("collaborator_invoices")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerUserId,
          review_comment: (reviewComment[row.id] ?? "").trim() || null,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      setMsg("Status atualizado.");
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao atualizar status.");
    } finally {
      setSavingId(null);
    }
  }

  async function openInvoiceFile(file: InvoiceFileRow) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const res = await fetch(`/api/invoices/files/url?file_id=${encodeURIComponent(file.id)}`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = (await res.json()) as { ok?: boolean; signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) throw new Error(json.error || `Erro ao abrir arquivo (status ${res.status})`);
      setPreviewFile({ name: file.file_name ?? "Nota fiscal", kind: file.file_kind, url: json.signedUrl });
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao abrir arquivo.");
    }
  }

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando permissoes...</p>
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Notas fiscais</h1>
        <p className="mt-2 text-sm text-slate-700">Voce nao tem permissao para acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Notas fiscais dos colaboradores</h1>
            <p className="mt-1 text-sm text-slate-600">Analise, aprove ou reprove notas enviadas no Meu Perfil.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | InvoiceStatus)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="submitted">Enviada</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Reprovada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Carregando...</div>
          ) : filtered.length ? (
            filtered.map((row) => {
              const busy = savingId === row.id;
              const files = filesByInvoiceId[row.id] ?? [];
              return (
                <div key={row.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-12">
                  <div className="lg:col-span-2">
                    {fieldLabel("Colaborador", <p className="break-words font-semibold">{nameByUserId[row.user_id] ?? row.user_id}</p>)}
                  </div>
                  {fieldLabel("Competencia", new Date(row.reference_month).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }))}
                  {fieldLabel("Numero NF", <span className="break-words">{row.invoice_number ?? "-"}</span>)}
                  {fieldLabel("Valor", <span className="whitespace-nowrap">{money(row.gross_amount)}</span>)}
                  {fieldLabel(
                    "Plataforma",
                    <>
                      <p>{providerLabel(row.integration_provider)}</p>
                      {row.integration_url ? (
                        <a className="text-xs text-sky-700 underline" href={row.integration_url} target="_blank" rel="noreferrer">
                          Abrir portal
                        </a>
                      ) : null}
                    </>
                  )}
                  {fieldLabel(
                    "Status",
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  )}
                  <div className="lg:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Anexos</p>
                    <div className="mt-1 space-y-1">
                      {files.length ? (
                        files.slice(0, 3).map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => void openInvoiceFile(file)}
                            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Eye size={14} />
                            <span className="truncate">{file.file_kind.toUpperCase()} - {file.file_name ?? "arquivo"}</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Sem anexo</span>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Comentario</p>
                    <textarea
                      value={reviewComment[row.id] ?? row.review_comment ?? ""}
                      onChange={(event) => setReviewComment((prev) => ({ ...prev, [row.id]: event.target.value }))}
                      className="mt-1 min-h-[64px] w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900"
                      placeholder="Comentario da analise"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Acoes</p>
                    <div className="mt-1 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => void updateStatus(row, "approved")}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        <Save size={14} />
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateStatus(row, "rejected")}
                        disabled={busy}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Reprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateStatus(row, "cancelled")}
                        disabled={busy}
                        className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Nenhuma nota fiscal encontrada.</div>
          )}
        </div>
      </div>

      {previewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{previewFile.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{previewFile.kind}</p>
              </div>
              <button type="button" onClick={() => setPreviewFile(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar visualizacao">
                <X size={18} />
              </button>
            </div>
            <iframe title="Visualizacao da nota fiscal" src={previewFile.url} className="h-full w-full bg-slate-50" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
