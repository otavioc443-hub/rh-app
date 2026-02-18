import { createDecipheriv, createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getInvoiceConnector } from "@/lib/invoices/connectors/registry";
import type { IntegrationProvider } from "@/lib/invoices/connectors/types";

type InvoiceRow = {
  id: string;
  user_id: string;
  reference_month: string;
  invoice_number: string | null;
  gross_amount: number | null;
  integration_provider: IntegrationProvider;
  integration_url: string | null;
  notes: string | null;
};

type IntegrationProfileRow = {
  preferred_provider: IntegrationProvider;
  cnpj_prestador: string;
  simples_nacional: boolean;
  inscricao_municipal: string | null;
  nfs_password_set: boolean;
};

type SecretRow = {
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
};

type JobRow = {
  id: string;
  invoice_id: string;
  user_id: string;
  provider: IntegrationProvider;
  job_kind: "issue" | "sync_status" | "download_pdf" | "download_xml" | "cancel";
  attempts: number;
  max_attempts: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
};

function getCryptoKey() {
  const raw = (process.env.INVOICE_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw, "utf8").digest();
}

function decryptSecret(secret: SecretRow) {
  const key = getCryptoKey();
  if (!key) return null;
  const iv = Buffer.from(secret.secret_iv, "base64");
  const ciphertext = Buffer.from(secret.secret_ciphertext, "base64");
  const tag = Buffer.from(secret.secret_tag, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

async function createJobEvent(jobId: string, eventType: string, message: string, metadata?: unknown) {
  await supabaseAdmin.from("collaborator_invoice_job_events").insert({
    job_id: jobId,
    event_type: eventType,
    message,
    metadata: metadata ?? null,
  });
}

export async function enqueueInvoiceIssueJob(invoiceId: string, userId: string, provider: IntegrationProvider) {
  const { data, error } = await supabaseAdmin
    .from("collaborator_invoice_jobs")
    .insert({
      invoice_id: invoiceId,
      user_id: userId,
      provider,
      job_kind: "issue",
      status: "queued",
      run_after: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    throw new Error(error?.message || "Falha ao enfileirar job de emissao.");
  }
  await createJobEvent(data.id, "created", "Job de emissao criado.");
  return data.id;
}

export async function processNextInvoiceJob(workerId: string) {
  const nowIso = new Date().toISOString();
  const candidateRes = await supabaseAdmin
    .from("collaborator_invoice_jobs")
    .select("id,invoice_id,user_id,provider,job_kind,attempts,max_attempts,status")
    .eq("status", "queued")
    .lte("run_after", nowIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<JobRow>();

  const candidate = candidateRes.data;
  if (candidateRes.error) throw new Error(candidateRes.error.message);
  if (!candidate) return { ok: true, processed: false };

  const lockRes = await supabaseAdmin
    .from("collaborator_invoice_jobs")
    .update({
      status: "running",
      attempts: candidate.attempts + 1,
      locked_at: nowIso,
      locked_by: workerId,
    })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("id,invoice_id,user_id,provider,job_kind,attempts,max_attempts,status")
    .single<JobRow>();
  if (lockRes.error || !lockRes.data) return { ok: true, processed: false };

  const job = lockRes.data;
  await createJobEvent(job.id, "started", "Job iniciado.", { worker_id: workerId, attempt: job.attempts });

  try {
    if (job.job_kind !== "issue") {
      throw new Error(`job_kind nao implementado: ${job.job_kind}`);
    }

    const invoiceRes = await supabaseAdmin
      .from("collaborator_invoices")
      .select("id,user_id,reference_month,invoice_number,gross_amount,integration_provider,integration_url,notes")
      .eq("id", job.invoice_id)
      .single<InvoiceRow>();
    if (invoiceRes.error || !invoiceRes.data) throw new Error(invoiceRes.error?.message || "Nota nao encontrada.");
    const invoice = invoiceRes.data;

    const profileRes = await supabaseAdmin
      .from("collaborator_invoice_integration_profiles")
      .select("preferred_provider,cnpj_prestador,simples_nacional,inscricao_municipal,nfs_password_set")
      .eq("user_id", job.user_id)
      .maybeSingle<IntegrationProfileRow>();
    const profile = profileRes.error ? null : profileRes.data ?? null;

    const secretRes = await supabaseAdmin
      .from("collaborator_invoice_integration_secrets")
      .select("secret_ciphertext,secret_iv,secret_tag")
      .eq("user_id", job.user_id)
      .eq("provider", job.provider)
      .maybeSingle<SecretRow>();
    const password = secretRes.error || !secretRes.data ? null : decryptSecret(secretRes.data);

    const connector = getInvoiceConnector(job.provider);
    const result = await connector.issue({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      provider: invoice.integration_provider,
      referenceMonth: invoice.reference_month,
      invoiceNumber: invoice.invoice_number,
      grossAmount: invoice.gross_amount,
      integrationUrl: invoice.integration_url,
      notes: invoice.notes,
      profile: profile
        ? {
            preferredProvider: profile.preferred_provider,
            cnpjPrestador: profile.cnpj_prestador,
            simplesNacional: profile.simples_nacional,
            inscricaoMunicipal: profile.inscricao_municipal,
            nfsPasswordSet: profile.nfs_password_set,
          }
        : null,
      credentials: { password },
    });

    if (result.success) {
      await supabaseAdmin.from("collaborator_invoices").update({
        provider_external_id: result.externalId ?? null,
        provider_status: result.providerStatus ?? null,
        provider_synced_at: new Date().toISOString(),
        provider_last_error: null,
      }).eq("id", invoice.id);

      await supabaseAdmin.from("collaborator_invoice_jobs").update({
        status: "succeeded",
        result: result.raw ?? { redirect_url: result.redirectUrl ?? null },
        last_error: null,
      }).eq("id", job.id);
      await createJobEvent(job.id, "succeeded", "Job concluido com sucesso.", result.raw ?? { redirect_url: result.redirectUrl ?? null });
      return { ok: true, processed: true, jobId: job.id, status: "succeeded" };
    }

    const canRetry = job.attempts < job.max_attempts;
    await supabaseAdmin.from("collaborator_invoice_jobs").update({
      status: canRetry ? "queued" : "failed",
      run_after: canRetry ? new Date(Date.now() + 60_000).toISOString() : nowIso,
      last_error: result.errorMessage ?? "Falha sem detalhe.",
      result: result.raw ?? null,
      locked_at: null,
      locked_by: null,
    }).eq("id", job.id);
    await supabaseAdmin.from("collaborator_invoices").update({
      provider_last_error: result.errorMessage ?? "Falha sem detalhe.",
      provider_synced_at: new Date().toISOString(),
    }).eq("id", invoice.id);
    await createJobEvent(job.id, canRetry ? "attempt_failed" : "failed", result.errorMessage ?? "Falha sem detalhe.");
    return { ok: true, processed: true, jobId: job.id, status: canRetry ? "requeued" : "failed" };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    const canRetry = job.attempts < job.max_attempts;
    await supabaseAdmin.from("collaborator_invoice_jobs").update({
      status: canRetry ? "queued" : "failed",
      run_after: canRetry ? new Date(Date.now() + 60_000).toISOString() : new Date().toISOString(),
      last_error: message,
      locked_at: null,
      locked_by: null,
    }).eq("id", job.id);
    await createJobEvent(job.id, canRetry ? "attempt_failed" : "failed", message);
    return { ok: false, processed: true, jobId: job.id, status: canRetry ? "requeued" : "failed", error: message };
  }
}
