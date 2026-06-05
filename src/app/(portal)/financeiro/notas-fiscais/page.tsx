"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, MoreHorizontal, RefreshCcw, X } from "lucide-react";
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

type CollaboratorRow = { id?: string | null; user_id: string | null; nome: string | null; email: string | null; setor: string | null };

const PAGE_SIZE = 25;

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

function invoiceMonth(row: InvoiceRow) {
  const date = new Date(row.reference_month);
  return String(date.getUTCMonth() + 1).padStart(2, "0");
}

function invoiceYear(row: InvoiceRow) {
  return String(new Date(row.reference_month).getUTCFullYear());
}

function statusSortRank(status: InvoiceStatus) {
  if (status === "submitted") return 0;
  if (status === "draft") return 1;
  if (status === "rejected") return 2;
  if (status === "cancelled") return 3;
  return 4;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
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
  const [sectorByUserId, setSectorByUserId] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [collaboratorFilter, setCollaboratorFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});
  const [reviewerUserId, setReviewerUserId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; kind: InvoiceFileRow["file_kind"]; url: string } | null>(null);
  const [commentInvoice, setCommentInvoice] = useState<InvoiceRow | null>(null);
  const [page, setPage] = useState(1);
  const [exportingFiles, setExportingFiles] = useState(false);

  function collaboratorName(userId: string) {
    const name = nameByUserId[userId]?.trim();
    if (name && !isUuid(name)) return name;
    return isUuid(userId) ? "Colaborador sem nome" : userId;
  }

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
        const apiNames = namesRes.ok && namesJson.names ? namesJson.names : {};
        setNameByUserId(apiNames);

        const { data: collabRows, error: collabErr } = await supabase
          .from("colaboradores")
          .select("id,user_id,nome,email,setor")
          .or(`user_id.in.(${userIds.join(",")}),id.in.(${userIds.join(",")})`);
        if (!collabErr) {
          const names: Record<string, string> = {};
          const sectors: Record<string, string> = {};
          for (const collaborator of (collabRows ?? []) as CollaboratorRow[]) {
            const name = collaborator.nome?.trim() || collaborator.email?.trim() || "";
            const sector = collaborator.setor?.trim() || "Sem setor";
            if (collaborator.user_id) {
              names[collaborator.user_id] = name || collaborator.user_id;
              sectors[collaborator.user_id] = sector;
            }
            if (collaborator.id) {
              names[collaborator.id] = name || collaborator.id;
              sectors[collaborator.id] = sector;
            }
          }
          setNameByUserId((current) => ({ ...current, ...names }));
          setSectorByUserId(sectors);
        }
      } else {
        setNameByUserId({});
        setSectorByUserId({});
      }
    } catch (error: unknown) {
      setRows([]);
      setFilesByInvoiceId({});
      setNameByUserId({});
      setSectorByUserId({});
      setMsg(error instanceof Error ? error.message : "Erro ao carregar notas fiscais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canReview) return;
    void load();
  }, [canReview]);

  const filterOptions = useMemo(() => {
    const sectors = Array.from(new Set(rows.map((row) => sectorByUserId[row.user_id] ?? "Sem setor"))).sort();
    const collaborators = Array.from(new Set(rows.map((row) => row.user_id))).sort((a, b) => collaboratorName(a).localeCompare(collaboratorName(b)));
    const months = Array.from(new Set(rows.map(invoiceMonth))).sort();
    const years = Array.from(new Set(rows.map(invoiceYear))).sort((a, b) => b.localeCompare(a));
    return { sectors, collaborators, months, years };
  }, [nameByUserId, rows, sectorByUserId]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (sectorFilter !== "all" && (sectorByUserId[row.user_id] ?? "Sem setor") !== sectorFilter) return false;
      if (collaboratorFilter !== "all" && row.user_id !== collaboratorFilter) return false;
      if (monthFilter !== "all" && invoiceMonth(row) !== monthFilter) return false;
      if (yearFilter !== "all" && invoiceYear(row) !== yearFilter) return false;
      return true;
    }).sort((a, b) => {
      const statusDiff = statusSortRank(a.status) - statusSortRank(b.status);
      if (statusDiff !== 0) return statusDiff;
      const monthDiff = new Date(b.reference_month).getTime() - new Date(a.reference_month).getTime();
      if (monthDiff !== 0) return monthDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [collaboratorFilter, monthFilter, rows, sectorByUserId, sectorFilter, statusFilter, yearFilter]);

  useEffect(() => {
    setPage(1);
  }, [collaboratorFilter, monthFilter, sectorFilter, statusFilter, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  function exportFilteredSheet() {
    const headers = ["Colaborador", "Setor", "Competencia", "Numero NF", "Valor", "Plataforma", "Status", "Data envio", "Data analise", "Comentario"];
    const lines = [
      headers.map(csvCell).join(";"),
      ...filtered.map((row) =>
        [
          collaboratorName(row.user_id),
          sectorByUserId[row.user_id] ?? "Sem setor",
          `${invoiceMonth(row)}/${invoiceYear(row)}`,
          row.invoice_number ?? "",
          row.gross_amount ?? "",
          providerLabel(row.integration_provider),
          statusLabel(row.status),
          row.sent_at ? new Date(row.sent_at).toLocaleString("pt-BR") : "",
          row.reviewed_at ? new Date(row.reviewed_at).toLocaleString("pt-BR") : "",
          row.review_comment ?? "",
        ].map(csvCell).join(";")
      ),
    ];
    downloadBlob(`notas-fiscais-filtradas-${new Date().toISOString().slice(0, 10)}.csv`, new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
  }

  async function downloadFilteredFiles() {
    if (!filtered.length) return setMsg("Nao ha notas filtradas para baixar.");
    setExportingFiles(true);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const res = await fetch("/api/financeiro/notas-fiscais/download", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invoice_ids: filtered.map((row) => row.id) }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || `Erro ao baixar anexos (status ${res.status}).`);
      }
      const blob = await res.blob();
      downloadBlob(`notas-fiscais-filtradas-${new Date().toISOString().slice(0, 10)}.zip`, blob);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao baixar anexos filtrados.");
    } finally {
      setExportingFiles(false);
    }
  }

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
          review_comment: (reviewComment[row.id] ?? row.review_comment ?? "").trim() || null,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      setCommentInvoice(null);
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">Notas fiscais dos colaboradores</h1>
            <p className="mt-1 text-sm text-slate-600">Analise, aprove ou reprove notas enviadas no Meu Perfil.</p>
          </div>
          <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
            <button
              type="button"
              onClick={() => void downloadFilteredFiles()}
              disabled={loading || exportingFiles || !filtered.length}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <Download size={16} />
              {exportingFiles ? "Gerando..." : "Baixar notas"}
            </button>
            <button
              type="button"
              onClick={exportFilteredSheet}
              disabled={loading || !filtered.length}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <FileSpreadsheet size={16} />
              Baixar planilha
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(130px,0.85fr)_minmax(150px,0.9fr)_minmax(240px,1.5fr)_minmax(130px,0.85fr)_minmax(130px,0.85fr)]">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | InvoiceStatus)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="submitted">Enviada</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Reprovada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Setor
            <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
              <option value="all">Todos</option>
              {filterOptions.sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Colaborador
            <select value={collaboratorFilter} onChange={(event) => setCollaboratorFilter(event.target.value)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
              <option value="all">Todos</option>
              {filterOptions.collaborators.map((userId) => <option key={userId} value={userId}>{collaboratorName(userId)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Mes
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
              <option value="all">Todos</option>
              {filterOptions.months.map((month) => <option key={month} value={month}>{month}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Ano
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
              <option value="all">Todos</option>
              {filterOptions.years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-semibold text-slate-500">
          <span>
            Exibindo {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}-
            {Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} nota(s) filtrada(s).
          </span>
          <span>Notas pendentes aparecem primeiro.</span>
        </div>
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[18%] px-2 py-2">Colaborador</th>
                <th className="hidden w-[12%] px-2 py-2 lg:table-cell">Setor</th>
                <th className="w-[9%] px-2 py-2">Comp.</th>
                <th className="w-[8%] px-2 py-2">NF</th>
                <th className="w-[12%] px-2 py-2">Valor</th>
                <th className="hidden w-[10%] px-2 py-2 xl:table-cell">Plataforma</th>
                <th className="w-[10%] px-2 py-2">Status</th>
                <th className="w-[9%] px-2 py-2">Anexo</th>
                <th className="w-[14%] px-2 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-4 text-slate-500">Carregando...</td></tr>
              ) : paginatedRows.length ? (
                paginatedRows.map((row) => {
                  const busy = savingId === row.id;
                  const files = filesByInvoiceId[row.id] ?? [];
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="truncate px-2 py-2 font-semibold text-slate-900" title={collaboratorName(row.user_id)}>{collaboratorName(row.user_id)}</td>
                      <td className="hidden truncate px-2 py-2 text-slate-600 lg:table-cell" title={sectorByUserId[row.user_id] ?? "Sem setor"}>{sectorByUserId[row.user_id] ?? "Sem setor"}</td>
                      <td className="whitespace-nowrap px-2 py-2">{invoiceMonth(row)}/{invoiceYear(row)}</td>
                      <td className="truncate px-2 py-2" title={row.invoice_number ?? "-"}>{row.invoice_number ?? "-"}</td>
                      <td className="whitespace-nowrap px-2 py-2">{money(row.gross_amount)}</td>
                      <td className="hidden truncate px-2 py-2 xl:table-cell" title={providerLabel(row.integration_provider)}>{providerLabel(row.integration_provider)}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {files.length ? (
                          <button type="button" onClick={() => void openInvoiceFile(files[0])} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Ver nota">
                            <Eye size={13} />
                            <span className="hidden 2xl:inline">Ver nota</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">Sem anexo</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setCommentInvoice(row)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Abrir comentario" title="Comentario">
                            <MoreHorizontal size={16} />
                          </button>
                          <button type="button" onClick={() => void updateStatus(row, "approved")} disabled={busy} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-60" aria-label="Aprovar" title="Aprovar">
                            <Check size={14} />
                          </button>
                          <button type="button" onClick={() => void updateStatus(row, "rejected")} disabled={busy} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white disabled:opacity-60" aria-label="Recusar" title="Recusar">
                            <X size={14} />
                          </button>
                          <button type="button" onClick={() => void updateStatus(row, "cancelled")} disabled={busy} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-[10px] font-bold text-white disabled:opacity-60" aria-label="Cancelar" title="Cancelar">
                            C
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={9} className="px-3 py-4 text-slate-500">Nenhuma nota fiscal encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500">Pagina {safePage} de {totalPages} • 25 notas por pagina</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft size={14} />
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Seguir
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {commentInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">Comentario da analise</p>
                <p className="text-sm text-slate-500">{collaboratorName(commentInvoice.user_id)}</p>
              </div>
              <button type="button" onClick={() => setCommentInvoice(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar comentario">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={reviewComment[commentInvoice.id] ?? commentInvoice.review_comment ?? ""}
              onChange={(event) => setReviewComment((prev) => ({ ...prev, [commentInvoice.id]: event.target.value }))}
              className="mt-4 min-h-[140px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
              placeholder="Comentario da analise"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCommentInvoice(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Fechar
              </button>
              <button type="button" onClick={() => void updateStatus(commentInvoice, commentInvoice.status)} disabled={savingId === commentInvoice.id} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                Salvar comentario
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
