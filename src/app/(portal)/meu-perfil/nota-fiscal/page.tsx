"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, RefreshCcw, Send, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type InvoiceStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled";
type IntegrationProvider = "sougov" | "portal_estadual" | "portal_municipal" | "custom";

type InvoiceRow = {
  id: string;
  user_id: string;
  reference_month: string;
  invoice_number: string | null;
  issue_date: string | null;
  gross_amount: number | null;
  integration_provider: IntegrationProvider;
  integration_url: string | null;
  status: InvoiceStatus;
  notes: string | null;
  sent_at: string | null;
  updated_at: string;
};

type AllocationRow = {
  project_id: string;
  allocation_pct: number;
  projects: { id: string; name: string }[] | { id: string; name: string } | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  preferred_provider: IntegrationProvider;
  cnpj_prestador: string;
  simples_nacional: boolean;
  inscricao_municipal: string | null;
  nfs_password_set: boolean;
};

type InvoiceJobRow = {
  id: string;
  invoice_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  updated_at: string;
};

const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  sougov: "SouGov",
  portal_estadual: "Portal estadual",
  portal_municipal: "Portal municipal",
  custom: "Outro portal",
};

function statusLabel(status: InvoiceStatus) {
  if (status === "draft") return "Cadastrada";
  if (status === "submitted") return "Emitida";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Reprovada";
  return "Cancelada";
}

function statusClass(status: InvoiceStatus) {
  if (status === "draft") return "bg-violet-50 text-violet-700";
  if (status === "submitted") return "bg-emerald-50 text-emerald-700";
  if (status === "approved") return "bg-sky-50 text-sky-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function jobStatusLabel(status: InvoiceJobRow["status"]) {
  if (status === "queued") return "Na fila";
  if (status === "running") return "Processando";
  if (status === "succeeded") return "Concluido";
  if (status === "failed") return "Falhou";
  return "Cancelado";
}

function jobStatusClass(status: InvoiceJobRow["status"]) {
  if (status === "queued") return "bg-amber-50 text-amber-700";
  if (status === "running") return "bg-sky-50 text-sky-700";
  if (status === "succeeded") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function monthToDate(month: string) {
  return `${month}-01`;
}

export default function MeuPerfilNotaFiscalPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [latestJobByInvoiceId, setLatestJobByInvoiceId] = useState<Record<string, InvoiceJobRow>>({});
  const [allocations, setAllocations] = useState<Array<{ project_name: string; allocation_pct: number }>>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [cnpjPrestador, setCnpjPrestador] = useState("");
  const [simplesNacional, setSimplesNacional] = useState(false);
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [preferredProvider, setPreferredProvider] = useState<IntegrationProvider>("sougov");

  const [emitOpen, setEmitOpen] = useState(false);
  const [emitDate, setEmitDate] = useState(new Date().toISOString().slice(0, 10));
  const [emitReferenceMonth, setEmitReferenceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [emitValue, setEmitValue] = useState("");
  const [emitInvoiceNumber, setEmitInvoiceNumber] = useState("");
  const [emitIssWithheld, setEmitIssWithheld] = useState(false);
  const [emitNotes, setEmitNotes] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploadReferenceMonth, setUploadReferenceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [uploadInvoiceNumber, setUploadInvoiceNumber] = useState("");
  const [uploadValue, setUploadValue] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [enqueuingId, setEnqueuingId] = useState<string | null>(null);

  const allocationSummary = useMemo(() => {
    const total = allocations.reduce((acc, item) => acc + Number(item.allocation_pct || 0), 0);
    return Number(total.toFixed(2));
  }, [allocations]);

  function buildAutomaticNotes(referenceMonth: string) {
    if (!allocations.length) return "Sem rateio de projetos configurado para o colaborador no periodo.";
    const lines = allocations.map((item) => `- ${item.project_name}: ${Number(item.allocation_pct).toFixed(2)}%`);
    return [`Rateio por projeto (${referenceMonth}):`, ...lines, `Total: ${allocationSummary.toFixed(2)}%`].join("\n");
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      const uid = authData.user.id;
      setUserId(uid);

      const [invoiceRes, allocationRes, profileRes] = await Promise.all([
        supabase
          .from("collaborator_invoices")
          .select("id,user_id,reference_month,invoice_number,issue_date,gross_amount,integration_provider,integration_url,status,notes,sent_at,updated_at")
          .eq("user_id", uid)
          .order("issue_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase.from("project_member_allocations").select("project_id,allocation_pct,projects(id,name)").eq("user_id", uid),
        supabase
          .from("collaborator_invoice_integration_profiles")
          .select("id,user_id,preferred_provider,cnpj_prestador,simples_nacional,inscricao_municipal,nfs_password_set")
          .eq("user_id", uid)
          .maybeSingle<ProfileRow>(),
      ]);

      if (invoiceRes.error) throw new Error(invoiceRes.error.message);
      if (allocationRes.error) throw new Error(allocationRes.error.message);
      if (profileRes.error) throw new Error(profileRes.error.message);

      const invoiceRows = (invoiceRes.data ?? []) as InvoiceRow[];
      setInvoices(invoiceRows);
      setProfile(profileRes.data ?? null);

      if (invoiceRows.length) {
        const jobRes = await supabase
          .from("collaborator_invoice_jobs")
          .select("id,invoice_id,status,attempts,max_attempts,last_error,updated_at,created_at")
          .in(
            "invoice_id",
            invoiceRows.map((x) => x.id)
          )
          .order("created_at", { ascending: false });
        if (!jobRes.error) {
          const map: Record<string, InvoiceJobRow> = {};
          for (const job of (jobRes.data ?? []) as Array<InvoiceJobRow & { created_at?: string }>) {
            if (!map[job.invoice_id]) map[job.invoice_id] = job;
          }
          setLatestJobByInvoiceId(map);
        } else {
          // Nao quebra a tela caso migration ainda nao tenha sido aplicada.
          setLatestJobByInvoiceId({});
        }
      } else {
        setLatestJobByInvoiceId({});
      }

      const allocationData = ((allocationRes.data ?? []) as AllocationRow[]).map((row) => ({
        project_name: Array.isArray(row.projects)
          ? (row.projects[0]?.name ?? row.project_id)
          : (row.projects?.name ?? row.project_id),
        allocation_pct: Number(row.allocation_pct ?? 0),
      }));
      setAllocations(allocationData);

      if (!profileRes.data) {
        setOnboardingStep(1);
        setOnboardingOpen(true);
      } else {
        setPreferredProvider(profileRes.data.preferred_provider);
        setCnpjPrestador(profileRes.data.cnpj_prestador);
        setSimplesNacional(profileRes.data.simples_nacional);
        setInscricaoMunicipal(profileRes.data.inscricao_municipal ?? "");
      }
    } catch (e: unknown) {
      setInvoices([]);
      setLatestJobByInvoiceId({});
      setAllocations([]);
      setProfile(null);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar notas fiscais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveOnboardingStep1() {
    if (!userId) return;
    if (!cnpjPrestador.trim()) {
      setMsg("Informe o CNPJ do prestador.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        user_id: userId,
        preferred_provider: preferredProvider,
        cnpj_prestador: cnpjPrestador.trim(),
        simples_nacional: simplesNacional,
        inscricao_municipal: inscricaoMunicipal.trim() || null,
        nfs_password_set: profile?.nfs_password_set ?? false,
      };
      const { error } = await supabase.from("collaborator_invoice_integration_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      setOnboardingStep(2);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar associacao.");
    } finally {
      setBusy(false);
    }
  }

  async function saveOnboardingStep2(skip: boolean) {
    if (!userId) return;
    setBusy(true);
    setMsg("");
    try {
      if (!skip && passwordInput.trim()) {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token ?? null;
        const credRes = await fetch("/api/invoices/integration/credentials", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ provider: preferredProvider, password: passwordInput.trim() }),
        });
        const credJson = (await credRes.json()) as { ok?: boolean; error?: string };
        if (!credRes.ok) throw new Error(credJson.error || `Falha ao salvar credencial (status ${credRes.status})`);
      }

      const setFlag = skip ? profile?.nfs_password_set ?? false : Boolean(passwordInput.trim());
      const { error } = await supabase
        .from("collaborator_invoice_integration_profiles")
        .update({
          preferred_provider: preferredProvider,
          cnpj_prestador: cnpjPrestador.trim(),
          simples_nacional: simplesNacional,
          inscricao_municipal: inscricaoMunicipal.trim() || null,
          nfs_password_set: setFlag,
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      setOnboardingOpen(false);
      setPasswordInput("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar etapa.");
    } finally {
      setBusy(false);
    }
  }

  async function createInvoiceFromEmit() {
    if (!userId) return;
    if (!emitReferenceMonth) return setMsg("Informe a competencia.");
    if (!emitValue.trim()) return setMsg("Informe o valor da nota.");

    setBusy(true);
    setMsg("");
    try {
      const valueNum = Number(emitValue.replace(",", "."));
      if (!Number.isFinite(valueNum)) throw new Error("Valor invalido.");
      const finalNotes = [emitNotes.trim(), emitIssWithheld ? "ISS retido na fonte: sim." : "ISS retido na fonte: nao."]
        .filter(Boolean)
        .join("\n");

      const payload = {
        user_id: userId,
        reference_month: monthToDate(emitReferenceMonth),
        invoice_number: emitInvoiceNumber.trim() || null,
        issue_date: emitDate || null,
        gross_amount: valueNum,
        integration_provider: preferredProvider,
        integration_url: null,
        status: "submitted" as const,
        sent_at: new Date().toISOString(),
        notes: finalNotes || null,
        project_allocation_snapshot: allocations,
      };
      const insertRes = await supabase.from("collaborator_invoices").insert(payload).select("id").single<{ id: string }>();
      if (insertRes.error || !insertRes.data?.id) throw new Error(insertRes.error?.message || "Falha ao criar nota.");

      const queued = await enqueueAutomaticIssue(insertRes.data.id, { silent: true, skipReload: true });

      setEmitOpen(false);
      setEmitValue("");
      setEmitInvoiceNumber("");
      setEmitNotes("");
      setMsg(queued ? "Nota emitida e enfileirada para automacao." : "Nota emitida. Nao foi possivel enfileirar automaticamente.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao emitir nota.");
    } finally {
      setBusy(false);
    }
  }

  async function createInvoiceWithUpload() {
    if (!userId) return;
    if (!uploadFile) return setMsg("Selecione um arquivo PDF ou XML.");
    if (!uploadReferenceMonth) return setMsg("Informe a competencia.");
    if (!uploadValue.trim()) return setMsg("Informe o valor da nota.");

    setBusy(true);
    setMsg("");
    try {
      const valueNum = Number(uploadValue.replace(",", "."));
      if (!Number.isFinite(valueNum)) throw new Error("Valor invalido.");

      const insertRes = await supabase
        .from("collaborator_invoices")
        .insert({
          user_id: userId,
          reference_month: monthToDate(uploadReferenceMonth),
          invoice_number: uploadInvoiceNumber.trim() || null,
          issue_date: uploadDate || null,
          gross_amount: valueNum,
          integration_provider: preferredProvider,
          integration_url: null,
          status: "submitted",
          sent_at: new Date().toISOString(),
          notes: buildAutomaticNotes(uploadReferenceMonth),
          project_allocation_snapshot: allocations,
        })
        .select("id")
        .single<{ id: string }>();
      if (insertRes.error || !insertRes.data?.id) throw new Error(insertRes.error?.message || "Nao foi possivel criar a nota.");

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const fd = new FormData();
      fd.append("invoice_id", insertRes.data.id);
      fd.append("file", uploadFile);

      const uploadRes = await fetch("/api/invoices/files/upload", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const uploadJson = (await uploadRes.json()) as { error?: string };
      if (!uploadRes.ok) throw new Error(uploadJson.error || `Erro ao enviar arquivo (status ${uploadRes.status})`);

      setUploadOpen(false);
      setUploadInvoiceNumber("");
      setUploadValue("");
      setUploadFile(null);
      setMsg("Nota cadastrada e arquivo enviado.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao cadastrar upload de nota.");
    } finally {
      setBusy(false);
    }
  }

  async function launchIntegration(invoiceId: string) {
    setLaunchingId(invoiceId);
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const res = await fetch("/api/invoices/integration/prepare", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || `Falha na integracao (status ${res.status})`);
      window.open(json.url, "_blank", "noreferrer");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir integracao.");
    } finally {
      setLaunchingId(null);
    }
  }

  async function enqueueAutomaticIssue(invoiceId: string, opts?: { silent?: boolean; skipReload?: boolean }) {
    setEnqueuingId(invoiceId);
    if (!opts?.silent) setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      const res = await fetch("/api/invoices/automation/enqueue", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const json = (await res.json()) as { ok?: boolean; job_id?: string; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `Falha ao enfileirar emissao (status ${res.status})`);
      if (!opts?.silent) setMsg("Emissao automatica enfileirada com sucesso.");
      if (!opts?.skipReload) await load();
      return true;
    } catch (e: unknown) {
      if (!opts?.silent) setMsg(e instanceof Error ? e.message : "Erro ao enfileirar emissao automatica.");
      return false;
    } finally {
      setEnqueuingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Notas fiscais</h1>
            <p className="mt-1 text-sm text-slate-600">Emita, faca upload ou envie notas fiscais para contratante.</p>
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Configuracao para emissao automatica (SouGov)</p>
        <p className="mt-1">1. Preencha o onboarding em `Configurar integracao` (CNPJ, portal e senha).</p>
        <p>2. Garanta no `.env.local`: `INVOICE_CREDENTIALS_ENCRYPTION_KEY`.</p>
        <p>3. Para API oficial configure: `SOUGOV_NF_API_URL` e `SOUGOV_NF_API_TOKEN`.</p>
        <p>4. Fallback por portal externo: `SOUGOV_NF_BASE_URL`.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setOnboardingStep(1);
              setOnboardingOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Configurar integracao
          </button>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            <Upload size={16} />
            Upload de notas
          </button>
          <button
            type="button"
            onClick={() => setEmitOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Send size={16} />
            Emitir nova nota
          </button>
        </div>

        {!loading && !invoices.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="mx-auto max-w-2xl text-sm text-slate-600">
              Nao ha nenhuma nota fiscal listada no momento. Clique em &quot;Emitir nova nota&quot; para gerar sua primeira nota na plataforma, ou em &quot;Upload de notas&quot; para subir uma nota ja emitida fora da plataforma.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Acao</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="p-3">{row.issue_date ? new Date(row.issue_date).toLocaleDateString("pt-BR") : "-"}</td>
                    <td className="p-3">{money(row.gross_amount)}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void enqueueAutomaticIssue(row.id)}
                          disabled={enqueuingId === row.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {enqueuingId === row.id ? "Enfileirando..." : "Emitir automatico"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void launchIntegration(row.id)}
                          disabled={launchingId === row.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <ExternalLink size={14} />
                          {launchingId === row.id ? "Abrindo..." : "Abrir portal"}
                        </button>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                          <Eye size={14} />
                          {PROVIDER_LABEL[row.integration_provider]}
                        </span>
                        {latestJobByInvoiceId[row.id] ? (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${jobStatusClass(
                              latestJobByInvoiceId[row.id].status
                            )}`}
                          >
                            Job: {jobStatusLabel(latestJobByInvoiceId[row.id].status)}
                          </span>
                        ) : null}
                      </div>
                      {latestJobByInvoiceId[row.id]?.last_error ? (
                        <p className="mt-2 text-xs text-rose-700">{latestJobByInvoiceId[row.id].last_error}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-slate-500">
                      Carregando...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Rateio de contribuicao por projeto</p>
        <p className="mt-1 text-xs text-slate-600">Total atual: {allocationSummary.toFixed(2)}%</p>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {allocations.length ? (
            allocations.map((item) => (
              <p key={item.project_name}>
                {item.project_name}: {item.allocation_pct.toFixed(2)}%
              </p>
            ))
          ) : (
            <p>Sem rateio cadastrado.</p>
          )}
        </div>
      </div>

      {onboardingOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{onboardingStep === 1 ? "Associacao de dados" : "Senha para emissao de nota - MEI"}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {onboardingStep === 1
                    ? "No primeiro acesso, informe os dados para comunicar com o portal de emissao."
                    : "Informe a senha do portal NFS-e Contribuinte. Opcional para os demais recursos."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {onboardingStep === 1 ? (
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  CNPJ do prestador
                  <input value={cnpjPrestador} onChange={(e) => setCnpjPrestador(e.target.value)} placeholder="00.000.000/0000-00" className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Portal padrao
                  <select value={preferredProvider} onChange={(e) => setPreferredProvider(e.target.value as IntegrationProvider)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900">
                    <option value="sougov">SouGov</option>
                    <option value="portal_estadual">Portal estadual</option>
                    <option value="portal_municipal">Portal municipal</option>
                    <option value="custom">Outro portal</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Inscricao municipal
                  <input value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} placeholder="Numero da inscricao municipal" className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" />
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={simplesNacional} onChange={(e) => setSimplesNacional(e.target.checked)} />
                  CNPJ inscrito no Simples Nacional
                </label>
              </div>
            ) : (
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Senha de acesso ao Portal de Gestao NFS-e Contribuinte
                  <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Senha" className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" />
                </label>
                <p className="text-xs text-slate-500">Por seguranca, a senha nao e armazenada em texto aberto.</p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOnboardingOpen(false)}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Fechar
              </button>
              {onboardingStep === 2 ? (
                <button type="button" onClick={() => void saveOnboardingStep2(true)} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  Pular
                </button>
              ) : null}
              <button type="button" onClick={() => void (onboardingStep === 1 ? saveOnboardingStep1() : saveOnboardingStep2(false))} disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {onboardingStep === 1 ? "Continuar" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {emitOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-2xl font-semibold text-slate-900">Emissao de notas</h2>
              <button type="button" onClick={() => setEmitOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Data<input type="date" value={emitDate} onChange={(e) => setEmitDate(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Competencia<input type="month" value={emitReferenceMonth} onChange={(e) => setEmitReferenceMonth(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Numero da nota<input value={emitInvoiceNumber} onChange={(e) => setEmitInvoiceNumber(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Valor do servico<input value={emitValue} onChange={(e) => setEmitValue(e.target.value)} placeholder="0,00" className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-700">O ISS e retido na fonte?</p>
                <div className="mt-2 flex gap-4 text-sm text-slate-700">
                  <label className="inline-flex items-center gap-2"><input type="radio" checked={emitIssWithheld} onChange={() => setEmitIssWithheld(true)} />Sim</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" checked={!emitIssWithheld} onChange={() => setEmitIssWithheld(false)} />Nao</label>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Observacoes automaticas por projeto</p>
                <button type="button" onClick={() => setEmitNotes(buildAutomaticNotes(emitReferenceMonth))} className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Gerar observacoes</button>
              </div>
            </div>
            <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
              Observacoes
              <textarea value={emitNotes} onChange={(e) => setEmitNotes(e.target.value)} className="min-h-[110px] rounded-xl border border-slate-200 p-3 text-sm text-slate-900" placeholder="Descreva a prestacao do servico." />
            </label>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => void createInvoiceFromEmit()} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Emitir</button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Cadastro de notas</h2>
                <p className="mt-1 text-sm text-slate-600">Faca upload do arquivo de nota e preencha os campos.</p>
              </div>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Numero da nota<input value={uploadInvoiceNumber} onChange={(e) => setUploadInvoiceNumber(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Valor da nota<input value={uploadValue} onChange={(e) => setUploadValue(e.target.value)} placeholder="0,00" className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Data de emissao<input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Competencia<input type="month" value={uploadReferenceMonth} onChange={(e) => setUploadReferenceMonth(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900" /></label>
            </div>
            <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
              Arquivo da nota fiscal
              <input type="file" accept="application/pdf,application/xml,text/xml" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700" />
            </label>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => void createInvoiceWithUpload()} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Confirmar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
