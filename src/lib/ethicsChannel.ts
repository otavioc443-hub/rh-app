export type EthicsChannelConfig = {
  key: string;
  companyName: string;
  reportUrl: string | null;
  followUpUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  heroImageUrl?: string | null;
  codeOfEthicsUrl?: string | null;
  dataProtectionUrl?: string | null;
};

type RawEthicsChannelConfig = Partial<EthicsChannelConfig> & {
  key?: string;
  companyName?: string;
  reportUrl?: string;
  followUpUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  heroImageUrl?: string;
  codeOfEthicsUrl?: string;
  dataProtectionUrl?: string;
};

function clean(value: string | undefined | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildEthicsChannelSlug(value: string | null | undefined) {
  return normalizeKey(value);
}

function coerceConfig(input: RawEthicsChannelConfig, fallbackKey: string): EthicsChannelConfig | null {
  const companyName = clean(input.companyName);
  const key = normalizeKey(input.key || companyName || fallbackKey);
  if (!key || !companyName) return null;

  return {
    key,
    companyName,
    reportUrl: clean(input.reportUrl),
    followUpUrl: clean(input.followUpUrl),
    contactEmail: clean(input.contactEmail),
    contactPhone: clean(input.contactPhone),
    heroImageUrl: clean(input.heroImageUrl),
    codeOfEthicsUrl: clean(input.codeOfEthicsUrl),
    dataProtectionUrl: clean(input.dataProtectionUrl),
  };
}

function getSingleCompanyFallback(): EthicsChannelConfig {
  return {
    key: normalizeKey(clean(process.env.NEXT_PUBLIC_ETHICS_DEFAULT_KEY) ?? clean(process.env.NEXT_PUBLIC_ETHICS_COMPANY_NAME) ?? "solida"),
    companyName: clean(process.env.NEXT_PUBLIC_ETHICS_COMPANY_NAME) ?? "Sólida do Brasil",
    reportUrl: clean(process.env.NEXT_PUBLIC_ETHICS_REPORT_URL),
    followUpUrl: clean(process.env.NEXT_PUBLIC_ETHICS_FOLLOWUP_URL),
    contactEmail: clean(process.env.NEXT_PUBLIC_ETHICS_CONTACT_EMAIL),
    contactPhone: clean(process.env.NEXT_PUBLIC_ETHICS_CONTACT_PHONE),
    heroImageUrl: clean(process.env.NEXT_PUBLIC_ETHICS_HERO_IMAGE_URL),
    codeOfEthicsUrl: clean(process.env.NEXT_PUBLIC_ETHICS_CODE_URL),
    dataProtectionUrl: clean(process.env.NEXT_PUBLIC_ETHICS_PRIVACY_URL),
  };
}

export function getEthicsChannelConfigs(): EthicsChannelConfig[] {
  const rawJson = clean(process.env.NEXT_PUBLIC_ETHICS_CHANNELS_JSON);
  if (!rawJson) return [getSingleCompanyFallback()];

  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [getSingleCompanyFallback()];
    const items = parsed
      .map((item, index) => coerceConfig((item ?? {}) as RawEthicsChannelConfig, `empresa-${index + 1}`))
      .filter(Boolean) as EthicsChannelConfig[];
    return items.length ? items : [getSingleCompanyFallback()];
  } catch {
    return [getSingleCompanyFallback()];
  }
}

export function getDefaultEthicsChannelConfig() {
  const configs = getEthicsChannelConfigs();
  const wantedKey = normalizeKey(clean(process.env.NEXT_PUBLIC_ETHICS_DEFAULT_KEY));
  return configs.find((item) => item.key === wantedKey) ?? configs[0];
}

export function findEthicsChannelConfig(companyKey?: string | null) {
  const configs = getEthicsChannelConfigs();
  const wanted = normalizeKey(companyKey);
  if (!wanted) return null;
  return configs.find((item) => item.key === wanted || normalizeKey(item.companyName) === wanted) ?? null;
}

export function getEthicsChannelConfig(companyKey?: string | null) {
  return findEthicsChannelConfig(companyKey) ?? getDefaultEthicsChannelConfig();
}

