"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type InvoiceRow = {
  id: string;
  user_id: string;
  reference_month: string;
  invoice_number: string | null;
  gross_amount: number | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled";
};

type RemittanceRow = {
  id: string;
  code: string;
  status: "draft" | "payment_pending" | "paid" | "cancelled";
  total_amount: number;
  due_date: string | null;
  payment_method: "boleto" | "pix" | "ted";
  boleto_url: string | null;
  boleto_digitable_line: string | null;
  pix_qr_code_url: string | null;
  pix_copy_paste: string | null;
  created_at: string;
};

type RemittanceItemRow = { remittance_id: string; invoice_id: string };
type RemittanceFileRow = {
  id: string;
  remittance_id: string;
  file_name: string | null;
  file_kind: "pdf" | "image" | "other";
  created_at: string;
};
type CollaboratorRow = { user_id: string | null; nome: string | null; email: string | null };

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function remittanceStatusLabel(status: RemittanceRow["status"]) {
  if (status === "draft") return "Rascunho";
  if (status === "payment_pending") return "Aguardando pagamento";
  if (status === "paid") return "Paga";
  return "Cancelada";
}

function remittanceStatusClass(status: RemittanceRow["status"]) {
  if (status === "draft") return "bg-slate-100 text-slate-700";
  if (status === "payment_pending") return "bg-amber-50 text-amber-700";
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  return "bg-rose-50 text-rose-700";
}

function buildRemittanceCode() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `REM-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export default function FinanceiroRemessasPage() {
  const { role, loading: roleLoading } = useUserRole();
  const canAccess = role === "financeiro" || role === "admin" || role === "rh";

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Record<string, boolean>>({});
  const [availableInvoices, setAvailableInvoices] = useState<InvoiceRow[]>([]);
  const [remittances, setRemittances] = useState<RemittanceRow[]>([]);
  const [filesByRemittanceId, setFilesByRemittanceId] = useState<Record<string, RemittanceFileRow[]>>({});
  const [pendingFileByRemittanceId, setPendingFileByRemittanceId] = useState<Record<string, File | null>>({});
  const [invoiceCountByRemittanceId, setInvoiceCountByRemittanceId] = useState<Record<string, number>>({});
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});
  const [generatingBoletoId, setGeneratingBoletoId] = useState<string | null>(null);
  const [generatingPixId, setGeneratingPixId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [downloadingCnabId, setDownloadingCnabId] = useState<string | null>(null);
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.keys(selectedInvoiceIds).filter((id) => selectedInvoiceIds[id]),
    [selectedInvoiceIds]
  );

  const selectedTotal = useMemo(() => {
    const selected = new Set(selectedIds);
    return availableInvoices.reduce((acc, inv) => acc + (selected.has(inv.id) ? Number(inv.gross_amount ?? 0) : 0), 0);
  }, [availableInvoices, selectedIds]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [invoicesRes, remRes, itemsRes] = await Promise.all([
        supabase
          .from("collaborator_invoices")
          .select("id,user_id,reference_month,invoice_number,gross_amount,status")
          .eq("status", "approved")
          .order("reference_month", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("collaborator_invoice_remittances")
          .select("id,code,status,total_amount,due_date,payment_method,boleto_url,boleto_digitable_line,pix_qr_code_url,pix_copy_paste,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("collaborator_invoice_remittance_items")
          .select("remittance_id,invoice_id"),
      ]);

      if (invoicesRes.error) throw new Error(invoicesRes.error.message);
      if (remRes.error) throw new Error(remRes.error.message);
      if (itemsRes.error) throw new Error(itemsRes.error.message);

      const items = (itemsRes.data ?? []) as RemittanceItemRow[];
      const remittedInvoiceIds = new Set(items.map((x) => x.invoice_id));
      const approved = (invoicesRes.data ?? []) as InvoiceRow[];
      setAvailableInvoices(approved.filter((x) => !remittedInvoiceIds.has(x.id)));
      setRemittances((remRes.data ?? []) as RemittanceRow[]);

      const countMap: Record<string, number> = {};
      for (const item of items) countMap[item.remittance_id] = (countMap[item.remittance_id] ?? 0) + 1;
      setInvoiceCountByRemittanceId(countMap);

      const remittanceIds = ((remRes.data ?? []) as RemittanceRow[]).map((r) => r.id);
      if (remittanceIds.length) {
        const filesRes = await supabase
          .from("collaborator_invoice_remittance_files")
          .select("id,remittance_id,file_name,file_kind,created_at")
          .in("remittance_id", remittanceIds)
          .order("created_at", { ascending: false });
        if (!filesRes.error) {
          const map: Record<string, RemittanceFileRow[]> = {};
          for (const f of (filesRes.data ?? []) as RemittanceFileRow[]) {
            (map[f.remittance_id] ??= []).push(f);
          }
          setFilesByRemittanceId(map);
        } else {
          setFilesByRemittanceId({});
        }
      } else {
        setFilesByRemittanceId({});
      }

      const userIds = Array.from(new Set(approved.map((x) => x.user_id)));
      if (userIds.length) {
        const collabRes = await supabase.from("colaboradores").select("user_id,nome,email").in("user_id", userIds);
        if (!collabRes.error) {
          const map: Record<string, string> = {};
          for (const c of (collabRes.data ?? []) as CollaboratorRow[]) {
            if (!c.user_id) continue;
            map[c.user_id] = c.nome?.trim() || c.email?.trim() || c.user_id;
          }
          setNameByUserId(map);
        }
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar remessas.");
      setAvailableInvoices([]);
      setRemittances([]);
      setFilesByRemittanceId({});
      setInvoiceCountByRemittanceId({});
      setNameByUserId({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess]);

  async function createRemittance() {
    if (!selectedIds.length) return setMsg("Selecione ao menos uma nota aprovada.");
    const selectedInvoices = availableInvoices.filter((x) => selectedIds.includes(x.id));
    const totalAmount = selectedInvoices.reduce((acc, inv) => acc + Number(inv.gross_amount ?? 0), 0);
    if (totalAmount <= 0) return setMsg("As notas selecionadas precisam ter valor maior que zero.");

    setSaving(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");

      const remRes = await supabase
        .from("collaborator_invoice_remittances")
        .insert({
          code: buildRemittanceCode(),
          status: "draft",
          payment_method: "boleto",
          total_amount: totalAmount,
          due_date: dueDate || null,
          created_by: authData.user.id,
        })
        .select("id")
        .single<{ id: string }>();
      if (remRes.error || !remRes.data) throw new Error(remRes.error?.message || "Falha ao criar remessa.");

      const items = selectedInvoices.map((inv) => ({
        remittance_id: remRes.data.id,
        invoice_id: inv.id,
        user_id: inv.user_id,
        amount: Number(inv.gross_amount ?? 0),
        invoice_number: inv.invoice_number,
        issue_date: null,
      }));
      const itemRes = await supabase.from("collaborator_invoice_remittance_items").insert(items);
      if (itemRes.error) throw new Error(itemRes.error.message);

      setSelectedInvoiceIds({});
      setMsg("Remessa criada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao criar remessa.");
    } finally {
      setSaving(false);
    }
  }

  async function generateBoleto(remittanceId: string) {
    setGeneratingBoletoId(remittanceId);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida.");

      const res = await fetch("/api/financeiro/remittances/boleto", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remittance_id: remittanceId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `Falha ao gerar boleto (status ${res.status})`);

      setMsg("Boleto da remessa gerado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao gerar boleto.");
    } finally {
      setGeneratingBoletoId(null);
    }
  }

  async function generatePix(remittanceId: string) {
    setGeneratingPixId(remittanceId);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida.");

      const res = await fetch("/api/financeiro/remittances/pix", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remittance_id: remittanceId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `Falha ao gerar PIX (status ${res.status})`);

      setMsg("PIX da remessa gerado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao gerar PIX.");
    } finally {
      setGeneratingPixId(null);
    }
  }

  async function markAsPaid(remittanceId: string) {
    if (!(filesByRemittanceId[remittanceId]?.length ?? 0)) {
      setMsg("Anexe ao menos um comprovante antes de marcar a remessa como paga.");
      return;
    }
    setMarkingPaidId(remittanceId);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida.");

      const res = await fetch("/api/financeiro/remittances/mark-paid", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remittance_id: remittanceId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `Falha ao marcar como paga (status ${res.status})`);

      setMsg("Remessa marcada como paga.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao marcar remessa como paga.");
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function uploadRemittanceFile(remittanceId: string) {
    const file = pendingFileByRemittanceId[remittanceId] ?? null;
    if (!file) {
      setMsg("Selecione um comprovante (PDF ou imagem).");
      return;
    }
    setUploadingFileId(remittanceId);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida.");

      const fd = new FormData();
      fd.append("remittance_id", remittanceId);
      fd.append("file", file);
      const res = await fetch("/api/financeiro/remittances/files/upload", {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `Falha no upload (status ${res.status})`);

      setPendingFileByRemittanceId((prev) => ({ ...prev, [remittanceId]: null }));
      setMsg("Comprovante anexado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao anexar comprovante.");
    } finally {
      setUploadingFileId(null);
    }
  }

  async function openRemittanceFile(fileId: string) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida.");

      const res = await fetch(`/api/financeiro/remittances/files/url?file_id=${encodeURIComponent(fileId)}`, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { ok?: boolean; signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) throw new Error(json.error || `Erro ao abrir arquivo (status ${res.status})`);
      window.open(json.signedUrl, "_blank", "noreferrer");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir comprovante.");
    }
  }

  async function downloadCnab(remittanceId: string) {
    setDownloadingCnabId(remittanceId);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      if (!token) throw new Error("Sessao invalida.");

      const res = await fetch(`/api/financeiro/remittances/cnab?remittance_id=${encodeURIComponent(remittanceId)}`, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || `Falha ao gerar CNAB (status ${res.status})`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(contentDisposition);
      const filename = match?.[1] ?? `cnab-remessa-${remittanceId}.txt`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao baixar CNAB.");
    } finally {
      setDownloadingCnabId(null);
    }
  }

  if (roleLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando...</div>;
  if (!canAccess) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">Sem permissao para esta tela.</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Remessas de notas</h1>
            <p className="mt-1 text-sm text-slate-600">Monte lotes com notas aprovadas e gere boleto/PIX para pagamento da remessa.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Configuracao para remessas (Financeiro)</p>
        <p className="mt-1">1. Rode as migrations de remessas e comprovantes.</p>
        <p>2. Boleto API: `BOLETO_PROVIDER_API_URL` e `BOLETO_PROVIDER_API_TOKEN`.</p>
        <p>3. PIX API: `PIX_PROVIDER_API_URL` e `PIX_PROVIDER_API_TOKEN`.</p>
        <p>4. Sem API configurada, o sistema usa retorno simulado para boleto/PIX.</p>
        <p>5. Para marcar como paga, anexe comprovante (PDF/imagem).</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Vencimento da remessa
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          </label>
          <button
            type="button"
            onClick={() => void createRemittance()}
            disabled={saving || loading || !selectedIds.length}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Wallet size={16} />
            Criar remessa ({selectedIds.length}) - {money(selectedTotal)}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-12 p-3">Sel.</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Competencia</th>
                <th className="p-3">NF</th>
                <th className="p-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-3 text-slate-500">Carregando...</td></tr>
              ) : availableInvoices.length ? (
                availableInvoices.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedInvoiceIds[inv.id])}
                        onChange={(e) => setSelectedInvoiceIds((prev) => ({ ...prev, [inv.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="p-3 break-words">{nameByUserId[inv.user_id] ?? inv.user_id}</td>
                    <td className="p-3">{new Date(inv.reference_month).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</td>
                    <td className="p-3 break-words">{inv.invoice_number ?? "-"}</td>
                    <td className="p-3">{money(inv.gross_amount)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="p-3 text-slate-500">Sem notas aprovadas disponiveis para remessa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Remessas criadas</h2>
        <p className="mt-1 text-xs text-slate-600">Secao de pagamento: boleto/PIX API e CNAB Bradesco opcional no mesmo fluxo.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Codigo</th>
                <th className="p-3">Notas</th>
                <th className="p-3">Valor total</th>
                <th className="p-3">Status</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Boleto</th>
                <th className="p-3">Comprovante</th>
                <th className="p-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-3 text-slate-500">Carregando...</td></tr>
              ) : remittances.length ? (
                remittances.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 break-words">{r.code}</td>
                    <td className="p-3">{invoiceCountByRemittanceId[r.id] ?? 0}</td>
                    <td className="p-3">{money(r.total_amount)}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${remittanceStatusClass(r.status)}`}>
                        {remittanceStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="p-3">{r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "-"}</td>
                    <td className="p-3">
                      {r.payment_method === "pix" ? (
                        <>
                          {r.pix_qr_code_url ? (
                            <a href={r.pix_qr_code_url} target="_blank" rel="noreferrer" className="text-sky-700 underline">Abrir QR PIX</a>
                          ) : (
                            <span className="text-slate-500">PIX nao gerado</span>
                          )}
                          {r.pix_copy_paste ? <p className="mt-1 break-all text-xs text-slate-500">{r.pix_copy_paste}</p> : null}
                        </>
                      ) : (
                        <>
                          {r.boleto_url ? (
                            <a href={r.boleto_url} target="_blank" rel="noreferrer" className="text-sky-700 underline">Abrir boleto</a>
                          ) : (
                            <span className="text-slate-500">Boleto nao gerado</span>
                          )}
                          {r.boleto_digitable_line ? <p className="mt-1 break-all text-xs text-slate-500">{r.boleto_digitable_line}</p> : null}
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="space-y-2">
                        {(filesByRemittanceId[r.id] ?? []).slice(0, 2).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => void openRemittanceFile(f.id)}
                            className="block w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {f.file_name ?? "comprovante"}
                          </button>
                        ))}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="text-xs"
                          onChange={(e) =>
                            setPendingFileByRemittanceId((prev) => ({
                              ...prev,
                              [r.id]: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => void uploadRemittanceFile(r.id)}
                          disabled={uploadingFileId === r.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {uploadingFileId === r.id ? "Enviando..." : "Anexar"}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void generateBoleto(r.id)}
                          disabled={generatingBoletoId === r.id || r.status === "paid" || r.status === "cancelled"}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {generatingBoletoId === r.id ? "Gerando..." : "Gerar boleto"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void generatePix(r.id)}
                          disabled={generatingPixId === r.id || r.status === "paid" || r.status === "cancelled"}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {generatingPixId === r.id ? "Gerando..." : "Gerar PIX"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadCnab(r.id)}
                          disabled={downloadingCnabId === r.id || r.status === "cancelled"}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {downloadingCnabId === r.id ? "Gerando..." : "Baixar CNAB Bradesco"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void markAsPaid(r.id)}
                          disabled={markingPaidId === r.id || r.status === "paid" || r.status === "cancelled"}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {markingPaidId === r.id ? "Salvando..." : "Marcar como paga"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="p-3 text-slate-500">Nenhuma remessa criada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
