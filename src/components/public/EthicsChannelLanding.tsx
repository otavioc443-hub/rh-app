import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeAlert,
  Building2,
  FileWarning,
  HeartHandshake,
  Scale,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { EthicsChannelConfig } from "@/lib/ethicsChannel";
import type { EthicsManagedContent } from "@/lib/ethicsChannelDefaults";

type TabKey = "home" | "report" | "follow-up" | "data" | "code";

function tabHref(companyKey: string, tab: TabKey) {
  if (tab === "home") return `/canal-de-etica/${companyKey}`;
  if (tab === "report") return `/canal-de-etica/${companyKey}/realizar-relato`;
  if (tab === "follow-up") return `/canal-de-etica/${companyKey}/acompanhar-relato`;
  if (tab === "data") return `/canal-de-etica/${companyKey}/protecao-de-dados`;
  return `/canal-de-etica/${companyKey}/codigo-de-etica`;
}

function tabLabel(tab: TabKey) {
  if (tab === "home") return "P\u00e1gina Inicial";
  if (tab === "report") return "Realizar relato";
  if (tab === "follow-up") return "Acompanhar relato";
  if (tab === "data") return "Prote\u00e7\u00e3o de Dados";
  return "C\u00f3digo de \u00c9tica";
}

function innerHeroContent(activeTab: Exclude<TabKey, "home">, content: EthicsManagedContent) {
  if (activeTab === "report") {
    return {
      title: "Registre um relato com clareza e seguran\u00e7a.",
      body:
        "Use este espa\u00e7o para comunicar situa\u00e7\u00f5es que contrariem a \u00e9tica, a integridade, as pol\u00edticas internas ou a legisla\u00e7\u00e3o aplic\u00e1vel.",
      asideTitle: "Diretriz principal",
      asideBody: "Descreva o fato com objetividade, contexto e evid\u00eancias sempre que poss\u00edvel.",
    };
  }
  if (activeTab === "follow-up") {
    return {
      title: "Acompanhe um relato j\u00e1 registrado.",
      body: "Consulte o andamento de um caso aberto utilizando o fluxo de acompanhamento disponibilizado pela empresa.",
      asideTitle: "Diretriz principal",
      asideBody: "Use o acompanhamento apenas para consultas relacionadas a um protocolo existente.",
    };
  }
  if (activeTab === "data") {
    return {
      title: "Prote\u00e7\u00e3o de dados e tratamento reservado.",
      body:
        content.dataProtectionSummary ||
        "As informa\u00e7\u00f5es tratadas neste canal devem seguir crit\u00e9rios de sigilo, acesso restrito e necessidade de conhecimento.",
      asideTitle: "Diretriz principal",
      asideBody: "Dados pessoais e evid\u00eancias devem ser usados apenas para triagem, apura\u00e7\u00e3o e tratamento do caso.",
    };
  }
  return {
    title: "Consulte os princ\u00edpios do C\u00f3digo de \u00c9tica.",
    body:
      content.codeSummary ||
      "Os princ\u00edpios \u00e9ticos orientam condutas, decis\u00f5es e rela\u00e7\u00f5es internas e externas da empresa.",
    asideTitle: "Diretriz principal",
    asideBody: "O canal complementa o c\u00f3digo, mas n\u00e3o substitui as regras formais de conduta e integridade.",
  };
}

const reportTopics = [
  {
    title: "Ass\u00e9dio e discrimina\u00e7\u00e3o",
    description:
      "Ass\u00e9dio moral, ass\u00e9dio sexual, humilha\u00e7\u00e3o, preconceito, retalia\u00e7\u00e3o ou condutas que comprometam a dignidade.",
    icon: HeartHandshake,
  },
  {
    title: "Fraude e corrup\u00e7\u00e3o",
    description: "Suborno, fraude documental, desvio de recursos, conflito de interesses ou favorecimento indevido.",
    icon: Scale,
  },
  {
    title: "Conduta inadequada",
    description:
      "Viola\u00e7\u00f5es do c\u00f3digo de \u00e9tica, abuso de autoridade, quebra de regras internas ou comportamento anti\u00e9tico.",
    icon: BadgeAlert,
  },
  {
    title: "Seguran\u00e7a e dados",
    description: "Vazamento de informa\u00e7\u00f5es, falhas de controle, acesso indevido ou risco relevante para pessoas e ativos.",
    icon: ShieldCheck,
  },
];

const guarantees = [
  "Tratamento confidencial do relato e das evid\u00eancias.",
  "Triagem com crit\u00e9rio, registro formal e restri\u00e7\u00e3o de acesso.",
  "N\u00e3o toler\u00e2ncia \u00e0 retalia\u00e7\u00e3o contra relatos feitos de boa-f\u00e9.",
  "Encaminhamento para apura\u00e7\u00e3o com rastreabilidade e imparcialidade.",
];

const flow = [
  {
    step: "01",
    title: "Registro do relato",
    body: "Informe o contexto, a data aproximada, as pessoas envolvidas e, se houver, documentos ou evid\u00eancias.",
  },
  {
    step: "02",
    title: "Triagem e classifica\u00e7\u00e3o",
    body: "O caso \u00e9 avaliado por natureza, gravidade, urg\u00eancia e necessidade de investiga\u00e7\u00e3o complementar.",
  },
  {
    step: "03",
    title: "Apura\u00e7\u00e3o protegida",
    body: "As evid\u00eancias s\u00e3o analisadas com sigilo, acesso controlado e documenta\u00e7\u00e3o das decis\u00f5es do processo.",
  },
  {
    step: "04",
    title: "Desfecho",
    body: "O caso recebe tratamento, medidas cab\u00edveis e, quando houver protocolo, possibilidade de acompanhamento.",
  },
];

const faq = [
  {
    question: "Quem pode utilizar o canal?",
    answer:
      "Colaboradores, lideran\u00e7as, parceiros, fornecedores, prestadores e qualquer pessoa que precise comunicar uma situa\u00e7\u00e3o contr\u00e1ria \u00e0 \u00e9tica ou \u00e0 conformidade.",
  },
  {
    question: "Posso relatar de forma reservada?",
    answer:
      "A p\u00e1gina foi preparada para trabalhar com canais que preservem a identidade quando essa op\u00e7\u00e3o estiver dispon\u00edvel no fluxo configurado pela empresa.",
  },
  {
    question: "Que informa\u00e7\u00f5es ajudam na an\u00e1lise?",
    answer:
      "Descri\u00e7\u00e3o objetiva do fato, data aproximada, local, \u00e1rea envolvida, nomes, prints, documentos e qualquer evid\u00eancia que ajude na apura\u00e7\u00e3o.",
  },
  {
    question: "Como acompanho o meu caso?",
    answer:
      "Quando houver fluxo de acompanhamento por protocolo, utilize o acesso espec\u00edfico desta p\u00e1gina para consultar andamento e retorno.",
  },
];

function ActionLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
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
    <Link href={href} className={className} style={style} scroll>
      {children}
    </Link>
  );
}
function TabButton({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      {children}
    </span>
  );
}

function SectionTitle({
  kicker,
  title,
  body,
  dark = false,
}: {
  kicker: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-[34px] border p-7 shadow-sm ${
        dark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${dark ? "text-white/60" : "text-slate-500"}`}>
        {kicker}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className={`mt-4 max-w-3xl text-base leading-8 ${dark ? "text-slate-300" : "text-slate-600"}`}>{body}</p>
    </div>
  );
}

function buildSteerCards(body: string | null) {
  const text = String(body ?? "").trim();
  if (!text) return [];

  const matches = Array.from(text.matchAll(/([STEER])\s+representa\s+([^;]+?)(?=(?:;\s*[STEER]\s+representa)|$)/gi));
  if (!matches.length) return [];

  const cards = matches.map((match) => ({
    letter: match[1].toUpperCase(),
    description: match[2].trim().replace(/\.$/, ""),
  }));

  const ethicsDescription =
    "Ética e Integridade. Atuamos com transparência, responsabilidade profissional e respeito em todas as nossas relações";

  const ethicsCardExists = cards.some((item) => normalizeSteerText(item.description).includes("etica e integridade"));
  const eCount = cards.filter((item) => item.letter === "E").length;

  if (eCount < 2 && !ethicsCardExists) {
    const rIndex = cards.findIndex((item) => item.letter === "R");
    const insertAt = rIndex >= 0 ? rIndex : cards.length;
    cards.splice(insertAt, 0, {
      letter: "E",
      description: ethicsDescription,
    });
  }

  return cards;
}

function normalizeSteerText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function summarizeFoundationText(label: string, text: string) {
  const normalizedLabel = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (normalizedLabel === "proposito") {
    return "Projetar o futuro por meio da engenharia, conectando tecnologia, inteligência e pessoas.";
  }

  if (normalizedLabel === "missao") {
    return "Desenvolver soluções de engenharia inovadoras, seguras e eficientes com tecnologia, BIM e excelência técnica.";
  }

  if (normalizedLabel === "visao") {
    return "Ser referência em engenharia digital, inovação tecnológica e modelagem BIM, com excelência técnica e impacto positivo.";
  }

  const firstSentence = text.match(/.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence || text;
}

function HomeHero({ config, content }: { config: EthicsChannelConfig; content: EthicsManagedContent }) {
  const isSolida = config.companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes("solida");

  return (
    <>
      <section className="relative min-h-[460px] overflow-hidden lg:min-h-[620px]">
        <Image
          src={content.heroImageUrl || config.heroImageUrl || "/bg-login.jpg"}
          alt={isSolida ? "Atua\u00e7\u00e3o da S\u00f3lida em projetos de energia renov\u00e1vel" : `Equipe da ${config.companyName}`}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.6)_0%,rgba(15,23,42,0.28)_40%,rgba(15,23,42,0.4)_100%)]" />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-8 lg:px-10 lg:pt-10">
        <div className="rounded-[40px] border border-slate-200 bg-white/97 px-7 py-8 shadow-[0_36px_100px_-60px_rgba(15,23,42,0.8)] backdrop-blur lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Canal oficial</p>
              <p className="mt-3 text-3xl font-semibold leading-[1.02] text-slate-950 md:text-4xl lg:text-[3.5rem]">
                {content.heroTitle}
              </p>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 lg:text-lg">{content.heroSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={tabHref(config.key, "report")}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:translate-y-[-1px]"
                  style={{ backgroundColor: "var(--ethics-accent)" }}
                  scroll
                >
                  Realizar relato
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href={tabHref(config.key, "follow-up")}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  scroll
                >
                  Acompanhar relato
                  <SearchCheck size={16} />
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Compromisso</p>
              <p className="mt-3 text-2xl font-semibold leading-tight">{content.heading}</p>
              <p className="mt-3 text-sm leading-7 text-white/80">{content.intro}</p>
            </div>
          </div>

        </div>
      </section>
    </>
  );
}

function InnerHero({
  activeTab,
  content,
}: {
  activeTab: Exclude<TabKey, "home">;
  content: EthicsManagedContent;
}) {
  const hero = innerHeroContent(activeTab, content);

  return (
    <section className="mx-auto max-w-7xl px-6 pb-10 pt-10 lg:px-10 lg:pt-12">
      <div className="rounded-[40px] border border-slate-200 bg-white px-7 py-8 shadow-[0_30px_80px_-52px_rgba(15,23,42,0.55)] lg:px-10 lg:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{tabLabel(activeTab)}</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,0.8fr] lg:items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{hero.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{hero.body}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{hero.asideTitle}</p>
            <p className="mt-3 text-base font-semibold text-slate-950">{tabLabel(activeTab)}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{hero.asideBody}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function EthicsChannelLanding({
  config,
  companies,
  content,
  activeTab = "home",
}: {
  config: EthicsChannelConfig;
  companies: EthicsChannelConfig[];
  content: EthicsManagedContent;
  activeTab?: TabKey;
}) {
  const isSolida = config.companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes("solida");
  const accent = isSolida ? "#99A41A" : "#1E3A8A";
  const accentSoft = isSolida ? "#2E3647" : "#0F172A";
  const reportHref = config.reportUrl || (config.contactEmail ? `mailto:${config.contactEmail}?subject=Canal%20de%20\u00c9tica` : "#");
  const followUpHref = config.followUpUrl || "#";
  const codeTabHref = config.codeOfEthicsUrl;
  const steerCards = buildSteerCards(content.steerBody);
  const companyTabs = companies.map((item) => ({ ...item, href: `/canal-de-etica/${item.key}` }));

  return (
    <main
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#ffffff_100%)] text-slate-950"
      style={{ "--ethics-accent": accent, "--ethics-soft": accentSoft } as CSSProperties}
    >
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link href="/canal-de-etica" className="flex items-center gap-4" scroll>
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: "var(--ethics-soft)" }}
            >
              <Building2 size={24} />
            </span>
            <span>
              <span className="block text-2xl font-semibold tracking-tight text-slate-950">{config.companyName}</span>
              <span className="block text-sm text-slate-500">Canal de \u00c9tica e Integridade</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <Link href={tabHref(config.key, "home")} scroll><TabButton active={activeTab === "home"}>{tabLabel("home")}</TabButton></Link>
            <Link href={tabHref(config.key, "report")} scroll><TabButton active={activeTab === "report"}>{tabLabel("report")}</TabButton></Link>
            <Link href={tabHref(config.key, "follow-up")} scroll><TabButton active={activeTab === "follow-up"}>{tabLabel("follow-up")}</TabButton></Link>
            <Link href={tabHref(config.key, "data")} scroll><TabButton active={activeTab === "data"}>{tabLabel("data")}</TabButton></Link>
            {codeTabHref ? (
              <a href={codeTabHref} target="_blank" rel="noreferrer"><TabButton active={false}>{tabLabel("code")}</TabButton></a>
            ) : null}
          </div>
        </div>
      </header>

      {activeTab === "home" ? <HomeHero config={config} content={content} /> : <InnerHero activeTab={activeTab} content={content} />}

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        {companyTabs.length > 1 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {companyTabs.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${item.key === config.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                scroll
              >
                {item.companyName}
              </Link>
            ))}
          </div>
        ) : null}

        {activeTab === "home" ? (
          <div className="space-y-10">
            <SectionTitle kicker="Mensagem central" title="Canal exclusivo para preservar \u00e9tica, respeito e confian\u00e7a." body={content.codeSummary ?? ""} />
            {content.foundationTitle ? (
              <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-7 py-7 lg:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Identidade institucional</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{content.foundationTitle}</h2>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{content.foundationSubtitle}</p>
                </div>
                <div className="grid gap-0">
                  <div className="grid gap-0 md:grid-cols-3">
                    {content.foundationPillars.map((pillar, index) => (
                      <article key={pillar.label} className={`p-7 lg:p-8 ${index < content.foundationPillars.length - 1 ? "border-b border-slate-200 md:border-b-0 md:border-r" : ""}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{pillar.label}</p>
                        <p className="mt-4 text-base leading-8 text-slate-700">{summarizeFoundationText(pillar.label, pillar.text)}</p>
                      </article>
                    ))}
                  </div>
                  {content.steerTitle ? (
                    <aside className="border-t border-slate-200 bg-slate-950 p-7 text-white lg:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Cultura</p>
                      <h3 className="mt-3 text-3xl font-semibold tracking-tight">{content.steerTitle}</h3>
                      {steerCards.length ? (
                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          {steerCards.map((item) => (
                            <article key={`${item.letter}-${item.description}`} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                              <div className="flex flex-col gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white text-lg font-semibold text-slate-950">
                                  {item.letter}
                                </div>
                                <p className="text-sm leading-7 text-slate-300">{item.description}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-base leading-8 text-slate-300">{content.steerBody}</p>
                      )}
                    </aside>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="space-y-8">
            <SectionTitle kicker="Realizar relato" title="Escolha a forma mais adequada para registrar o caso." body="Use este canal para comunicar situa\u00e7\u00f5es que contrariem o C\u00f3digo de \u00c9tica, as pol\u00edticas internas, a legisla\u00e7\u00e3o ou a integridade do ambiente de trabalho." />
            <div className="flex flex-wrap gap-3">
              <ActionLink href={reportHref} primary>Abrir canal de relato<ArrowRight size={16} /></ActionLink>
              {config.contactEmail ? <ActionLink href={`mailto:${config.contactEmail}`}>Falar por e-mail</ActionLink> : null}
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr,0.9fr]">
              <div className="grid gap-4 md:grid-cols-2">
                {reportTopics.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <article key={topic.title} className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: "var(--ethics-soft)" }}><Icon size={20} /></div>
                      <h3 className="mt-5 text-lg font-semibold text-slate-950">{topic.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{topic.description}</p>
                    </article>
                  );
                })}
              </div>
              <div className="rounded-[34px] border border-slate-200 bg-slate-950 p-7 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Antes de enviar</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">Prepare um relato claro, verific\u00e1vel e \u00fatil para apura\u00e7\u00e3o.</h3>
                <div className="mt-6 space-y-3">
                  {["Descreva objetivamente o fato, sem suposi\u00e7\u00f5es desnecess\u00e1rias.", "Informe data aproximada, local, \u00e1rea e pessoas envolvidas.", "Anexe documentos, prints ou evid\u00eancias quando existirem.", "Se houver risco imediato \u00e0 seguran\u00e7a, use tamb\u00e9m o canal emergencial da empresa."].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-200">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "follow-up" ? (
          <div className="space-y-8">
            <SectionTitle kicker="Acompanhar relato" title="Uma jornada clara para receber, analisar e tratar cada caso." body="O objetivo do canal n\u00e3o \u00e9 apenas receber relatos, mas garantir tratamento estruturado, documentado e coerente com a gravidade de cada situa\u00e7\u00e3o." dark />
            <div className="flex flex-wrap gap-3"><ActionLink href={followUpHref} primary>Consultar andamento<SearchCheck size={16} /></ActionLink></div>
            <div className="grid gap-4 xl:grid-cols-[1fr,0.9fr]">
              <div className="grid gap-4 lg:grid-cols-4">
                {flow.map((item) => (
                  <article key={item.step} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "var(--ethics-accent)" }}>{item.step}</div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">O que ter em m\u00e3os</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Facilite a consulta do protocolo.</h3>
                <div className="mt-6 space-y-3">
                  {["Tenha em m\u00e3os o n\u00famero de protocolo ou identificador do atendimento.", "Mantenha atualizados os meios de contato informados no registro.", "Use o acompanhamento apenas para consultas ligadas ao caso j\u00e1 aberto."].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "data" ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: "var(--ethics-soft)" }}><ShieldCheck size={22} /></div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Prote\u00e7\u00e3o de dados</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Sigilo e necessidade de conhecimento.</h2>
                </div>
              </div>
              <p className="mt-6 text-sm leading-8 text-slate-600">{content.dataProtectionSummary}</p>
              <div className="mt-6 space-y-3">
                {["Acesso limitado a pessoas autorizadas e com necessidade de conhecimento.", "Uso exclusivo das informa\u00e7\u00f5es para triagem, investiga\u00e7\u00e3o e tratamento do caso.", "Preserva\u00e7\u00e3o de evid\u00eancias e prote\u00e7\u00e3o de dados pessoais durante toda a apura\u00e7\u00e3o."].map((item) => (
                  <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">{item}</div>
                ))}
              </div>
              {config.dataProtectionUrl ? (
                <div className="mt-6"><ActionLink href={config.dataProtectionUrl}>Ver pol\u00edtica de prote\u00e7\u00e3o de dados<ArrowRight size={16} /></ActionLink></div>
              ) : null}
            </article>

            <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Perguntas frequentes</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">D\u00favidas comuns antes de registrar um caso.</h2>
              <div className="mt-8 grid gap-4">
                {faq.map((item) => (
                  <article key={item.question} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: "var(--ethics-soft)" }}><FileWarning size={18} /></div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </div>
        ) : null}

        {activeTab === "code" ? (
          <div className="space-y-8">
            <SectionTitle kicker="C\u00f3digo de \u00c9tica" title="Princ\u00edpios que orientam decis\u00f5es, relacionamentos e condutas." body={content.codeSummary ?? ""} />
            <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
              <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Compromissos do canal</p>
                <div className="mt-5 grid gap-3">{guarantees.map((item) => (<div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">{item}</div>))}</div>
              </article>
              <article className="rounded-[34px] border border-slate-200 bg-slate-950 p-7 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Documento oficial</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Consulte o c\u00f3digo completo da empresa.</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">O canal de \u00e9tica complementa, mas n\u00e3o substitui, as regras formais de conduta, integridade, preven\u00e7\u00e3o de conflitos, respeito \u00e0s pessoas e prote\u00e7\u00e3o das informa\u00e7\u00f5es.</p>
                {config.codeOfEthicsUrl ? (<div className="mt-6"><ActionLink href={config.codeOfEthicsUrl} primary>Abrir c\u00f3digo de \u00e9tica<ArrowRight size={16} /></ActionLink></div>) : null}
              </article>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="bg-[#030712] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Encaminhamento \u00e9tico</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-white lg:text-[2.15rem]">Se algo n\u00e3o parece correto, registre. O sil\u00eancio n\u00e3o protege a integridade.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href={reportHref} target={reportHref.startsWith("http") ? "_blank" : undefined} rel={reportHref.startsWith("http") ? "noreferrer" : undefined} className="inline-flex items-center justify-center rounded-full px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-24px_rgba(153,164,26,0.95)] transition hover:brightness-105" style={{ backgroundColor: "var(--ethics-accent)" }}>Registrar agora</a>
            <Link href="/canal-de-etica" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-transparent px-7 py-4 text-base font-semibold text-white transition hover:border-white/25 hover:bg-white/5" scroll>Trocar empresa</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
