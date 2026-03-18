import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeAlert,
  Building2,
  FileCheck2,
  FileWarning,
  HeartHandshake,
  LockKeyhole,
  Phone,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { EthicsChannelConfig } from "@/lib/ethicsChannel";

type BrandProfile = {
  accent: string;
  accentSoft: string;
  accentLight: string;
  heading: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  imageUrl: string;
  imageAlt: string;
  codeSummary: string;
  dataProtectionSummary: string;
  principles: string[];
  foundation?: {
    title: string;
    subtitle: string;
    pillars: Array<{
      label: string;
      text: string;
    }>;
    steer?: {
      title: string;
      body: string;
    };
  } | null;
};

function normalizeValue(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildBrandProfile(config: EthicsChannelConfig): BrandProfile {
  const normalized = `${normalizeValue(config.key)} ${normalizeValue(config.companyName)}`;
  const isSolida = normalized.includes("solida");

  if (isSolida) {
    return {
      accent: "#99A41A",
      accentSoft: "#2E3647",
      accentLight: "#EEF1D4",
      heading: "Tecnologia, excelencia e responsabilidade em cada relacao.",
      heroTitle: "Bem-vindo ao Canal de Etica da Solida",
      heroSubtitle:
        "Um ambiente seguro, imparcial e protegido para comunicar condutas que possam violar o Codigo de Etica e Conduta, as politicas internas ou a legislacao aplicavel.",
      intro:
        "Na Solida, acreditamos que a engenharia transforma realidades. Por isso, nossa atuacao precisa refletir responsabilidade profissional, respeito as pessoas, integridade nas decisoes e compromisso permanente com a confianca.",
      imageUrl: config.heroImageUrl || "/institucional/pdf/page-07.jpg",
      imageAlt: "Atuacao da Solida em projetos de energia renovavel",
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
      foundation: {
        title: "Base institucional da Solida",
        subtitle:
          "O canal de etica da Solida nasce do mesmo conjunto de principios que orienta nossa atuacao tecnica, nosso relacionamento com pessoas e a forma como conduzimos decisoes.",
        pillars: [
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
        steer: {
          title: "STEER",
          body: "Conduzindo o futuro da engenharia com tecnologia, excelencia e responsabilidade.",
        },
      },
    };
  }

  return {
    accent: "#1E3A8A",
    accentSoft: "#0F172A",
    accentLight: "#E7EEFF",
    heading: "Integridade e protecao para quem precisa relatar.",
    heroTitle: `Canal de Etica de ${config.companyName}`,
    heroSubtitle:
      "Um espaco preparado para receber relatos com seriedade, sigilo, imparcialidade e orientacao para apuracao.",
    intro:
      "Este canal existe para apoiar a identificacao de condutas que contrariem os valores da empresa, a legislacao e os padroes esperados de etica, integridade e respeito.",
    imageUrl: config.heroImageUrl || "/bg-login.jpg",
    imageAlt: `Equipe da ${config.companyName}`,
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
    foundation: null,
  };
}

const reportTopics = [
  {
    title: "Assedio e discriminacao",
    description: "Assedio moral, assedio sexual, humilhacao, preconceito, retaliacao ou condutas que comprometam a dignidade.",
    icon: HeartHandshake,
  },
  {
    title: "Fraude e corrupcao",
    description: "Suborno, fraude documental, desvio de recursos, conflito de interesses ou favorecimento indevido.",
    icon: Scale,
  },
  {
    title: "Conduta inadequada",
    description: "Violacoes do codigo de etica, abuso de autoridade, quebra de regras internas ou comportamento antietico.",
    icon: BadgeAlert,
  },
  {
    title: "Seguranca e dados",
    description: "Vazamento de informacoes, falhas de controle, acesso indevido ou risco relevante para pessoas e ativos.",
    icon: ShieldCheck,
  },
];

const guarantees = [
  "Tratamento confidencial do relato e das evidencias.",
  "Triagem com criterio, registro formal e restricao de acesso.",
  "Nao tolerancia a retaliacao contra relatos feitos de boa-fe.",
  "Encaminhamento para apuracao com rastreabilidade e imparcialidade.",
];

const flow = [
  {
    step: "01",
    title: "Registro do relato",
    body: "Informe o contexto, a data aproximada, as pessoas envolvidas e, se houver, documentos ou evidencias.",
  },
  {
    step: "02",
    title: "Triagem e classificacao",
    body: "O caso e avaliado por natureza, gravidade, urgencia e necessidade de investigacao complementar.",
  },
  {
    step: "03",
    title: "Apuracao protegida",
    body: "As evidencias sao analisadas com sigilo, acesso controlado e documentacao das decisoes do processo.",
  },
  {
    step: "04",
    title: "Desfecho",
    body: "O caso recebe tratamento, medidas cabiveis e, quando houver protocolo, possibilidade de acompanhamento.",
  },
];

const faq = [
  {
    question: "Quem pode utilizar o canal?",
    answer:
      "Colaboradores, liderancas, parceiros, fornecedores, prestadores e qualquer pessoa que precise comunicar uma situacao contraria a etica ou a conformidade.",
  },
  {
    question: "Posso relatar de forma reservada?",
    answer:
      "A pagina foi preparada para trabalhar com canais que preservem a identidade quando essa opcao estiver disponivel no fluxo configurado pela empresa.",
  },
  {
    question: "Que informacoes ajudam na analise?",
    answer:
      "Descricao objetiva do fato, data aproximada, local, area envolvida, nomes, prints, documentos e qualquer evidencia que ajude na apuracao.",
  },
  {
    question: "Como acompanho o meu caso?",
    answer:
      "Quando houver fluxo de acompanhamento por protocolo, utilize o acesso especifico desta pagina para consultar andamento e retorno.",
  },
];

function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const className = primary
    ? "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:translate-y-[-1px]"
    : "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50";
  const style = primary ? { backgroundColor: "var(--ethics-accent)" } : undefined;
  const external = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");

  if (external) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
      {label}
    </Link>
  );
}

export default function EthicsChannelLanding({
  config,
  companies,
}: {
  config: EthicsChannelConfig;
  companies: EthicsChannelConfig[];
}) {
  const profile = buildBrandProfile(config);
  const reportHref = config.reportUrl || (config.contactEmail ? `mailto:${config.contactEmail}?subject=Canal%20de%20Etica` : "#contatos");
  const followUpHref = config.followUpUrl || "#fluxo";
  const dataProtectionHref = config.dataProtectionUrl || "#dados";
  const codeOfEthicsHref = config.codeOfEthicsUrl || "#codigo";
  const phoneHref = config.contactPhone ? `tel:${config.contactPhone}` : null;

  const navItems = [
    { label: "Pagina inicial", href: "#inicio" },
    { label: "Realizar relato", href: reportHref },
    { label: "Acompanhar relato", href: followUpHref },
    { label: "Protecao de Dados", href: dataProtectionHref },
    { label: "Codigo de Etica", href: codeOfEthicsHref },
  ];

  return (
    <main
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_40%,#ffffff_100%)] text-slate-950"
      style={
        {
          "--ethics-accent": profile.accent,
          "--ethics-soft": profile.accentSoft,
          "--ethics-light": profile.accentLight,
        } as React.CSSProperties
      }
    >
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link href="/canal-de-etica" className="flex items-center gap-4">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: "var(--ethics-soft)" }}
            >
              <Building2 size={24} />
            </span>
            <span>
              <span className="block text-2xl font-semibold tracking-tight text-slate-950">{config.companyName}</span>
              <span className="block text-sm text-slate-500">Canal de Etica e Integridade</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-5">
            {navItems.map((item) => (
              <NavLink key={item.label} href={item.href} label={item.label} />
            ))}
          </div>
        </div>
      </header>

      <section id="inicio" className="relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-[540px]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--ethics-accent) 92%, white 8%) 0%, color-mix(in srgb, var(--ethics-soft) 92%, white 8%) 100%)",
          }}
        />
        <div className="absolute left-[-90px] top-[140px] h-72 w-72 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute right-[8%] top-[100px] h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-8 lg:px-10 lg:pb-24">
          {companies.length > 1 ? (
            <div className="mb-8 flex flex-wrap gap-2">
              {companies.map((item) => (
                <Link
                  key={item.key}
                  href={`/canal-de-etica/${item.key}`}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition ${
                    item.key === config.key
                      ? "border-white/40 bg-white text-slate-950"
                      : "border-white/20 bg-white/8 text-white hover:bg-white/14"
                  }`}
                >
                  {item.companyName}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[1.02fr,0.98fr] lg:items-stretch">
            <div className="overflow-hidden rounded-[36px] border border-white/20 bg-white/10 shadow-[0_35px_100px_-55px_rgba(15,23,42,0.95)] backdrop-blur-sm">
              <div className="relative min-h-[340px] lg:min-h-[520px]">
                <Image src={profile.imageUrl} alt={profile.imageAlt} fill className="object-cover" priority />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.34)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                  <div className="max-w-md rounded-[28px] border border-white/15 bg-slate-950/58 p-5 text-white backdrop-blur-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Compromisso</p>
                    <p className="mt-3 text-2xl font-semibold leading-tight">{profile.heading}</p>
                    <p className="mt-3 text-sm leading-7 text-white/80">{profile.intro}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[40px] border border-slate-200 bg-white px-7 py-8 shadow-[0_36px_100px_-60px_rgba(15,23,42,0.8)] lg:px-10 lg:py-10">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white" style={{ backgroundColor: "var(--ethics-soft)" }}>
                <LockKeyhole size={14} />
                Canal seguro e confidencial
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {profile.heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-9 text-slate-600">{profile.heroSubtitle}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink href={reportHref} primary>
                  Realizar relato
                  <ArrowRight size={16} />
                </ActionLink>
                <ActionLink href={followUpHref}>
                  Acompanhar relato
                  <SearchCheck size={16} />
                </ActionLink>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sigilo</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">Recebimento reservado</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Informacoes e evidencias devem circular com acesso restrito.</p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Integridade</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">Analise imparcial</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Cada caso precisa ser triado, registrado e tratado com criterio.</p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Protecao</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">Sem retaliacao</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Relatos de boa-fe devem ser acolhidos com seriedade e protecao.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="rounded-[34px] border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#f8fafc_100%)] p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Mensagem central</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Canal exclusivo para preservar etica, respeito e confianca.</h2>
                <p className="mt-4 text-base leading-8 text-slate-600">{profile.codeSummary}</p>
              </div>
              <div className="grid gap-3">
                {profile.principles.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {profile.foundation ? (
        <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
          <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
            <div
              className="border-b border-slate-200 px-7 py-7 lg:px-8"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--ethics-light) 82%, white 18%) 0%, #ffffff 100%)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Identidade institucional</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{profile.foundation.title}</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{profile.foundation.subtitle}</p>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr,320px]">
              <div className="grid gap-0 md:grid-cols-3">
                {profile.foundation.pillars.map((pillar, index) => (
                  <article
                    key={pillar.label}
                    className={`p-7 lg:p-8 ${index < profile.foundation!.pillars.length - 1 ? "border-b border-slate-200 md:border-b-0 md:border-r" : ""}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{pillar.label}</p>
                    <p className="mt-4 text-base leading-8 text-slate-700">{pillar.text}</p>
                  </article>
                ))}
              </div>

              {profile.foundation.steer ? (
                <aside className="border-t border-slate-200 bg-slate-950 p-7 text-white lg:border-l lg:border-t-0 lg:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Cultura</p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-tight">{profile.foundation.steer.title}</h3>
                  <p className="mt-4 text-base leading-8 text-slate-300">{profile.foundation.steer.body}</p>
                </aside>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reportTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <article key={topic.title} className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: "var(--ethics-soft)" }}
                >
                  <Icon size={20} />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-slate-950">{topic.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{topic.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="fluxo" className="border-y border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Fluxo do canal</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Uma jornada clara para receber, analisar e tratar cada caso.</h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              O objetivo do canal nao e apenas receber relatos, mas garantir tratamento estruturado, documentado e coerente com a gravidade de cada situacao.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {flow.map((item) => (
              <article key={item.step} className="rounded-[28px] border border-white/10 bg-white/6 p-6 backdrop-blur-sm">
                <div
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--ethics-accent)" }}
                >
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="dados" className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: "var(--ethics-soft)" }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Protecao de dados</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Sigilo e necessidade de conhecimento.</h2>
              </div>
            </div>
            <p className="mt-6 text-sm leading-8 text-slate-600">{profile.dataProtectionSummary}</p>
            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              Os dados do relato devem ser usados exclusivamente para triagem, investigacao, medidas de tratamento e cumprimento de obrigacoes legais, sempre com proporcionalidade e controle de acesso.
            </div>
            {config.dataProtectionUrl ? (
              <div className="mt-6">
                <ActionLink href={config.dataProtectionUrl}>
                  Ver politica de protecao de dados
                  <ArrowRight size={16} />
                </ActionLink>
              </div>
            ) : null}
          </article>

          <article id="codigo" className="rounded-[34px] border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#f8fafc_100%)] p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: "var(--ethics-accent)" }}
              >
                <FileCheck2 size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Codigo de etica</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Principios que orientam a conduta esperada.</h2>
              </div>
            </div>
            <p className="mt-6 text-sm leading-8 text-slate-600">{profile.codeSummary}</p>
            <div className="mt-6 grid gap-3">
              {guarantees.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            {config.codeOfEthicsUrl ? (
              <div className="mt-6">
                <ActionLink href={config.codeOfEthicsUrl}>
                  Acessar codigo completo
                  <ArrowRight size={16} />
                </ActionLink>
              </div>
            ) : null}
          </article>
        </div>
      </section>

      <section id="contatos" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <article className="rounded-[34px] border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#f8fafc_100%)] p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Acoes rapidas</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Escolha a forma mais adequada para iniciar o atendimento.</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                O fluxo de relato pode ser feito por formulario, protocolo, e-mail ou contato direto, conforme a configuracao da empresa.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink href={reportHref} primary>
                  Realizar relato
                  <ArrowRight size={16} />
                </ActionLink>
                <ActionLink href={followUpHref}>
                  Acompanhar protocolo
                  <SearchCheck size={16} />
                </ActionLink>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold text-slate-950">Registrar relato</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">Use este acesso para detalhar o fato, anexar evidencias e formalizar o caso.</p>
              </article>

              <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-semibold text-slate-950">Consultar andamento</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">Quando houver protocolo, acompanhe a evolucao do atendimento pelo canal indicado.</p>
              </article>

              {config.contactEmail ? (
                <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold text-slate-950">E-mail do canal</p>
                  <p className="mt-3 break-all text-sm leading-7 text-slate-600">{config.contactEmail}</p>
                </article>
              ) : null}

              {phoneHref ? (
                <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold text-slate-950">Contato telefonico</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{config.contactPhone}</p>
                  <div className="mt-5">
                    <ActionLink href={phoneHref}>
                      <Phone size={16} />
                      Ligar para o canal
                    </ActionLink>
                  </div>
                </article>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Perguntas frequentes</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">O que normalmente gera mais duvida antes de relatar.</h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {faq.map((item) => (
            <article key={item.question} className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div
                  className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: "var(--ethics-soft)" }}
                >
                  <FileWarning size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Encaminhamento etico</p>
            <p className="mt-3 text-lg font-semibold">Se algo nao parece correto, registre. O silencio nao protege a integridade.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionLink href={reportHref} primary>
              Registrar agora
              <Sparkles size={16} />
            </ActionLink>
            <Link href="/canal-de-etica" className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/8">
              Trocar empresa
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
