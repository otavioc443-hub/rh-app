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
      heroTitle: "Bem-vindo ao Canal de Etica da Solida",
      heroSubtitle:
        "Um ambiente seguro, imparcial e protegido para comunicar condutas que possam violar o Codigo de Etica e Conduta, as politicas internas ou a legislacao aplicavel.",
      heading: "Tecnologia, excelencia e responsabilidade em cada relacao.",
      intro:
        "Na Solida, acreditamos que a engenharia transforma realidades. Por isso, nossa atuacao precisa refletir responsabilidade profissional, respeito as pessoas, integridade nas decisoes e compromisso permanente com a confianca.",
      heroImageUrl: "/institucional/pdf/page-07.jpg",
      reportUrl: null,
      followUpUrl: null,
      contactEmail: null,
      contactPhone: null,
      codeOfEthicsUrl: null,
      dataProtectionUrl: null,
      codeSummary:
        "O Codigo de Etica e Conduta da Solida orienta a forma como trabalhamos, decidimos e nos relacionamos, conectando engenharia, tecnologia, inteligencia e pessoas para construir solucoes que transformam a sociedade.",
      dataProtectionSummary:
        "Os relatos recebidos devem ser tratados com responsabilidade e confidencialidade, com acesso restrito, protecao das informacoes pessoais e preservacao adequada das evidencias relacionadas ao caso.",
      principles: [
        "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligencia e pessoas.",
        "Desenvolver solucoes de engenharia inovadoras, seguras e eficientes, com excelencia tecnica.",
        "Liderar a transformacao digital da engenharia com inovacao, BIM e impacto positivo.",
        "Atuar com integridade, respeito, responsabilidade e protecao contra qualquer forma de retaliacao.",
      ],
      foundationTitle: "Base institucional da Solida",
      foundationSubtitle:
        "O canal de etica da Solida nasce do mesmo conjunto de principios que orienta nossa atuacao tecnica, nosso relacionamento com pessoas e a forma como conduzimos decisoes.",
      foundationPillars: [
        {
          label: "Proposito",
          text: "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligencia e pessoas para construir solucoes que transformam a sociedade.",
        },
        {
          label: "Missao",
          text: "Desenvolver solucoes de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligencia tecnica para entregar projetos de alta qualidade.",
        },
        {
          label: "Visao",
          text: "Ser referencia nacional e internacional em solucoes de engenharia digital, inovacao tecnologica e modelagem BIM.",
        },
      ],
      steerTitle: "STEER",
      steerBody: "Conduzindo o futuro da engenharia com tecnologia, excelencia e responsabilidade.",
    };
  }

  return {
    heroTitle: `Canal de Etica de ${companyName}`,
    heroSubtitle:
      "Um espaco preparado para receber relatos com seriedade, sigilo, imparcialidade e orientacao para apuracao.",
    heading: "Integridade e protecao para quem precisa relatar.",
    intro:
      "Este canal existe para apoiar a identificacao de condutas que contrariem os valores da empresa, a legislacao e os padroes esperados de etica, integridade e respeito.",
    heroImageUrl: "/bg-login.jpg",
    reportUrl: null,
    followUpUrl: null,
    contactEmail: null,
    contactPhone: null,
    codeOfEthicsUrl: null,
    dataProtectionUrl: null,
    codeSummary:
      "A pagina consolida os compromissos de respeito, responsabilidade, integridade, combate a fraude e cuidado com pessoas, informacoes e ativos.",
    dataProtectionSummary:
      "Os relatos e documentos devem circular apenas entre as pessoas necessarias para a triagem e a apuracao, com registro formal do tratamento dado a cada caso.",
    principles: [
      "Respeito e ambiente de trabalho seguro para todas as pessoas.",
      "Conduta integra, transparente e alinhada as regras internas e externas.",
      "Nao tolerancia a assedio, discriminacao, fraude e retaliacao.",
      "Preservacao do sigilo, dos dados pessoais e das evidencias do relato.",
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
