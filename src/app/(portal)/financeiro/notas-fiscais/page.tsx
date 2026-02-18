"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
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
  const [runningBatch, setRunningBatch] = useState(false);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessão inválida.");
      setReviewerUserId(authData.user.id);

      const { data, error } = await supabase
        .from("collaborator_invoices")
        .select("id,user_id,reference_month,invoice_number,issue_date,due_date,gross_amount,integration_provider,integration_url,status,notes,sent_at,reviewed_at,reviewed_by,review_comment,created_at,updated_at")
        .order("reference_month", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const invoices = (data ?? []) as InvoiceRow[];
      setRows(invoices);

      const invoiceIds = invoices.map((x) => x.id);
      if (invoiceIds.length) {
        const filesRes = await supabase
          .from("collaborator_invoice_files")
          .select("id,invoice_id,file_kind,file_name,created_at")
          .in("invoice_id", invoiceIds)
          .order("created_at", { ascending: false });
        if (!filesRes.error) {
          const map: Record<string, InvoiceFileRow[]> = {};
          for (const f of (filesRes.data ?? []) as InvoiceFileRow[]) {
            (map[f.invoice_id] ??= []).push(f);
          }
          setFilesByInvoiceId(map);
        } else {
          setFilesByInvoiceId({});
        }
      } else {
        setFilesByInvoiceId({});
      }

      const userIds = Array.from(new Set(invoices.map((x) => x.user_id)));
      if (userIds.length) {
        const { data: collabRows, error: collabErr } = await supabase
          .from("colaboradores")
          .select("user_id,nome,email")
          .in("user_id", userIds);
        if (!collabErr) {
          const map: Record<string, string> = {};
          for (const c of (collabRows ?? []) as CollaboratorRow[]) {
            if (!c.user_id) continue;
            map[c.user_id] = c.nome?.trim() || c.email?.trim() || c.user_id;
          }
          setNameByUserId(map);
        }
      } else {
        setNameByUserId({});
      }
    } catch (e: unknown) {
      setRows([]);
      setFilesByInvoiceId({});
      setNameByUserId({});
      setMsg(e instanceof Error ? e.message : "Erro ao carregar notas fiscais.");
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
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  async function updateStatus(row: InvoiceRow, status: InvoiceStatus) {
    if (!reviewerUserId) return;
    if (status === "approved") {
      const files = filesByInvoiceId[row.id] ?? [];
      if (!row.invoice_number?.trim()) return setMsg("Para aprovar, a nota precisa ter número.");
      if (!row.reference_month) return setMsg("Para aprovar, a nota precisa ter competência.");
      if (!row.gross_amount || row.gross_amount <= 0) return setMsg("Para aprovar, a nota precisa ter valor bruto maior que zero.");
      const hasPdf = files.some((f) => f.file_kind === "pdf");
      const hasXml = files.some((f) => f.file_kind === "xml");
      if (!hasPdf && !hasXml) return setMsg("Para aprovar, anexe ao menos um XML ou PDF da nota.");
    }

    setSavingId(row.id);
    setMsg("");
    try {
      const payload = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerUserId,
        review_comment: (reviewComment[row.id] ?? "").trim() || null,
      };
      const { error } = await supabase.from("collaborator_invoices").update(payload).eq("id", row.id);
      if (error) throw new Error(error.message);
      setMsg("Status atualizado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar status.");
    } finally {
      setSavingId(null);
    }
  }

  async function openInvoiceFile(fileId: string) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;

      const res = await fetch(`/api/invoices/files/url?file_id=${encodeURIComponent(fileId)}`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = (await res.json()) as { ok?: boolean; signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) throw new Error(json.error || `Erro ao abrir arquivo (status ${res.status})`);
      window.open(json.signedUrl, "_blank", "noreferrer");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir arquivo.");
    }
  }

  async function runAutomationBatch(limit = 10) {
    setRunningBatch(true);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida para executar automacao.");

      const res = await fetch("/api/invoices/automation/run-batch", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        processed_count?: number;
        requested_limit?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `Falha ao processar fila (status ${res.status})`);

      setMsg(`Fila processada. Jobs executados: ${json.processed_count ?? 0} de ${json.requested_limit ?? limit}.`);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao processar fila automatica.");
    } finally {
      setRunningBatch(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando permissões...</p>
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Notas fiscais</h1>
        <p className="mt-2 text-sm text-slate-700">Você não tem permissão para acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Notas fiscais dos colaboradores</h1>
            <p className="mt-1 text-sm text-slate-600">
              Analise, aprove ou reprove notas enviadas no Meu Perfil.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || runningBatch}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void runAutomationBatch(10)}
            disabled={loading || runningBatch}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={runningBatch ? "animate-spin" : ""} />
            {runningBatch ? "Processando fila..." : "Processar fila automatica"}
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
              onChange={(e) => setStatusFilter(e.target.value as "all" | InvoiceStatus)}
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

        <div className="overflow-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Competência</th>
                <th className="p-3">Número NF</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Plataforma</th>
                <th className="p-3">Status</th>
                <th className="p-3">Anexos</th>
                <th className="p-3">Comentário</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-3 text-slate-500">Carregando...</td>
                </tr>
              ) : filtered.length ? (
                filtered.map((row) => {
                  const busy = savingId === row.id;
                  const files = filesByInvoiceId[row.id] ?? [];
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="p-3 break-words">{nameByUserId[row.user_id] ?? row.user_id}</td>
                      <td className="p-3">{new Date(row.reference_month).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</td>
                      <td className="p-3 break-words">{row.invoice_number ?? "-"}</td>
                      <td className="p-3">{money(row.gross_amount)}</td>
                      <td className="p-3">
                        <div>{providerLabel(row.integration_provider)}</div>
                        {row.integration_url ? (
                          <a className="text-xs text-sky-700 underline" href={row.integration_url} target="_blank" rel="noreferrer">
                            Abrir portal
                          </a>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {files.length ? (
                            files.slice(0, 3).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => void openInvoiceFile(f.id)}
                                className="block w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {f.file_kind.toUpperCase()} - {f.file_name ?? "arquivo"}
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">Sem anexo</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <textarea
                          value={reviewComment[row.id] ?? row.review_comment ?? ""}
                          onChange={(e) => setReviewComment((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          className="min-h-[64px] w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900"
                          placeholder="Comentário da análise"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2 xl:flex-row">
                          <button
                            type="button"
                            onClick={() => void updateStatus(row, "approved")}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
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
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-3 text-slate-500">Nenhuma nota fiscal encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
