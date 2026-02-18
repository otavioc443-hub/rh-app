export type IntegrationProvider = "sougov" | "portal_estadual" | "portal_municipal" | "custom";

export type InvoiceConnectorInput = {
  invoiceId: string;
  userId: string;
  referenceMonth: string;
  invoiceNumber: string | null;
  grossAmount: number | null;
  notes: string | null;
  integrationUrl: string | null;
  provider: IntegrationProvider;
  profile: {
    preferredProvider: IntegrationProvider;
    cnpjPrestador: string;
    simplesNacional: boolean;
    inscricaoMunicipal: string | null;
    nfsPasswordSet: boolean;
  } | null;
  credentials: {
    password: string | null;
  };
};

export type InvoiceConnectorIssueResult = {
  success: boolean;
  status: "issued" | "queued" | "failed";
  providerStatus?: string | null;
  externalId?: string | null;
  redirectUrl?: string | null;
  raw?: unknown;
  errorMessage?: string | null;
};

export interface InvoiceConnector {
  issue(input: InvoiceConnectorInput): Promise<InvoiceConnectorIssueResult>;
}
