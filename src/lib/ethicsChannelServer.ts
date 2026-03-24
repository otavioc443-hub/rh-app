import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildEthicsChannelSlug,
  findEthicsChannelConfig,
  getDefaultEthicsChannelConfig,
  type EthicsChannelConfig,
} from "@/lib/ethicsChannel";
import {
  getDefaultEthicsManagedContent,
  mergeEthicsManagedContent,
  type EthicsFoundationPillar,
  type EthicsManagedContent,
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
};

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
    const envConfig = findEthicsChannelConfig(company.name) ?? findEthicsChannelConfig(company.id);
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
      .select(
        "company_id,hero_title,hero_subtitle,heading,intro,hero_image_url,report_url,follow_up_url,contact_email,contact_phone,code_of_ethics_url,data_protection_url,code_summary,data_protection_summary,principles,foundation_title,foundation_subtitle,foundation_pillars,steer_title,steer_body",
      ),
  ]);

  const companies = (companiesData ?? []) as CompanyRow[];
  const contents = (contentsData ?? []) as EthicsContentRow[];
  const wanted = buildEthicsChannelSlug(companyKey);

  const selectedCompany =
    companies.find((company) => {
      const envConfig = findEthicsChannelConfig(company.name) ?? findEthicsChannelConfig(company.id);
      const slug = buildEthicsChannelSlug(envConfig?.key ?? company.name);
      return slug === wanted || buildEthicsChannelSlug(company.id) === wanted || buildEthicsChannelSlug(company.name) === wanted;
    }) ?? null;

  const baseConfig =
    (selectedCompany && (findEthicsChannelConfig(selectedCompany.name) ?? findEthicsChannelConfig(selectedCompany.id))) ??
    (companyKey ? findEthicsChannelConfig(companyKey) : null) ??
    getDefaultEthicsChannelConfig();

  const companyName = selectedCompany?.name ?? baseConfig.companyName;
  const defaultContent = getDefaultEthicsManagedContent(companyName, baseConfig.key);
  const dbContent = selectedCompany ? mapContentRow(contents.find((item) => item.company_id === selectedCompany.id)) : null;
  const content = mergeEthicsManagedContent(defaultContent, dbContent);

  const config = mergeConfigWithContent(
    {
      ...baseConfig,
      companyName,
      key: selectedCompany ? buildEthicsChannelSlug(baseConfig.key || selectedCompany.name) : baseConfig.key,
    },
    content,
  );

  const companyTabs = companies
    .map((company) => {
      const envConfig = findEthicsChannelConfig(company.name) ?? findEthicsChannelConfig(company.id);
      return {
        key: buildEthicsChannelSlug(envConfig?.key ?? company.name),
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
