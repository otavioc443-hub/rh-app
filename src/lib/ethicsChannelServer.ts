import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildEthicsChannelSlug,
  findEthicsChannelConfig,
  getEthicsChannelConfigs,
  getDefaultEthicsChannelConfig,
  type EthicsChannelConfig,
} from "@/lib/ethicsChannel";
import {
  getDefaultEthicsManagedContent,
  mergeEthicsManagedContent,
  type EthicsFaqItem,
  type EthicsFoundationPillar,
  type EthicsManagedContent,
  type EthicsManagedPageTexts,
} from "@/lib/ethicsChannelDefaults";
import { normalizeDisplayText } from "@/lib/textEncoding";

type CompanyRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  cidade: string | null;
  estado: string | null;
};

type EthicsContentRow = {
  company_id: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  heading: string | null;
  intro: string | null;
  hero_image_url: string | null;
  report_url: string | null;
  follow_up_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  code_of_ethics_url: string | null;
  data_protection_url: string | null;
  code_summary: string | null;
  data_protection_summary: string | null;
  principles: unknown;
  foundation_title: string | null;
  foundation_subtitle: string | null;
  foundation_pillars: unknown;
  steer_title: string | null;
  steer_body: string | null;
  faq_items: unknown;
  page_texts: unknown;
};

const ETHICS_CONTENT_SELECT = "*";

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLoose(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveEnvConfigForCompany(company: CompanyRow) {
  const directMatch = findEthicsChannelConfig(company.name) ?? findEthicsChannelConfig(company.id);
  if (directMatch) return directMatch;

  const companyName = normalizeLoose(company.name);
  const availableConfigs = getEthicsChannelConfigs();

  return (
    availableConfigs.find((config) => {
      const configName = normalizeLoose(config.companyName);
      return Boolean(configName) && Boolean(companyName) && (companyName.includes(configName) || configName.includes(companyName));
    }) ?? null
  );
}

function clean(value: string | null | undefined) {
  return normalizeDisplayText(value);
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeDisplayText(String(item ?? ""))).filter(Boolean) as string[];
}

function coercePillars(value: unknown): EthicsFoundationPillar[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = normalizeDisplayText(String(row.label ?? "")) ?? "";
      const text = normalizeDisplayText(String(row.text ?? "")) ?? "";
      if (!label && !text) return null;
      return { label, text };
    })
    .filter(Boolean) as EthicsFoundationPillar[];
}

function coerceFaqItems(value: unknown): EthicsFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const question = normalizeDisplayText(String(row.question ?? "")) ?? "";
      const answer = normalizeDisplayText(String(row.answer ?? "")) ?? "";
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter(Boolean) as EthicsFaqItem[];
}

function coercePageTexts(value: unknown): EthicsManagedPageTexts | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const stringValue = (key: keyof EthicsManagedPageTexts) => clean(String(row[key] ?? ""));
  const stringArrayValue = (key: keyof EthicsManagedPageTexts) =>
    Array.isArray(row[key])
      ? (row[key] as unknown[])
          .map((item) => clean(String(item ?? "")))
          .filter((item): item is string => Boolean(item))
      : undefined;

  return {
    homeGuidanceTitle: stringValue("homeGuidanceTitle"),
    homeGuidanceParagraphs: stringArrayValue("homeGuidanceParagraphs") ?? [],
    reportHeroTitle: stringValue("reportHeroTitle"),
    reportHeroBody: stringValue("reportHeroBody"),
    reportHeroAsideTitle: stringValue("reportHeroAsideTitle"),
    reportHeroAsideBody: stringValue("reportHeroAsideBody"),
    reportIntroTitle: stringValue("reportIntroTitle"),
    reportIntroParagraphs: stringArrayValue("reportIntroParagraphs") ?? [],
    reportConsentLabel: stringValue("reportConsentLabel"),
    reportIdentityTitle: stringValue("reportIdentityTitle"),
    reportIdentityParagraphs: stringArrayValue("reportIdentityParagraphs") ?? [],
    reportIdentityQuestion: stringValue("reportIdentityQuestion"),
    reportIncidentTitle: stringValue("reportIncidentTitle"),
    reportIncidentParagraphs: stringArrayValue("reportIncidentParagraphs") ?? [],
    followUpHeroTitle: stringValue("followUpHeroTitle"),
    followUpHeroBody: stringValue("followUpHeroBody"),
    followUpHeroAsideTitle: stringValue("followUpHeroAsideTitle"),
    followUpHeroAsideBody: stringValue("followUpHeroAsideBody"),
    followUpTitle: stringValue("followUpTitle"),
    followUpDescription: stringValue("followUpDescription"),
    followUpPlaceholder: stringValue("followUpPlaceholder"),
    dataFaqTitle: stringValue("dataFaqTitle"),
    dataFaqSubtitle: stringValue("dataFaqSubtitle"),
    codeHeroTitle: stringValue("codeHeroTitle"),
    codeHeroBody: stringValue("codeHeroBody"),
  };
}

function mapContentRow(row: EthicsContentRow | null | undefined): Partial<EthicsManagedContent> | null {
  if (!row) return null;
  return {
    heroTitle: clean(row.hero_title),
    heroSubtitle: clean(row.hero_subtitle),
    heading: clean(row.heading),
    intro: clean(row.intro),
    heroImageUrl: clean(row.hero_image_url),
    reportUrl: clean(row.report_url),
    followUpUrl: clean(row.follow_up_url),
    contactEmail: clean(row.contact_email),
    contactPhone: clean(row.contact_phone),
    codeOfEthicsUrl: clean(row.code_of_ethics_url),
    dataProtectionUrl: clean(row.data_protection_url),
    codeSummary: clean(row.code_summary),
    dataProtectionSummary: clean(row.data_protection_summary),
    principles: coerceStringArray(row.principles),
    foundationTitle: clean(row.foundation_title),
    foundationSubtitle: clean(row.foundation_subtitle),
    foundationPillars: coercePillars(row.foundation_pillars),
    steerTitle: clean(row.steer_title),
    steerBody: clean(row.steer_body),
    faqItems: coerceFaqItems(row.faq_items),
    pageTexts: coercePageTexts(row.page_texts),
  };
}

function mergeConfigWithContent(config: EthicsChannelConfig, content: EthicsManagedContent): EthicsChannelConfig {
  return {
    ...config,
    reportUrl: content.reportUrl ?? config.reportUrl,
    followUpUrl: content.followUpUrl ?? config.followUpUrl,
    contactEmail: content.contactEmail ?? config.contactEmail,
    contactPhone: content.contactPhone ?? config.contactPhone,
    heroImageUrl: content.heroImageUrl ?? config.heroImageUrl,
    codeOfEthicsUrl: content.codeOfEthicsUrl ?? config.codeOfEthicsUrl,
    dataProtectionUrl: content.dataProtectionUrl ?? config.dataProtectionUrl,
  };
}

export async function getEthicsChannelCompanies() {
  const [{ data: companiesData }, { data: contentsData }] = await Promise.all([
    supabaseAdmin.from("companies").select("id,name,logo_url,primary_color,cidade,estado").order("name", { ascending: true }),
    supabaseAdmin.from("ethics_channel_content").select("company_id"),
  ]);

  const companies = ((companiesData ?? []) as CompanyRow[]).map((company) => {
    const envConfig = resolveEnvConfigForCompany(company);
    const hasContent = (contentsData ?? []).some((item) => item.company_id === company.id);
    return {
      ...company,
      slug: buildEthicsChannelSlug(envConfig?.key ?? company.name),
      configured: Boolean(envConfig || hasContent),
    };
  });

  return companies;
}

export async function getEthicsChannelPageData(companyKey?: string | null) {
  const [{ data: companiesData }, { data: contentsData }] = await Promise.all([
    supabaseAdmin.from("companies").select("id,name,logo_url,primary_color,cidade,estado").order("name", { ascending: true }),
    supabaseAdmin
      .from("ethics_channel_content")
      .select(ETHICS_CONTENT_SELECT),
  ]);

  const companies = (companiesData ?? []) as CompanyRow[];
  const contents = (contentsData ?? []) as EthicsContentRow[];
  const wanted = buildEthicsChannelSlug(companyKey);

  let selectedCompany =
    companies.find((company) => {
      const envConfig = resolveEnvConfigForCompany(company);
      const slug = buildEthicsChannelSlug(envConfig?.key ?? company.name);
      return slug === wanted || buildEthicsChannelSlug(company.id) === wanted || buildEthicsChannelSlug(company.name) === wanted;
    }) ?? null;

  if (!selectedCompany && wanted) {
    const envMatch = findEthicsChannelConfig(wanted);
    if (envMatch) {
      const envName = normalizeLoose(envMatch.companyName);
      selectedCompany =
        companies.find((company) => {
          const companyName = normalizeLoose(company.name);
          return Boolean(envName) && Boolean(companyName) && (companyName.includes(envName) || envName.includes(companyName));
        }) ??
        (companies.length === 1 ? companies[0] : null);
    }
  }

  const baseConfig =
    (selectedCompany && resolveEnvConfigForCompany(selectedCompany)) ??
    (companyKey ? findEthicsChannelConfig(companyKey) : null) ??
    getDefaultEthicsChannelConfig();

  const companyName = selectedCompany?.name ?? baseConfig.companyName;
  const defaultContent = getDefaultEthicsManagedContent(companyName, baseConfig.key);
  const dbContent = selectedCompany ? mapContentRow(contents.find((item) => item.company_id === selectedCompany.id)) : null;
  const content = mergeEthicsManagedContent(defaultContent, dbContent);

  const config = mergeConfigWithContent(
    {
      ...baseConfig,
      companyId: selectedCompany?.id ?? baseConfig.companyId ?? null,
      companyName,
      key: selectedCompany ? buildEthicsChannelSlug(baseConfig.key || selectedCompany.name) : baseConfig.key,
    },
    content,
  );

  const companyTabs = companies
    .map((company) => {
      const envConfig = resolveEnvConfigForCompany(company);
      return {
        key: buildEthicsChannelSlug(envConfig?.key ?? company.name),
        companyId: company.id,
        companyName: company.name,
        reportUrl: envConfig?.reportUrl ?? null,
        followUpUrl: envConfig?.followUpUrl ?? null,
        contactEmail: envConfig?.contactEmail ?? null,
        contactPhone: envConfig?.contactPhone ?? null,
        heroImageUrl: envConfig?.heroImageUrl ?? null,
        codeOfEthicsUrl: envConfig?.codeOfEthicsUrl ?? null,
        dataProtectionUrl: envConfig?.dataProtectionUrl ?? null,
      } satisfies EthicsChannelConfig;
    })
    .filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index);

  return {
    config,
    content,
    companies: companyTabs.length ? companyTabs : [config],
  };
}

export async function getEthicsChannelCompanyByKey(companyKey?: string | null) {
  const { config } = await getEthicsChannelPageData(companyKey);
  if (!config.companyId) return null;
  return {
    companyId: config.companyId,
    key: config.key,
    companyName: config.companyName,
  };
}

export async function getEthicsManagedContentForCompanyId(companyId: string) {
  const [{ data: companyRow }, { data: contentRow }] = await Promise.all([
    supabaseAdmin
      .from("companies")
      .select("id,name,logo_url,primary_color,cidade,estado")
      .eq("id", companyId)
      .maybeSingle<CompanyRow>(),
    supabaseAdmin
      .from("ethics_channel_content")
      .select(ETHICS_CONTENT_SELECT)
      .eq("company_id", companyId)
      .maybeSingle<EthicsContentRow>(),
  ]);

  if (!companyRow) return null;

  const envConfig = resolveEnvConfigForCompany(companyRow);
  const defaultContent = getDefaultEthicsManagedContent(companyRow.name, envConfig?.key ?? companyRow.name);
  const mergedContent = mergeEthicsManagedContent(defaultContent, mapContentRow(contentRow));

  return {
    company: {
      id: companyRow.id,
      name: companyRow.name,
      slug: buildEthicsChannelSlug(envConfig?.key ?? companyRow.name),
    },
    content: mergedContent,
  };
}
