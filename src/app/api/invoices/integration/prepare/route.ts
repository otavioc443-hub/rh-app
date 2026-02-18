import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IntegrationProvider = "sougov" | "portal_estadual" | "portal_municipal" | "custom";

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

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const, token: null };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token: null };
}

async function getRequesterSupabase(req: Request, token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

function basePayload(invoice: InvoiceRow, profile: IntegrationProfileRow | null, providerPassword: string | null) {
  return {
    invoice_id: invoice.id,
    reference_month: invoice.reference_month,
    invoice_number: invoice.invoice_number,
    gross_amount: invoice.gross_amount,
    notes: invoice.notes,
    integration_profile: profile
      ? {
          preferred_provider: profile.preferred_provider,
          cnpj_prestador: profile.cnpj_prestador,
          simples_nacional: profile.simples_nacional,
          inscricao_municipal: profile.inscricao_municipal,
          nfs_password_set: profile.nfs_password_set,
        }
      : null,
    provider_credentials: {
      has_password: Boolean(providerPassword),
      password: providerPassword,
    },
  };
}

function buildUrl(baseUrl: string, invoice: InvoiceRow) {
  const url = new URL(baseUrl);
  url.searchParams.set("invoice_id", invoice.id);
  url.searchParams.set("reference_month", invoice.reference_month);
  if (invoice.invoice_number) url.searchParams.set("invoice_number", invoice.invoice_number);
  if (invoice.gross_amount !== null && Number.isFinite(invoice.gross_amount)) {
    url.searchParams.set("gross_amount", String(invoice.gross_amount));
  }
  if (invoice.notes) url.searchParams.set("notes", invoice.notes);
  return url.toString();
}

function getProviderApiConfig(provider: IntegrationProvider) {
  if (provider === "sougov") {
    return {
      url: process.env.SOUGOV_NF_API_URL?.trim() ?? "",
      token: process.env.SOUGOV_NF_API_TOKEN?.trim() ?? "",
    };
  }
  if (provider === "portal_estadual") {
    return {
      url: process.env.PORTAL_ESTADUAL_NF_API_URL?.trim() ?? "",
      token: process.env.PORTAL_ESTADUAL_NF_API_TOKEN?.trim() ?? "",
    };
  }
  if (provider === "portal_municipal") {
    return {
      url: process.env.PORTAL_MUNICIPAL_NF_API_URL?.trim() ?? "",
      token: process.env.PORTAL_MUNICIPAL_NF_API_TOKEN?.trim() ?? "",
    };
  }
  return {
    url: process.env.CUSTOM_NF_API_URL?.trim() ?? "",
    token: process.env.CUSTOM_NF_API_TOKEN?.trim() ?? "",
  };
}

function getProviderBaseUrl(provider: IntegrationProvider) {
  if (provider === "sougov") return process.env.SOUGOV_NF_BASE_URL?.trim() ?? "";
  if (provider === "portal_estadual") return process.env.PORTAL_ESTADUAL_NF_BASE_URL?.trim() ?? "";
  if (provider === "portal_municipal") return process.env.PORTAL_MUNICIPAL_NF_BASE_URL?.trim() ?? "";
  return process.env.CUSTOM_NF_BASE_URL?.trim() ?? "";
}

function getProviderHelp(provider: IntegrationProvider) {
  if (provider === "sougov") return "SouGov: configure SOUGOV_NF_API_URL e SOUGOV_NF_API_TOKEN ou SOUGOV_NF_BASE_URL.";
  if (provider === "portal_estadual") return "Portal estadual: configure PORTAL_ESTADUAL_NF_API_URL e PORTAL_ESTADUAL_NF_API_TOKEN ou PORTAL_ESTADUAL_NF_BASE_URL.";
  if (provider === "portal_municipal") return "Portal municipal: configure PORTAL_MUNICIPAL_NF_API_URL e PORTAL_MUNICIPAL_NF_API_TOKEN ou PORTAL_MUNICIPAL_NF_BASE_URL.";
  return "Outro portal: informe URL de integracao da nota ou configure CUSTOM_NF_API_URL e CUSTOM_NF_API_TOKEN.";
}

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

async function callProviderApi(
  provider: IntegrationProvider,
  invoice: InvoiceRow,
  profile: IntegrationProfileRow | null,
  providerPassword: string | null
) {
  const cfg = getProviderApiConfig(provider);
  const apiUrl = cfg.url;
  const apiToken = cfg.token;
  if (!apiUrl || !apiToken) return null;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(basePayload(invoice, profile, providerPassword)),
  });
  const json = (await res.json().catch(() => ({}))) as {
    external_url?: string;
    redirect_url?: string;
    url?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error || `Falha ao integrar com provedor de NF (${provider}) (status ${res.status}).`);
  }

  return json.external_url || json.redirect_url || json.url || null;
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const body = (await req.json().catch(() => ({}))) as { invoice_id?: string };
    const invoiceId = String(body.invoice_id ?? "").trim();
    if (!invoiceId) return NextResponse.json({ error: "invoice_id e obrigatorio" }, { status: 400 });

    const supabaseUser = await getRequesterSupabase(req, requester.token);
    const invoiceRes = await supabaseUser
      .from("collaborator_invoices")
      .select("id,user_id,reference_month,invoice_number,gross_amount,integration_provider,integration_url,notes")
      .eq("id", invoiceId)
      .maybeSingle<InvoiceRow>();
    if (invoiceRes.error || !invoiceRes.data) return NextResponse.json({ error: "Nota fiscal nao encontrada" }, { status: 404 });

    const invoice = invoiceRes.data;
    const configuredUrl = invoice.integration_url?.trim() || "";

    const profileRes = await supabaseUser
      .from("collaborator_invoice_integration_profiles")
      .select("preferred_provider,cnpj_prestador,simples_nacional,inscricao_municipal,nfs_password_set")
      .eq("user_id", requester.user.id)
      .maybeSingle<IntegrationProfileRow>();
    const profile = profileRes.error ? null : profileRes.data ?? null;
    const secretRes = await supabaseAdmin
      .from("collaborator_invoice_integration_secrets")
      .select("secret_ciphertext,secret_iv,secret_tag")
      .eq("user_id", requester.user.id)
      .eq("provider", invoice.integration_provider)
      .maybeSingle<SecretRow>();
    const providerPassword =
      secretRes.error || !secretRes.data ? null : decryptSecret(secretRes.data);

    const apiResult = await callProviderApi(invoice.integration_provider, invoice, profile, providerPassword);
    if (apiResult) return NextResponse.json({ ok: true, url: apiResult, mode: "api" });

    const baseUrl = configuredUrl || getProviderBaseUrl(invoice.integration_provider);
    if (baseUrl) {
      return NextResponse.json({ ok: true, url: buildUrl(baseUrl, invoice), mode: "deeplink" });
    }

    return NextResponse.json(
      {
        error: `Integracao indisponivel para ${invoice.integration_provider}. ${getProviderHelp(invoice.integration_provider)}`,
        error_code: "INTEGRATION_NOT_CONFIGURED",
        provider: invoice.integration_provider,
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
