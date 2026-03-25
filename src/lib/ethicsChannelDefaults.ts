import { normalizeDisplayText } from "@/lib/textEncoding";

export type EthicsFoundationPillar = {
  label: string;
  text: string;
};

export type EthicsFaqItem = {
  question: string;
  answer: string;
};

export type EthicsManagedPageTexts = {
  homeGuidanceTitle: string | null;
  homeGuidanceParagraphs: string[];
  reportHeroTitle: string | null;
  reportHeroBody: string | null;
  reportHeroAsideTitle: string | null;
  reportHeroAsideBody: string | null;
  reportIntroTitle: string | null;
  reportIntroParagraphs: string[];
  reportConsentLabel: string | null;
  reportIdentityTitle: string | null;
  reportIdentityParagraphs: string[];
  reportIdentityQuestion: string | null;
  reportIncidentTitle: string | null;
  reportIncidentParagraphs: string[];
  followUpHeroTitle: string | null;
  followUpHeroBody: string | null;
  followUpHeroAsideTitle: string | null;
  followUpHeroAsideBody: string | null;
  followUpTitle: string | null;
  followUpDescription: string | null;
  followUpPlaceholder: string | null;
  dataFaqTitle: string | null;
  dataFaqSubtitle: string | null;
  codeHeroTitle: string | null;
  codeHeroBody: string | null;
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
  faqItems: EthicsFaqItem[];
  pageTexts: EthicsManagedPageTexts;
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

function normalizeStringArray(values: string[]) {
  return values.map((value) => normalizeDisplayText(value) ?? "").filter(Boolean);
}

function normalizeFaqItems(items: EthicsFaqItem[]) {
  return items
    .map((item) => ({
      question: normalizeDisplayText(item.question) ?? "",
      answer: normalizeDisplayText(item.answer) ?? "",
    }))
    .filter((item) => item.question && item.answer);
}

function normalizePageTexts(pageTexts: EthicsManagedPageTexts): EthicsManagedPageTexts {
  return {
    homeGuidanceTitle: normalizeDisplayText(pageTexts.homeGuidanceTitle),
    homeGuidanceParagraphs: normalizeStringArray(pageTexts.homeGuidanceParagraphs),
    reportHeroTitle: normalizeDisplayText(pageTexts.reportHeroTitle),
    reportHeroBody: normalizeDisplayText(pageTexts.reportHeroBody),
    reportHeroAsideTitle: normalizeDisplayText(pageTexts.reportHeroAsideTitle),
    reportHeroAsideBody: normalizeDisplayText(pageTexts.reportHeroAsideBody),
    reportIntroTitle: normalizeDisplayText(pageTexts.reportIntroTitle),
    reportIntroParagraphs: normalizeStringArray(pageTexts.reportIntroParagraphs),
    reportConsentLabel: normalizeDisplayText(pageTexts.reportConsentLabel),
    reportIdentityTitle: normalizeDisplayText(pageTexts.reportIdentityTitle),
    reportIdentityParagraphs: normalizeStringArray(pageTexts.reportIdentityParagraphs),
    reportIdentityQuestion: normalizeDisplayText(pageTexts.reportIdentityQuestion),
    reportIncidentTitle: normalizeDisplayText(pageTexts.reportIncidentTitle),
    reportIncidentParagraphs: normalizeStringArray(pageTexts.reportIncidentParagraphs),
    followUpHeroTitle: normalizeDisplayText(pageTexts.followUpHeroTitle),
    followUpHeroBody: normalizeDisplayText(pageTexts.followUpHeroBody),
    followUpHeroAsideTitle: normalizeDisplayText(pageTexts.followUpHeroAsideTitle),
    followUpHeroAsideBody: normalizeDisplayText(pageTexts.followUpHeroAsideBody),
    followUpTitle: normalizeDisplayText(pageTexts.followUpTitle),
    followUpDescription: normalizeDisplayText(pageTexts.followUpDescription),
    followUpPlaceholder: normalizeDisplayText(pageTexts.followUpPlaceholder),
    dataFaqTitle: normalizeDisplayText(pageTexts.dataFaqTitle),
    dataFaqSubtitle: normalizeDisplayText(pageTexts.dataFaqSubtitle),
    codeHeroTitle: normalizeDisplayText(pageTexts.codeHeroTitle),
    codeHeroBody: normalizeDisplayText(pageTexts.codeHeroBody),
  };
}

function buildDefaultFaqItems(companyName: string): EthicsFaqItem[] {
  return [
    {
      question: "Quem pode utilizar o canal?",
      answer:
        "Colaboradores, lideranças, parceiros, fornecedores, prestadores e qualquer pessoa que precise comunicar uma situação contrária à ética ou à conformidade.",
    },
    {
      question: "Posso relatar de forma reservada?",
      answer:
        "A página foi preparada para trabalhar com canais que preservem a identidade quando essa opção estiver disponível no fluxo configurado pela empresa.",
    },
    {
      question: "Que informações ajudam na análise?",
      answer:
        "Descrição objetiva do fato, data aproximada, local, área envolvida, nomes, prints, documentos e qualquer evidência que ajude na apuração.",
    },
    {
      question: "Como acompanho o meu caso?",
      answer:
        "Quando houver fluxo de acompanhamento por protocolo, utilize o acesso específico desta página para consultar andamento e retorno.",
    },
    {
      question: `Qual é o compromisso da ${companyName} com a proteção de dados pessoais?`,
      answer:
        "A empresa trata os dados informados no canal de ética com sigilo, necessidade de conhecimento e finalidade específica de apuração, protegendo as pessoas envolvidas, a integridade do processo e a conformidade com a legislação aplicável.",
    },
    {
      question: "Quais informações devo registrar em meu relato?",
      answer:
        "Registre apenas as informações necessárias para compreender o fato: contexto, data aproximada, local, área envolvida, pessoas relacionadas e evidências disponíveis. Evite excesso de dados pessoais sem relação com a apuração.",
    },
    {
      question: "Quem terá acesso ao meu relato e aos meus dados?",
      answer:
        "O acesso deve ser restrito às pessoas e estruturas autorizadas para triagem, investigação, deliberação e tratamento do caso, preservando sigilo e integridade das informações.",
    },
    {
      question: "O que será feito com meu relato e por quanto tempo ele poderá ser armazenado?",
      answer:
        "O relato será registrado, analisado e tratado conforme a gravidade, a necessidade de investigação e as exigências legais aplicáveis. As informações podem ser mantidas pelo tempo necessário à apuração, à adoção de medidas cabíveis e ao atendimento de obrigações legais e regulatórias.",
    },
    {
      question: "Quais são os meus direitos em relação aos dados informados?",
      answer:
        "Os titulares podem exercer os direitos previstos na legislação de proteção de dados, observados os limites legais e a necessidade de preservação da investigação, da confidencialidade e da integridade do canal.",
    },
    {
      question: "Dúvidas? Mais informações?",
      answer:
        "Em caso de dúvidas sobre privacidade, tratamento de dados ou funcionamento do canal, utilize os contatos oficiais indicados nesta página para receber a orientação adequada ao seu caso.",
    },
  ];
}

function buildDefaultPageTexts(companyName: string): EthicsManagedPageTexts {
  return {
    homeGuidanceTitle: "Canal exclusivo para comunicação segura e tratamento responsável de relatos.",
    homeGuidanceParagraphs: [
      `Este é um canal exclusivo da ${companyName} para comunicação segura e, quando aplicável ao fluxo adotado, também reservada, de condutas consideradas antiéticas ou que contrariem princípios éticos, padrões de conduta e a legislação vigente.`,
      "As informações registradas neste espaço devem receber tratamento adequado, com sigilo, critério e rastreabilidade, evitando conflitos de interesse e preservando a seriedade de cada situação reportada.",
      "Se preferir, utilize também os contatos oficiais disponibilizados pela empresa, quando houver essa orientação no fluxo configurado.",
      "Atenção: se a sua demanda estiver relacionada a atendimento ao cliente, suporte operacional, produtos ou serviços, utilize o canal oficial de atendimento da empresa para que a solicitação siga para o fluxo correto.",
    ],
    reportHeroTitle: "Registre um relato com clareza e segurança.",
    reportHeroBody:
      "Use este espaço para comunicar situações que contrariem a ética, a integridade, as políticas internas ou a legislação aplicável.",
    reportHeroAsideTitle: "Diretriz principal",
    reportHeroAsideBody: "Descreva o fato com objetividade, contexto e evidências sempre que possível.",
    reportIntroTitle: "Realizar relato",
    reportIntroParagraphs: [
      `As informações aqui registradas serão recebidas e tratadas pelo comitê interno responsável da ${companyName}, assegurando sigilo, análise adequada de cada situação e tratamento sem conflitos de interesses.`,
      `A veracidade das informações providas é uma responsabilidade do relator. Todas as informações serão verificadas durante o processo de averiguação, e as ações decorrentes serão tomadas a critério exclusivo da ${companyName}.`,
      "Proteção de Dados",
      `Todas as informações aqui registradas serão tratadas de forma confidencial pela própria ${companyName}, por meio do comitê interno responsável pela recepção, análise e apuração dos relatos.`,
      "A captação dessas informações tem por finalidade a apuração de possíveis condutas consideradas antiéticas ou que violem os princípios éticos e padrões de conduta e/ou a legislação vigente.",
      "Todos os relatos serão armazenados pelo tempo necessário para realização do processo de apuração e deliberação sobre o caso, observando-se as exigências legais específicas. Além disso, informações consolidadas poderão ser utilizadas para geração de estatísticas da operação, sem exposição de nomes envolvidos ou dados pessoais.",
      `Eventuais dados pessoais informados serão tratados conforme as normativas estabelecidas pela legislação vigente no que diz respeito à proteção de dados pessoais, observadas pela ${companyName} no processo de recepção e apuração dos relatos aqui registrados.`,
      "Ao clicar em \"Concordo\" você indica ciência e concordância com o fornecimento de informações que serão única e exclusivamente utilizadas para esta finalidade.",
    ],
    reportConsentLabel: "Declaro que li e compreendi as informações acima, e desejo prosseguir com a manifestação.",
    reportIdentityTitle: "Realizar relato",
    reportIdentityParagraphs: [
      "Você pode escolher fazer um relato anônimo ou pode identificar-se.",
      "A opção identificada é voltada para os casos em que o relator se disponibiliza a ser contatado para esclarecimento de possíveis dúvidas sobre o relato fornecido.",
      "Relatos com identificação são muito importantes, pois podem fazer com que a apuração seja mais efetiva. Lembramos que este é um canal seguro e confiável.",
    ],
    reportIdentityQuestion: "Você quer se identificar?",
    reportIncidentTitle: "Realizar relato",
    reportIncidentParagraphs: [
      "Por favor, descreva a situação que o motiva a procurar este canal. É importante que seu relato seja completo e detalhado. Não se esqueça de incluir na descrição:",
      "O quê (descrição da situação);",
      "Quem (nome das pessoas envolvidas, inclusive testemunhas);",
      "Quando (data em que aconteceu, acontece ou acontecerá a situação);",
      "Onde (local do ocorrido);",
      "Por que (a causa ou motivo);",
      "Quanto (se for possível medir);",
      "Provas (se elas existem e onde podem ser encontradas).",
      "Para acompanhar o andamento de seu relato, você receberá um número de protocolo que lhe será fornecido após o registro do relato.",
      "Agradecemos sua iniciativa e confiança.",
    ],
    followUpHeroTitle: "Acompanhe um relato já registrado.",
    followUpHeroBody: "Consulte o andamento de um caso aberto utilizando o fluxo de acompanhamento disponibilizado pela empresa.",
    followUpHeroAsideTitle: "Diretriz principal",
    followUpHeroAsideBody: "Use o acompanhamento apenas para consultas relacionadas a um protocolo existente.",
    followUpTitle: "Acompanhar relato",
    followUpDescription:
      "Para acompanhar o andamento do seu relato, por favor digite o número do seu protocolo no campo abaixo e clique no botão \"Consultar protocolo\".",
    followUpPlaceholder: "Digite o protocolo",
    dataFaqTitle: "Dúvidas comuns antes de registrar um caso.",
    dataFaqSubtitle: "Perguntas frequentes",
    codeHeroTitle: "Princípios que orientam decisões, relacionamentos e condutas.",
    codeHeroBody:
      "O canal de ética complementa, mas não substitui, as regras formais de conduta, integridade, prevenção de conflitos, respeito às pessoas e proteção das informações.",
  };
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
    principles: normalizeStringArray(content.principles),
    foundationTitle: normalizeDisplayText(content.foundationTitle),
    foundationSubtitle: normalizeDisplayText(content.foundationSubtitle),
    foundationPillars: normalizePillars(content.foundationPillars),
    steerTitle: normalizeDisplayText(content.steerTitle),
    steerBody: normalizeDisplayText(content.steerBody),
    faqItems: normalizeFaqItems(content.faqItems),
    pageTexts: normalizePageTexts(content.pageTexts),
  };
}

export function getDefaultEthicsManagedContent(companyName: string, companyKey?: string | null): EthicsManagedContent {
  const normalized = `${normalizeValue(companyKey)} ${normalizeValue(companyName)}`;
  const isSolida = normalized.includes("solida");

  if (isSolida) {
    return normalizeManagedContent({
      heroTitle: "Bem-vindo ao Canal de Ã‰tica da SÃ³lida",
      heroSubtitle:
        "Um ambiente seguro, imparcial e protegido para comunicar condutas que possam violar o CÃ³digo de Ã‰tica e Conduta, as polÃ­ticas internas ou a legislaÃ§Ã£o aplicÃ¡vel.",
      heading: "Tecnologia, excelÃªncia e responsabilidade em cada relaÃ§Ã£o.",
      intro:
        "Na SÃ³lida, acreditamos que a engenharia transforma realidades. Por isso, nossa atuaÃ§Ã£o precisa refletir responsabilidade profissional, respeito Ã s pessoas, integridade nas decisÃµes e compromisso permanente com a confianÃ§a.",
      heroImageUrl: "/ethics/solida-canal-etica-hero.jpg",
      reportUrl: null,
      followUpUrl: null,
      contactEmail: null,
      contactPhone: null,
      codeOfEthicsUrl: null,
      dataProtectionUrl: null,
      codeSummary:
        "O CÃ³digo de Ã‰tica e Conduta da SÃ³lida orienta a forma como trabalhamos, decidimos e nos relacionamos, conectando engenharia, tecnologia, inteligÃªncia e pessoas para construir soluÃ§Ãµes que transformam a sociedade.",
      dataProtectionSummary:
        "Os relatos recebidos devem ser tratados com responsabilidade e confidencialidade, com acesso restrito, proteÃ§Ã£o das informaÃ§Ãµes pessoais e preservaÃ§Ã£o adequada das evidÃªncias relacionadas ao caso.",
      principles: [
        "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligÃªncia e pessoas para construir soluÃ§Ãµes que transformam a sociedade.",
        "Desenvolver soluÃ§Ãµes de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligÃªncia tÃ©cnica para entregar projetos de alta qualidade.",
        "Atuar com excelÃªncia tÃ©cnica e visÃ£o estratÃ©gica para planejar, projetar e implementar soluÃ§Ãµes que integram diferentes disciplinas da engenharia.",
        "Transformar desafios complexos em soluÃ§Ãµes estruturadas, conectando engenharia, tecnologia e gestÃ£o para gerar resultados consistentes.",
      ],
      foundationTitle: "Base institucional da SÃ³lida",
      foundationSubtitle:
        "O Canal de Ã‰tica da SÃ³lida nasce do mesmo conjunto de princÃ­pios que orienta nossa atuaÃ§Ã£o tÃ©cnica, nosso relacionamento com pessoas e a forma como conduzimos decisÃµes.",
      foundationPillars: [
        {
          label: "PropÃ³sito",
          text: "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligÃªncia e pessoas para construir soluÃ§Ãµes que transformam a sociedade. A SÃ³lida existe para desenvolver soluÃ§Ãµes de engenharia que unem conhecimento tÃ©cnico, inovaÃ§Ã£o digital e responsabilidade profissional, contribuindo para a evoluÃ§Ã£o de projetos, cidades, infraestruturas e sistemas produtivos. Nosso propÃ³sito Ã© transformar ideias em soluÃ§Ãµes concretas, utilizando metodologias avanÃ§adas de engenharia, modelagem digital, gestÃ£o de projetos e colaboraÃ§Ã£o multidisciplinar para gerar valor sustentÃ¡vel para clientes, parceiros e para a sociedade.",
        },
        {
          label: "MissÃ£o",
          text: "Desenvolver soluÃ§Ãµes de engenharia inovadoras, seguras e eficientes, utilizando tecnologia, BIM e inteligÃªncia tÃ©cnica para entregar projetos de alta qualidade. Atuamos com excelÃªncia tÃ©cnica e visÃ£o estratÃ©gica para planejar, projetar e implementar soluÃ§Ãµes que integram diferentes disciplinas da engenharia, garantindo eficiÃªncia, precisÃ£o e confiabilidade em todas as etapas dos projetos. Nossa missÃ£o Ã© transformar desafios complexos em soluÃ§Ãµes estruturadas, conectando engenharia, tecnologia e gestÃ£o para gerar resultados consistentes.",
        },
        {
          label: "VisÃ£o",
          text: "Ser referÃªncia nacional e internacional em soluÃ§Ãµes de engenharia digital, inovaÃ§Ã£o tecnolÃ³gica e modelagem BIM. Buscamos consolidar a SÃ³lida como uma empresa reconhecida pela excelÃªncia tÃ©cnica, capacidade de inovaÃ§Ã£o e impacto positivo nos projetos em que atua. Nossa visÃ£o Ã© liderar a transformaÃ§Ã£o digital da engenharia, promovendo novas formas de projetar, colaborar e construir.",
        },
      ],
      steerTitle: "STEER",
      steerBody:
        "Na cultura STEER da SÃ³lida, S representa Sustentabilidade com soluÃ§Ãµes de engenharia que consideram eficiÃªncia, responsabilidade ambiental e impacto positivo na sociedade; T representa Tecnologia com inovaÃ§Ã£o, BIM e ferramentas digitais para projetar soluÃ§Ãµes mais inteligentes, precisas e eficientes; E representa ExcelÃªncia na busca pelos mais altos padrÃµes tÃ©cnicos em projetos, processos e entregas; E representa Ã‰tica e Integridade, com transparÃªncia, responsabilidade profissional e respeito em todas as relaÃ§Ãµes; e R representa Rumo ao Futuro, conduzindo a evoluÃ§Ã£o da engenharia com projetos que impulsionam inovaÃ§Ã£o, eficiÃªncia e desenvolvimento.",
      faqItems: buildDefaultFaqItems("Sólida"),
      pageTexts: buildDefaultPageTexts("Sólida"),
    });
  }

  return normalizeManagedContent({
    heroTitle: `Canal de Ã‰tica de ${companyName}`,
    heroSubtitle:
      "Um espaÃ§o preparado para receber relatos com seriedade, sigilo, imparcialidade e orientaÃ§Ã£o para apuraÃ§Ã£o.",
    heading: "Integridade e proteÃ§Ã£o para quem precisa relatar.",
    intro:
      "Este canal existe para apoiar a identificaÃ§Ã£o de condutas que contrariem os valores da empresa, a legislaÃ§Ã£o e os padrÃµes esperados de Ã©tica, integridade e respeito.",
    heroImageUrl: "/bg-login.jpg",
    reportUrl: null,
    followUpUrl: null,
    contactEmail: null,
    contactPhone: null,
    codeOfEthicsUrl: null,
    dataProtectionUrl: null,
    codeSummary:
      "A pÃ¡gina consolida os compromissos de respeito, responsabilidade, integridade, combate Ã  fraude e cuidado com pessoas, informaÃ§Ãµes e ativos.",
    dataProtectionSummary:
      "Os relatos e documentos devem circular apenas entre as pessoas necessÃ¡rias para a triagem e a apuraÃ§Ã£o, com registro formal do tratamento dado a cada caso.",
    principles: [
      "Respeito e ambiente de trabalho seguro para todas as pessoas.",
      "Conduta Ã­ntegra, transparente e alinhada Ã s regras internas e externas.",
      "NÃ£o tolerÃ¢ncia a assÃ©dio, discriminaÃ§Ã£o, fraude e retaliaÃ§Ã£o.",
      "PreservaÃ§Ã£o do sigilo, dos dados pessoais e das evidÃªncias do relato.",
    ],
    foundationTitle: null,
    foundationSubtitle: null,
    foundationPillars: [],
    steerTitle: null,
    steerBody: null,
    faqItems: buildDefaultFaqItems(companyName),
    pageTexts: buildDefaultPageTexts(companyName),
  });
}

export function mergeEthicsManagedContent(
  base: EthicsManagedContent,
  overrides?: Partial<EthicsManagedContent> | null,
): EthicsManagedContent {
  if (!overrides) return base;

  const pageTexts = overrides.pageTexts
    ? normalizePageTexts({
        ...base.pageTexts,
        ...overrides.pageTexts,
        homeGuidanceParagraphs:
          Array.isArray(overrides.pageTexts.homeGuidanceParagraphs) && overrides.pageTexts.homeGuidanceParagraphs.length
            ? overrides.pageTexts.homeGuidanceParagraphs
            : base.pageTexts.homeGuidanceParagraphs,
        reportIntroParagraphs:
          Array.isArray(overrides.pageTexts.reportIntroParagraphs) && overrides.pageTexts.reportIntroParagraphs.length
            ? overrides.pageTexts.reportIntroParagraphs
            : base.pageTexts.reportIntroParagraphs,
        reportIdentityParagraphs:
          Array.isArray(overrides.pageTexts.reportIdentityParagraphs) && overrides.pageTexts.reportIdentityParagraphs.length
            ? overrides.pageTexts.reportIdentityParagraphs
            : base.pageTexts.reportIdentityParagraphs,
        reportIncidentParagraphs:
          Array.isArray(overrides.pageTexts.reportIncidentParagraphs) && overrides.pageTexts.reportIncidentParagraphs.length
            ? overrides.pageTexts.reportIncidentParagraphs
            : base.pageTexts.reportIncidentParagraphs,
      })
    : base.pageTexts;

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
    faqItems:
      Array.isArray(overrides.faqItems) && overrides.faqItems.length ? normalizeFaqItems(overrides.faqItems) : base.faqItems,
    pageTexts,
  };
}
