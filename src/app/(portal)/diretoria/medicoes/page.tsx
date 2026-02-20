"use client";

import { useEffect, useMemo, useState } from "react";
import { ReceiptText, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import DiretoriaPageHeader from "@/components/portal/DiretoriaPageHeader";

type ProjectRow = { id: string; name: string; status: "active" | "paused" | "done" };

type BulletinStatus =
  | "em_analise"
  | "faturado"
  | "enviado_cliente"
  | "previsao_pagamento"
  | "pago"
  | "parcialmente_pago"
  | "atrasado"
  | "cancelado"
  | "outro";

type BulletinRow = {
  id: string;
  project_id: string;
  reference_month: string;
  bulletin_number: string | null;
  invoice_number: string | null;
  amount_total: number;
  paid_amount: number | null;
  status: BulletinStatus;
  issue_date: string | null;
  expected_payment_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(v: BulletinStatus) {
  if (v === "em_analise") return "Em analise";
  if (v === "faturado") return "Faturado";
  if (v === "enviado_cliente") return "Enviado ao cliente";
  if (v === "previsao_pagamento") return "Previsao de pagamento";
  if (v === "pago") return "Pago";
  if (v === "parcialmente_pago") return "Parcialmente pago";
  if (v === "atrasado") return "Atrasado";
  if (v === "cancelado") return "Cancelado";
  return "Outro";
}

function statusClass(v: BulletinStatus) {
  if (v === "pago") return "bg-emerald-50 text-emerald-700";
  if (v === "parcialmente_pago" || v === "previsao_pagamento") return "bg-amber-50 text-amber-700";
  if (v === "atrasado" || v === "cancelado") return "bg-rose-50 text-rose-700";
  if (v === "faturado" || v === "enviado_cliente") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function toNumber(v: string) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function DiretoriaMedicoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState("");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [rows, setRows] = useState<BulletinRow[]>([]);

  const [projectId, setProjectId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(() => new Date().toISOString().slice(0, 10));
  const [bulletinNumber, setBulletinNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amountTotal, setAmountTotal] = useState("");
  const [status, setStatus] = useState<BulletinStatus>("em_analise");
  const [issueDate, setIssueDate] = useState("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");

  const [projectFilter, setProjectFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BulletinStatus>("all");

  const projectById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, projectFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const totalAmount = filteredRows.reduce((acc, r) => acc + (Number(r.amount_total) || 0), 0);
    const paid = filteredRows.reduce((acc, r) => {
      const paidAmt = Number(r.paid_amount);
      if (Number.isFinite(paidAmt)) return acc + paidAmt;
      if (r.status === "pago") return acc + (Number(r.amount_total) || 0);
      return acc;
    }, 0);
    const open = filteredRows.filter((r) => !["pago", "cancelado"].includes(r.status)).length;
    return { total, totalAmount, paid, open };
  }, [filteredRows]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setMeId(authData.user.id);

      const [projectsRes, rowsRes] = await Promise.all([
        supabase.from("projects").select("id,name,status").order("created_at", { ascending: false }),
        supabase
          .from("project_measurement_bulletins")
          .select("id,project_id,reference_month,bulletin_number,invoice_number,amount_total,paid_amount,status,issue_date,expected_payment_date,paid_at,notes,created_at")
          .order("reference_month", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (projectsRes.error) throw new Error(projectsRes.error.message);
      if (rowsRes.error) throw new Error(rowsRes.error.message);

      const nextProjects = (projectsRes.data ?? []) as ProjectRow[];
      setProjects(nextProjects);
      setRows((rowsRes.data ?? []) as BulletinRow[]);
      setProjectId((prev) => prev || nextProjects[0]?.id || "");
    } catch (e: unknown) {
      setProjects([]);
      setRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar medicoes/boletins.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createBulletin() {
    if (!projectId) return setMsg("Selecione o projeto.");
    if (!referenceMonth) return setMsg("Informe a referencia.");
    const amount = toNumber(amountTotal.trim());
    if (!Number.isFinite(amount) || amount < 0) return setMsg("Informe valor valido.");

    const paid = paidAmount.trim() ? toNumber(paidAmount.trim()) : NaN;
    if (paidAmount.trim() && (!Number.isFinite(paid) || paid < 0)) return setMsg("Valor pago invalido.");

    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("project_measurement_bulletins").insert({
        project_id: projectId,
        reference_month: referenceMonth,
        bulletin_number: bulletinNumber.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        amount_total: amount,
        paid_amount: Number.isFinite(paid) ? paid : null,
        status,
        issue_date: issueDate || null,
        expected_payment_date: expectedPaymentDate || null,
        paid_at: paidAt || null,
        notes: notes.trim() || null,
        created_by: meId || null,
        updated_by: meId || null,
      });
      if (error) throw new Error(error.message);

      setBulletinNumber("");
      setInvoiceNumber("");
      setAmountTotal("");
      setStatus("em_analise");
      setIssueDate("");
      setExpectedPaymentDate("");
      setPaidAmount("");
      setPaidAt("");
      setNotes("");
      setMsg("Medicao/boletim registrado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar medicao/boletim.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row: BulletinRow, nextStatus: BulletinStatus) {
    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase
        .from("project_measurement_bulletins")
        .update({ status: nextStatus, updated_by: meId || null })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <DiretoriaPageHeader
        icon={ReceiptText}
        title="Diretoria - Medicoes e boletins"
        subtitle="Gere medicao/boletim para faturamento ao cliente e acompanhe previsao e pagamento."
        action={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        }
      />

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">{msg}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Gerar medicao/boletim</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Selecione...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Referencia
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as BulletinStatus)}>
              <option value="em_analise">Em analise</option>
              <option value="faturado">Faturado</option>
              <option value="enviado_cliente">Enviado ao cliente</option>
              <option value="previsao_pagamento">Previsao de pagamento</option>
              <option value="pago">Pago</option>
              <option value="parcialmente_pago">Parcialmente pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Numero do boletim
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={bulletinNumber} onChange={(e) => setBulletinNumber(e.target.value)} placeholder="Ex: MED-2026-015" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Numero da nota
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex: NF-10234" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Valor total (R$)
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={amountTotal} onChange={(e) => setAmountTotal(e.target.value)} placeholder="0,00" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Data emissao
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Previsao pagamento
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={expectedPaymentDate} onChange={(e) => setExpectedPaymentDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Valor pago
            <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0,00" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Data pagamento
            <input type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          Observacoes
          <textarea className="min-h-[88px] rounded-xl border border-slate-200 p-3 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informacoes complementares da medicao/boletim..." />
        </label>
        <button
          type="button"
          onClick={() => void createBulletin()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save size={16} /> Registrar boletim
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Acompanhamento de pagamento</h2>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Boletins</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Em aberto</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Valor total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtMoney(stats.totalAmount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Pago</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtMoney(stats.paid)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Projeto
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | BulletinStatus)}>
              <option value="all">Todos</option>
              <option value="em_analise">Em analise</option>
              <option value="faturado">Faturado</option>
              <option value="enviado_cliente">Enviado ao cliente</option>
              <option value="previsao_pagamento">Previsao de pagamento</option>
              <option value="pago">Pago</option>
              <option value="parcialmente_pago">Parcialmente pago</option>
              <option value="atrasado">Atrasado</option>
              <option value="cancelado">Cancelado</option>
              <option value="outro">Outro</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1160px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Projeto</th>
                <th className="p-3">Referencia</th>
                <th className="p-3">Boletim/NF</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Pago</th>
                <th className="p-3">Previsao</th>
                <th className="p-3">Status</th>
                <th className="p-3">Acao rapida</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{projectById[r.project_id] ?? r.project_id}</div>
                      <div className="text-xs text-slate-500">{r.notes ?? "-"}</div>
                    </td>
                    <td className="p-3 text-slate-600">{r.reference_month}</td>
                    <td className="p-3 text-slate-600">{r.bulletin_number ?? "-"} / {r.invoice_number ?? "-"}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">{fmtMoney(Number(r.amount_total) || 0)}</td>
                    <td className="p-3 text-right text-slate-700">{fmtMoney(Number(r.paid_amount) || 0)}</td>
                    <td className="p-3 text-slate-600">{r.expected_payment_date ?? "-"}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        value={r.status}
                        onChange={(e) => void updateStatus(r, e.target.value as BulletinStatus)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                      >
                        <option value="em_analise">Em analise</option>
                        <option value="faturado">Faturado</option>
                        <option value="enviado_cliente">Enviado ao cliente</option>
                        <option value="previsao_pagamento">Previsao de pagamento</option>
                        <option value="pago">Pago</option>
                        <option value="parcialmente_pago">Parcialmente pago</option>
                        <option value="atrasado">Atrasado</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="outro">Outro</option>
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={8}>
                    Nenhum boletim encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
