type EthicsChannelConfig = {
  companyName: string;
  reportUrl: string | null;
  followUpUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

function clean(value: string | undefined) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function getEthicsChannelConfig(): EthicsChannelConfig {
  return {
    companyName: clean(process.env.NEXT_PUBLIC_ETHICS_COMPANY_NAME) ?? "Sólida do Brasil",
    reportUrl: clean(process.env.NEXT_PUBLIC_ETHICS_REPORT_URL),
    followUpUrl: clean(process.env.NEXT_PUBLIC_ETHICS_FOLLOWUP_URL),
    contactEmail: clean(process.env.NEXT_PUBLIC_ETHICS_CONTACT_EMAIL),
    contactPhone: clean(process.env.NEXT_PUBLIC_ETHICS_CONTACT_PHONE),
  };
}
