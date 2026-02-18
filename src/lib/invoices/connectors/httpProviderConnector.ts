import type { InvoiceConnector, InvoiceConnectorInput, InvoiceConnectorIssueResult } from "./types";

type ProviderConfig = {
  apiUrl: string;
  apiToken: string;
  baseUrl: string;
};

function toPayload(input: InvoiceConnectorInput) {
  return {
    invoice_id: input.invoiceId,
    reference_month: input.referenceMonth,
    invoice_number: input.invoiceNumber,
    gross_amount: input.grossAmount,
    notes: input.notes,
    integration_profile: input.profile
      ? {
          preferred_provider: input.profile.preferredProvider,
          cnpj_prestador: input.profile.cnpjPrestador,
          simples_nacional: input.profile.simplesNacional,
          inscricao_municipal: input.profile.inscricaoMunicipal,
          nfs_password_set: input.profile.nfsPasswordSet,
        }
      : null,
    provider_credentials: {
      has_password: Boolean(input.credentials.password),
      password: input.credentials.password,
    },
  };
}

function buildDeeplink(baseUrl: string, input: InvoiceConnectorInput) {
  const url = new URL(baseUrl);
  url.searchParams.set("invoice_id", input.invoiceId);
  url.searchParams.set("reference_month", input.referenceMonth);
  if (input.invoiceNumber) url.searchParams.set("invoice_number", input.invoiceNumber);
  if (input.grossAmount !== null && Number.isFinite(input.grossAmount)) {
    url.searchParams.set("gross_amount", String(input.grossAmount));
  }
  if (input.notes) url.searchParams.set("notes", input.notes);
  return url.toString();
}

export class HttpProviderConnector implements InvoiceConnector {
  constructor(private readonly config: ProviderConfig) {}

  async issue(input: InvoiceConnectorInput): Promise<InvoiceConnectorIssueResult> {
    if (this.config.apiUrl && this.config.apiToken) {
      const res = await fetch(this.config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: JSON.stringify(toPayload(input)),
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        external_id?: string;
        redirect_url?: string;
        external_url?: string;
        url?: string;
        error?: string;
      };

      if (!res.ok) {
        return {
          success: false,
          status: "failed",
          providerStatus: json.status ?? null,
          externalId: json.external_id ?? null,
          errorMessage: json.error || `Falha de integracao (status ${res.status})`,
          raw: json,
        };
      }

      return {
        success: true,
        status: "issued",
        providerStatus: json.status ?? "issued",
        externalId: json.external_id ?? null,
        redirectUrl: json.external_url || json.redirect_url || json.url || null,
        raw: json,
      };
    }

    const fallbackBase = input.integrationUrl?.trim() || this.config.baseUrl;
    if (fallbackBase) {
      return {
        success: true,
        status: "queued",
        providerStatus: "awaiting_user_completion",
        redirectUrl: buildDeeplink(fallbackBase, input),
      };
    }

    return {
      success: false,
      status: "failed",
      errorMessage: "Provedor sem configuracao de API ou URL base.",
    };
  }
}
