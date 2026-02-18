import { HttpProviderConnector } from "./httpProviderConnector";
import type { IntegrationProvider, InvoiceConnector } from "./types";

function providerConfig(provider: IntegrationProvider) {
  if (provider === "sougov") {
    return {
      apiUrl: process.env.SOUGOV_NF_API_URL?.trim() ?? "",
      apiToken: process.env.SOUGOV_NF_API_TOKEN?.trim() ?? "",
      baseUrl: process.env.SOUGOV_NF_BASE_URL?.trim() ?? "",
    };
  }
  if (provider === "portal_estadual") {
    return {
      apiUrl: process.env.PORTAL_ESTADUAL_NF_API_URL?.trim() ?? "",
      apiToken: process.env.PORTAL_ESTADUAL_NF_API_TOKEN?.trim() ?? "",
      baseUrl: process.env.PORTAL_ESTADUAL_NF_BASE_URL?.trim() ?? "",
    };
  }
  if (provider === "portal_municipal") {
    return {
      apiUrl: process.env.PORTAL_MUNICIPAL_NF_API_URL?.trim() ?? "",
      apiToken: process.env.PORTAL_MUNICIPAL_NF_API_TOKEN?.trim() ?? "",
      baseUrl: process.env.PORTAL_MUNICIPAL_NF_BASE_URL?.trim() ?? "",
    };
  }
  return {
    apiUrl: process.env.CUSTOM_NF_API_URL?.trim() ?? "",
    apiToken: process.env.CUSTOM_NF_API_TOKEN?.trim() ?? "",
    baseUrl: process.env.CUSTOM_NF_BASE_URL?.trim() ?? "",
  };
}

export function getInvoiceConnector(provider: IntegrationProvider): InvoiceConnector {
  return new HttpProviderConnector(providerConfig(provider));
}
