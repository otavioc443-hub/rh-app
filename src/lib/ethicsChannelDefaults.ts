import { normalizeDisplayText } from "@/lib/textEncoding";

export type EthicsFoundationPillar = {
  label: string;
  text: string;
};

export type EthicsManagedContent = {
  heroTitle: string | null;
  heroSubtitle: string | null;
  heading: string | null;
  intro: string | null;
  heroImageUrl: string | null;
  reportUrl: string | null;
  followUpUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  codeOfEthicsUrl: string | null;
  dataProtectionUrl: string | null;
  codeSummary: string | null;
  dataProtectionSummary: string | null;
  principles: string[];
  foundationTitle: string | null;
  foundationSubtitle: string | null;
  foundationPillars: EthicsFoundationPillar[];
  steerTitle: string | null;
  steerBody: string | null;
};

function normalizeValue(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clean(value: string | null | undefined) {
  return normalizeDisplayText(value);
}

function normalizePillars(pillars: EthicsFoundationPillar[]) {
  return pillars.map((pillar) => ({
    label: normalizeDisplayText(pillar.label) ?? "",
    text: normalizeDisplayText(pillar.text) ?? "",
  }));
}

function normalizeManagedContent(content: EthicsManagedContent): EthicsManagedContent {
  return {
    ...content,
    heroTitle: normalizeDisplayText(content.heroTitle),
    heroSubtitle: normalizeDisplayText(content.heroSubtitle),
    heading: normalizeDisplayText(content.heading),
    intro: normalizeDisplayText(content.intro),
    heroImageUrl: normalizeDisplayText(content.heroImageUrl),
    reportUrl: normalizeDisplayText(content.reportUrl),
    followUpUrl: normalizeDisplayText(content.followUpUrl),
    contactEmail: normalizeDisplayText(content.contactEmail),
    contactPhone: normalizeDisplayText(content.contactPhone),
    codeOfEthicsUrl: normalizeDisplayText(content.codeOfEthicsUrl),
    dataProtectionUrl: normalizeDisplayText(content.dataProtectionUrl),
    codeSummary: normalizeDisplayText(content.codeSummary),
    dataProtectionSummary: normalizeDisplayText(content.dataProtectionSummary),
    principles: content.principles.map((item) => normalizeDisplayText(item) ?? "").filter(Boolean),
    foundationTitle: normalizeDisplayText(content.foundationTitle),
    foundationSubtitle: normalizeDisplayText(content.foundationSubtitle),
    foundationPillars: normalizePillars(content.foundationPillars),
    steerTitle: normalizeDisplayText(content.steerTitle),
    steerBody: normalizeDisplayText(content.steerBody),
  };
}

export function getDefaultEthicsManagedContent(companyName: string, companyKey?: string | null): EthicsManagedContent {
  const normalized = `${normalizeValue(companyKey)} ${normalizeValue(companyName)}`;
  const isSolida = normalized.includes("solida");

  if (isSolida) {
    return normalizeManagedContent({
      heroTitle: "Bem-vindo ao Canal de Ética da Sólida",
      heroSubtitle:
        "Um ambiente seguro, imparcial e protegido para comunicar condutas que possam violar o Código de Ética e Conduta, as políticas internas ou a legislação aplicável.",
      heading: "Tecnologia, excelência e responsabilidade em cada relação.",
      intro:
        "Na Sólida, acreditamos que a engenharia transforma realidades. Por isso, nossa atuação precisa refletir responsabilidade profissional, respeito às pessoas, integridade nas decisões e compromisso permanente com a confiança.",
      heroImageUrl: "/ethics/solida-canal-etica-hero.jpg",
      reportUrl: null,
      followUpUrl: null,
      contactEmail: null,
      contactPhone: null,
      codeOfEthicsUrl: null,
      dataProtectionUrl: null,
      codeSummary:
        "O Código de Ética e Conduta da Sólida orienta a forma como trabalhamos, decidimos e nos relacionamos, conectando engenharia, tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade.",
      dataProtectionSummary:
        "Os relatos recebidos devem ser tratados com responsabilidade e confidencialidade, com acesso restrito, proteção das informações pessoais e preservação adequada das evidências relacionadas ao caso.",
      principles: [
        "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade.",
        "Desenvolver soluções de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligência técnica para entregar projetos de alta qualidade.",
        "Atuar com excelência técnica e visão estratégica para planejar, projetar e implementar soluções que integram diferentes disciplinas da engenharia.",
        "Transformar desafios complexos em soluções estruturadas, conectando engenharia, tecnologia e gestão para gerar resultados consistentes.",
      ],
      foundationTitle: "Base institucional da Sólida",
      foundationSubtitle:
        "O Canal de Ética da Sólida nasce do mesmo conjunto de princípios que orienta nossa atuação técnica, nosso relacionamento com pessoas e a forma como conduzimos decisões.",
      foundationPillars: [
        {
          label: "Propósito",
          text: "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade. A Sólida existe para desenvolver soluções de engenharia que unem conhecimento técnico, inovação digital e responsabilidade profissional, contribuindo para a evolução de projetos, cidades, infraestruturas e sistemas produtivos. Nosso propósito é transformar ideias em soluções concretas, utilizando metodologias avançadas de engenharia, modelagem digital, gestão de projetos e colaboração multidisciplinar para gerar valor sustentável para clientes, parceiros e para a sociedade.",
        },
        {
          label: "Missão",
          text: "Desenvolver soluções de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligência técnica para entregar projetos de alta qualidade. Atuamos com excelência técnica e visão estratégica para planejar, projetar e implementar soluções que integram diferentes disciplinas da engenharia, garantindo eficiência, precisão e confiabilidade em todas as etapas dos projetos. Nossa missão é transformar desafios complexos em soluções estruturadas, conectando engenharia, tecnologia e gestão para gerar resultados consistentes.",
        },
        {
          label: "Visão",
          text: "Ser referência nacional e internacional em soluções de engenharia digital, inovação tecnológica e modelagem BIM. Buscamos consolidar a Sólida como uma empresa reconhecida pela excelência técnica, capacidade de inovação e impacto positivo nos projetos em que atua. Nossa visão é liderar a transformação digital da engenharia, promovendo novas formas de projetar, colaborar e construir.",
        },
      ],
      steerTitle: "STEER",
      steerBody:
        "Na cultura STEER da Sólida, S representa Sustentabilidade com soluções de engenharia que consideram eficiência, responsabilidade ambiental e impacto positivo na sociedade; T representa Tecnologia com inovação, BIM e ferramentas digitais para projetar soluções mais inteligentes, precisas e eficientes; E representa Excelência na busca pelos mais altos padrões técnicos em projetos, processos e entregas; E representa Ética e Integridade, com transparência, responsabilidade profissional e respeito em todas as relações; e R representa Rumo ao Futuro, conduzindo a evolução da engenharia com projetos que impulsionam inovação, eficiência e desenvolvimento.",
    });
  }

  return normalizeManagedContent({
    heroTitle: `Canal de Ética de ${companyName}`,
    heroSubtitle:
      "Um espaço preparado para receber relatos com seriedade, sigilo, imparcialidade e orientação para apuração.",
    heading: "Integridade e proteção para quem precisa relatar.",
    intro:
      "Este canal existe para apoiar a identificação de condutas que contrariem os valores da empresa, a legislação e os padrões esperados de ética, integridade e respeito.",
    heroImageUrl: "/bg-login.jpg",
    reportUrl: null,
    followUpUrl: null,
    contactEmail: null,
    contactPhone: null,
    codeOfEthicsUrl: null,
    dataProtectionUrl: null,
    codeSummary:
      "A página consolida os compromissos de respeito, responsabilidade, integridade, combate à fraude e cuidado com pessoas, informações e ativos.",
    dataProtectionSummary:
      "Os relatos e documentos devem circular apenas entre as pessoas necessárias para a triagem e a apuração, com registro formal do tratamento dado a cada caso.",
    principles: [
      "Respeito e ambiente de trabalho seguro para todas as pessoas.",
      "Conduta íntegra, transparente e alinhada às regras internas e externas.",
      "Não tolerância a assédio, discriminação, fraude e retaliação.",
      "Preservação do sigilo, dos dados pessoais e das evidências do relato.",
    ],
    foundationTitle: null,
    foundationSubtitle: null,
    foundationPillars: [],
    steerTitle: null,
    steerBody: null,
  });
}

export function mergeEthicsManagedContent(
  base: EthicsManagedContent,
  overrides?: Partial<EthicsManagedContent> | null,
): EthicsManagedContent {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    heroTitle: clean(overrides.heroTitle) ?? base.heroTitle,
    heroSubtitle: clean(overrides.heroSubtitle) ?? base.heroSubtitle,
    heading: clean(overrides.heading) ?? base.heading,
    intro: clean(overrides.intro) ?? base.intro,
    heroImageUrl: clean(overrides.heroImageUrl) ?? base.heroImageUrl,
    reportUrl: clean(overrides.reportUrl) ?? base.reportUrl,
    followUpUrl: clean(overrides.followUpUrl) ?? base.followUpUrl,
    contactEmail: clean(overrides.contactEmail) ?? base.contactEmail,
    contactPhone: clean(overrides.contactPhone) ?? base.contactPhone,
    codeOfEthicsUrl: clean(overrides.codeOfEthicsUrl) ?? base.codeOfEthicsUrl,
    dataProtectionUrl: clean(overrides.dataProtectionUrl) ?? base.dataProtectionUrl,
    codeSummary: clean(overrides.codeSummary) ?? base.codeSummary,
    dataProtectionSummary: clean(overrides.dataProtectionSummary) ?? base.dataProtectionSummary,
    principles:
      Array.isArray(overrides.principles) && overrides.principles.length
        ? overrides.principles.map((item) => normalizeDisplayText(item) ?? "").filter(Boolean)
        : base.principles,
    foundationTitle: clean(overrides.foundationTitle) ?? base.foundationTitle,
    foundationSubtitle: clean(overrides.foundationSubtitle) ?? base.foundationSubtitle,
    foundationPillars:
      Array.isArray(overrides.foundationPillars) && overrides.foundationPillars.length
        ? normalizePillars(overrides.foundationPillars)
        : base.foundationPillars,
    steerTitle: clean(overrides.steerTitle) ?? base.steerTitle,
    steerBody: clean(overrides.steerBody) ?? base.steerBody,
  };
}
