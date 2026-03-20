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
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function getDefaultEthicsManagedContent(companyName: string, companyKey?: string | null): EthicsManagedContent {
  const normalized = `${normalizeValue(companyKey)} ${normalizeValue(companyName)}`;
  const isSolida = normalized.includes("solida");

  if (isSolida) {
    return {
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
        "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas.",
        "Desenvolver soluções de engenharia inovadoras, seguras e eficientes, com excelência técnica.",
        "Liderar a transformação digital da engenharia com inovação, BIM e impacto positivo.",
        "Atuar com integridade, respeito, responsabilidade e proteção contra qualquer forma de retaliação.",
      ],
      foundationTitle: "Base institucional da Sólida",
      foundationSubtitle:
        "O Canal de Ética da Sólida nasce do mesmo conjunto de princípios que orienta nossa atuação técnica, nosso relacionamento com pessoas e a forma como conduzimos decisões.",
      foundationPillars: [
        {
          label: "Propósito",
          text: "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas para construir soluções que transformam a sociedade.",
        },
        {
          label: "Missão",
          text: "Desenvolver soluções de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligência técnica para entregar projetos de alta qualidade.",
        },
        {
          label: "Visão",
          text: "Ser referência nacional e internacional em soluções de engenharia digital, inovação tecnológica e modelagem BIM.",
        },
      ],
      steerTitle: "STEER",
      steerBody:
        "Na cultura STEER da Sólida, S representa Segurança nas pessoas, nos processos e nas entregas; T representa Transparência nas relações e nas decisões; E representa Excelência técnica com qualidade e disciplina; E representa Ética em cada conduta e escolha profissional; e R representa Responsabilidade com integridade, respeito e impacto positivo.",
    };
  }

  return {
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
  };
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
    principles: Array.isArray(overrides.principles) && overrides.principles.length ? overrides.principles : base.principles,
    foundationTitle: clean(overrides.foundationTitle) ?? base.foundationTitle,
    foundationSubtitle: clean(overrides.foundationSubtitle) ?? base.foundationSubtitle,
    foundationPillars:
      Array.isArray(overrides.foundationPillars) && overrides.foundationPillars.length
        ? overrides.foundationPillars
        : base.foundationPillars,
    steerTitle: clean(overrides.steerTitle) ?? base.steerTitle,
    steerBody: clean(overrides.steerBody) ?? base.steerBody,
  };
}
