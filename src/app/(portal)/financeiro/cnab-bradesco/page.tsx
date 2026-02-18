"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type CnabSettings = {
  config_key: string;
  bank_code: string;
  layout_version: string;
  company_name: string | null;
  company_cnpj: string | null;
  agreement_code: string | null;
  debit_agency: string | null;
  debit_agency_digit: string | null;
  debit_account: string | null;
  debit_account_digit: string | null;
  transmission_code: string | null;
  next_file_sequence: number;
  enabled: boolean;
};

type PaymentRow = {
  id: string;
  project_id: string;
  user_id: string;
  amount: number | null;
  reference_month: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  description: string | null;
};

type ProjectRow = { id: string; name: string };
type CollabRow = {
  user_id: string | null;
  nome: string | null;
  cpf: string | null;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
};

const CONFIG_KEY = "bradesco_cnab240_pagamentos";

function onlyDigits(v: string | null | undefined) {
  return String(v ?? "").replace(/\D/g, "");
}

function padRight(v: string, len: number, fill = " ") {
  return (v + fill.repeat(len)).slice(0, len);
}

function padLeft(v: string, len: number, fill = "0") {
  return (fill.repeat(len) + v).slice(-len);
}

function formatAmountCnab(v: number) {
  const cents = Math.round(Math.max(0, v) * 100);
  return padLeft(String(cents), 15, "0");
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanceiroCnabBradescoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  const [settings, setSettings] = useState<CnabSettings | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [projectById, setProjectById] = useState<Record<string, ProjectRow>>({});
  const [collabByUserId, setCollabByUserId] = useState<Record<string, CollabRow>>({});
  const [selectedById, setSelectedById] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setMeId(authData.user.id);

      const [cfgRes, payRes] = await Promise.all([
        supabase.from("finance_cnab_settings").select("*").eq("config_key", CONFIG_KEY).maybeSingle<CnabSettings>(),
        supabase
          .from("project_extra_payments")
          .select("id,project_id,user_id,amount,reference_month,status,created_at,description")
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
      ]);

      if (cfgRes.error) throw new Error(cfgRes.error.message);
      if (payRes.error) throw new Error(payRes.error.message);

      const cfg = cfgRes.data ?? null;
      setSettings(cfg);
      const payRows = (payRes.data ?? []) as PaymentRow[];
      setPayments(payRows);

      const projectIds = Array.from(new Set(payRows.map((x) => x.project_id).filter(Boolean)));
      const userIds = Array.from(new Set(payRows.map((x) => x.user_id).filter(Boolean)));

      const [projectRes, collabRes] = await Promise.all([
        projectIds.length
          ? supabase.from("projects").select("id,name").in("id", projectIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabase.from("colaboradores").select("user_id,nome,cpf,banco,agencia,conta_corrente").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (projectRes.error) throw new Error(projectRes.error.message);
      if (collabRes.error) throw new Error(collabRes.error.message);

      const pMap: Record<string, ProjectRow> = {};
      for (const p of (projectRes.data ?? []) as ProjectRow[]) pMap[p.id] = p;
      setProjectById(pMap);

      const cMap: Record<string, CollabRow> = {};
      for (const c of (collabRes.data ?? []) as CollabRow[]) {
        const uid = String(c.user_id ?? "");
        if (uid) cMap[uid] = c;
      }
      setCollabByUserId(cMap);

      setSelectedById((prev) => {
        const next: Record<string, boolean> = {};
        for (const p of payRows) next[p.id] = prev[p.id] ?? true;
        return next;
      });
    } catch (e: unknown) {
      setSettings(null);
      setPayments([]);
      setProjectById({});
      setCollabByUserId({});
      setSelectedById({});
      setMsg(e instanceof Error ? e.message : "Erro ao carregar configuracao CNAB.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedPayments = useMemo(
    () => payments.filter((p) => selectedById[p.id]),
    [payments, selectedById]
  );

  async function saveSettings() {
    if (!settings || !meId) return;
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        ...settings,
        updated_by: meId,
      };
      const { error } = await supabase.from("finance_cnab_settings").upsert(payload, { onConflict: "config_key" });
      if (error) throw new Error(error.message);
      setMsg("Configuracao CNAB salva.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar configuracao CNAB.");
    } finally {
      setSaving(false);
    }
  }

  function validateForRemittance() {
    const errors: string[] = [];
    if (!settings) errors.push("Configuracao CNAB nao encontrada (rode a migration).");
    if (!settings?.company_name?.trim()) errors.push("Preencha razao social da empresa.");
    if (onlyDigits(settings?.company_cnpj).length !== 14) errors.push("Preencha CNPJ da empresa com 14 digitos.");
    if (!onlyDigits(settings?.debit_agency)) errors.push("Preencha agencia de debito.");
    if (!onlyDigits(settings?.debit_account)) errors.push("Preencha conta de debito.");
    if (!settings?.agreement_code?.trim()) errors.push("Preencha codigo do convenio.");
    if (!settings?.transmission_code?.trim()) errors.push("Preencha codigo de transmissao.");
    if (!selectedPayments.length) errors.push("Selecione ao menos um pagamento aprovado.");
    return errors;
  }

  function generateRemittance() {
    const errors = validateForRemittance();
    if (errors.length) {
      setMsg(errors.join(" "));
      return;
    }
    if (!settings) return;

    const validPayments: PaymentRow[] = [];
    let skipped = 0;
    for (const p of selectedPayments) {
      const c = collabByUserId[p.user_id];
      const hasCpf = onlyDigits(c?.cpf).length === 11;
      const hasAgency = onlyDigits(c?.agencia).length > 0;
      const hasAccount = onlyDigits(c?.conta_corrente).length > 0;
      const hasName = (c?.nome ?? "").trim().length > 0;
      const hasAmount = Number(p.amount ?? 0) > 0;
      if (hasCpf && hasAgency && hasAccount && hasName && hasAmount) validPayments.push(p);
      else skipped += 1;
    }
    if (!validPayments.length) {
      setMsg("Nenhum pagamento selecionado possui dados bancarios minimos (CPF/agencia/conta/nome).");
      return;
    }

    const now = new Date();
    const ddmmyyyy = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
    const seq = settings.next_file_sequence || 1;
    const fileSeq = padLeft(String(seq), 6, "0");

    const bankCode = padLeft(onlyDigits(settings.bank_code) || "237", 3, "0");
    const companyCnpj = padLeft(onlyDigits(settings.company_cnpj), 14, "0");
    const agency = padLeft(onlyDigits(settings.debit_agency), 5, "0");
    const agencyDv = padRight((settings.debit_agency_digit ?? "").trim(), 1, " ");
    const account = padLeft(onlyDigits(settings.debit_account), 12, "0");
    const accountDv = padRight((settings.debit_account_digit ?? "").trim(), 1, " ");
    const companyName = padRight((settings.company_name ?? "").trim().toUpperCase(), 30, " ");
    const agreement = padRight((settings.agreement_code ?? "").trim(), 20, " ");
    const transmission = padRight((settings.transmission_code ?? "").trim(), 20, " ");

    const lines: string[] = [];

    // Header arquivo (240 chars)
    const headerFile =
      bankCode +
      "0000" +
      "0" +
      padRight("", 9) +
      "2" +
      companyCnpj +
      agreement +
      agency +
      agencyDv +
      account +
      accountDv +
      " " +
      companyName +
      padRight("BRADESCO", 30) +
      padRight("", 10) +
      "1" +
      ddmmyyyy +
      padLeft(String(now.getHours()), 2) +
      padLeft(String(now.getMinutes()), 2) +
      fileSeq +
      "097" +
      "01600" +
      padRight("", 69);
    lines.push(padRight(headerFile, 240));

    // Header lote
    const headerBatch =
      bankCode +
      "0001" +
      "1" +
      "C" +
      "20" +
      "01" +
      "045" +
      "040" +
      " " +
      "2" +
      companyCnpj +
      agreement +
      agency +
      agencyDv +
      account +
      accountDv +
      " " +
      companyName +
      transmission +
      padRight("", 8) +
      padRight("", 33) +
      padRight("", 10);
    lines.push(padRight(headerBatch, 240));

    let recordSeq = 1;
    let totalAmount = 0;

    for (const pay of validPayments) {
      const c = collabByUserId[pay.user_id]!;
      const favBank = padLeft(onlyDigits(c.banco) || "237", 3, "0");
      const favAgency = padLeft(onlyDigits(c.agencia), 5, "0");
      const favAccount = padLeft(onlyDigits(c.conta_corrente), 12, "0");
      const favName = padRight((c.nome ?? "FAVORECIDO").trim().toUpperCase(), 30, " ");
      const favCpf = padLeft(onlyDigits(c.cpf), 11, "0");
      const amount = Number(pay.amount ?? 0);
      totalAmount += amount;

      const segA =
        bankCode +
        "0001" +
        "3" +
        padLeft(String(recordSeq), 5, "0") +
        "A" +
        "0" +
        "00" +
        favBank +
        favAgency +
        " " +
        favAccount +
        " " +
        " " +
        favName +
        padRight("", 20) +
        ddmmyyyy +
        "BRL" +
        formatAmountCnab(amount) +
        padRight("", 20) +
        ddmmyyyy +
        formatAmountCnab(amount) +
        padRight("", 62);
      lines.push(padRight(segA, 240));
      recordSeq += 1;

      const segB =
        bankCode +
        "0001" +
        "3" +
        padLeft(String(recordSeq), 5, "0") +
        "B" +
        " " +
        padRight("", 3) +
        padLeft(favCpf, 14, "0") +
        padRight("", 86) +
        padRight(projectById[pay.project_id]?.name ?? "", 30).toUpperCase() +
        padRight("", 77);
      lines.push(padRight(segB, 240));
      recordSeq += 1;
    }

    const lotRecords = recordSeq + 2;
    const trailerBatch =
      bankCode +
      "0001" +
      "5" +
      padRight("", 9) +
      padLeft(String(lotRecords), 6, "0") +
      formatAmountCnab(totalAmount) +
      padRight("", 199);
    lines.push(padRight(trailerBatch, 240));

    const fileRecords = lines.length + 2;
    const trailerFile =
      bankCode +
      "9999" +
      "9" +
      padRight("", 9) +
      padLeft("1", 6, "0") +
      padLeft(String(fileRecords), 6, "0") +
      padRight("", 211);
    lines.push(padRight(trailerFile, 240));

    const content = lines.join("\r\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bradesco_cnab240_pagamentos_${now.toISOString().slice(0, 10)}.rem`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setMsg(
      `Arquivo gerado para homologacao: ${validPayments.length} pagamento(s) incluidos, ${skipped} ignorado(s) por dados incompletos.`
    );
  }

  const selectedTotal = useMemo(
    () => selectedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [selectedPayments]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">CNAB Bradesco - Pagamentos em massa</h1>
            <p className="mt-1 text-sm text-slate-600">
              Estrutura inicial para homologacao CNAB240. Ajuste os dados oficiais do convenio antes de uso em producao.
            </p>
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

      {msg ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-900">Configuracao do convenio Bradesco</p>
        {settings ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="Codigo banco" value={settings.bank_code} onChange={(v) => setSettings((p) => (p ? { ...p, bank_code: v } : p))} />
            <Field label="Layout" value={settings.layout_version} onChange={(v) => setSettings((p) => (p ? { ...p, layout_version: v } : p))} />
            <Field label="Sequencia arquivo" value={String(settings.next_file_sequence)} onChange={(v) => setSettings((p) => (p ? { ...p, next_file_sequence: Math.max(1, Number(v) || 1) } : p))} />
            <Field label="Razao social" value={settings.company_name ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, company_name: v } : p))} />
            <Field label="CNPJ empresa" value={settings.company_cnpj ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, company_cnpj: v } : p))} />
            <Field label="Codigo convenio" value={settings.agreement_code ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, agreement_code: v } : p))} />
            <Field label="Agencia debito" value={settings.debit_agency ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, debit_agency: v } : p))} />
            <Field label="DV agencia" value={settings.debit_agency_digit ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, debit_agency_digit: v } : p))} />
            <Field label="Conta debito" value={settings.debit_account ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, debit_account: v } : p))} />
            <Field label="DV conta" value={settings.debit_account_digit ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, debit_account_digit: v } : p))} />
            <Field label="Codigo transmissao" value={settings.transmission_code ?? ""} onChange={(v) => setSettings((p) => (p ? { ...p, transmission_code: v } : p))} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Configuracao nao encontrada. Rode a migration de CNAB.</p>
        )}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving || loading || !settings}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar configuracao"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Pagamentos aprovados para remessa</p>
          <div className="text-sm text-slate-600">
            Selecionados: {selectedPayments.length} | Total: {fmtMoney(selectedTotal)}
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Sel.</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Projeto</th>
                <th className="p-3">Banco/Ag/Conta</th>
                <th className="p-3">Referencia</th>
                <th className="p-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-3 text-slate-500" colSpan={6}>Carregando...</td></tr>
              ) : payments.length ? (
                payments.map((p) => {
                  const c = collabByUserId[p.user_id];
                  const bankInfo = `${c?.banco ?? "-"} / ${c?.agencia ?? "-"} / ${c?.conta_corrente ?? "-"}`;
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={!!selectedById[p.id]}
                          onChange={(e) => setSelectedById((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="p-3">{c?.nome ?? `Usuario ${p.user_id.slice(0, 8)}`}</td>
                      <td className="p-3">{projectById[p.project_id]?.name ?? p.project_id}</td>
                      <td className="p-3">{bankInfo}</td>
                      <td className="p-3">{String(p.reference_month ?? "").slice(0, 7) || "-"}</td>
                      <td className="p-3">{fmtMoney(Number(p.amount) || 0)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td className="p-3 text-slate-500" colSpan={6}>Sem pagamentos aprovados no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => generateRemittance()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <Download size={16} />
            Gerar arquivo CNAB (.rem)
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-700">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
      />
    </label>
  );
}
