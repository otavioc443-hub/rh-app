"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileWarning,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
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

const guarantees = [
  "Tratamento confidencial do relato e das evid\u00eancias.",
  "Triagem com crit\u00e9rio, registro formal e restri\u00e7\u00e3o de acesso.",
  "N\u00e3o toler\u00e2ncia \u00e0 retalia\u00e7\u00e3o contra relatos feitos de boa-f\u00e9.",
  "Encaminhamento para apura\u00e7\u00e3o com rastreabilidade e imparcialidade.",
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
  {
    question: "Qual \u00e9 o compromisso da S\u00f3lida com a prote\u00e7\u00e3o de dados pessoais?",
    answer:
      "A S\u00f3lida trata os dados informados no canal de \u00e9tica com sigilo, necessidade de conhecimento e finalidade espec\u00edfica de apura\u00e7\u00e3o, protegendo as pessoas envolvidas, a integridade do processo e a conformidade com a legisla\u00e7\u00e3o aplic\u00e1vel.",
  },
  {
    question: "Quais informa\u00e7\u00f5es devo registrar em meu relato?",
    answer:
      "Registre apenas as informa\u00e7\u00f5es necess\u00e1rias para compreender o fato: contexto, data aproximada, local, \u00e1rea envolvida, pessoas relacionadas e evid\u00eancias dispon\u00edveis. Evite excesso de dados pessoais sem rela\u00e7\u00e3o com a apura\u00e7\u00e3o.",
  },
  {
    question: "Quem ter\u00e1 acesso ao meu relato e aos meus dados?",
    answer:
      "O acesso deve ser restrito \u00e0s pessoas e estruturas autorizadas para triagem, investiga\u00e7\u00e3o, delibera\u00e7\u00e3o e tratamento do caso, al\u00e9m da empresa parceira respons\u00e1vel pela recep\u00e7\u00e3o do relato quando o fluxo assim exigir.",
  },
  {
    question: "O que ser\u00e1 feito com meu relato e por quanto tempo ele poder\u00e1 ser armazenado?",
    answer:
      "O relato ser\u00e1 registrado, analisado e tratado conforme a gravidade, a necessidade de investiga\u00e7\u00e3o e as exig\u00eancias legais aplic\u00e1veis. As informa\u00e7\u00f5es podem ser mantidas pelo tempo necess\u00e1rio \u00e0 apura\u00e7\u00e3o, \u00e0 ado\u00e7\u00e3o de medidas cab\u00edveis e ao atendimento de obriga\u00e7\u00f5es legais e regulat\u00f3rias.",
  },
  {
    question: "Quais s\u00e3o os meus direitos em rela\u00e7\u00e3o aos dados informados?",
    answer:
      "Os titulares podem exercer os direitos previstos na legisla\u00e7\u00e3o de prote\u00e7\u00e3o de dados, observados os limites legais e a necessidade de preserva\u00e7\u00e3o da investiga\u00e7\u00e3o, da confidencialidade e da integridade do canal.",
  },
  {
    question: "D\u00favidas? Mais informa\u00e7\u00f5es?",
    answer:
      "Em caso de d\u00favidas sobre privacidade, tratamento de dados ou funcionamento do canal, utilize os contatos oficiais da S\u00f3lida indicados nesta p\u00e1gina para receber a orienta\u00e7\u00e3o adequada ao seu caso.",
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
  const [reportConsentOpen, setReportConsentOpen] = useState(false);
  const [reportIdentityChoice, setReportIdentityChoice] = useState<"identified" | "anonymous" | null>(null);
  const [followUpProtocol, setFollowUpProtocol] = useState("");
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
            <section className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Orienta\u00e7\u00f5es do canal</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Canal exclusivo para comunica\u00e7\u00e3o segura e tratamento respons\u00e1vel de relatos.</h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  Este \u00e9 um canal exclusivo da {config.companyName} para comunica\u00e7\u00e3o segura e, quando aplic\u00e1vel ao fluxo adotado,
                  tamb\u00e9m reservada, de condutas consideradas anti\u00e9ticas ou que contrariem princ\u00edpios \u00e9ticos, padr\u00f5es de conduta
                  e a legisla\u00e7\u00e3o vigente.
                </p>
                <p>
                  As informa\u00e7\u00f5es registradas neste espa\u00e7o devem receber tratamento adequado, com sigilo, crit\u00e9rio e rastreabilidade,
                  evitando conflitos de interesse e preservando a seriedade de cada situa\u00e7\u00e3o reportada.
                </p>
                {config.contactPhone ? (
                  <p>
                    Se preferir, seu relato tamb\u00e9m pode ser feito pelo telefone {config.contactPhone}, conforme a disponibilidade e
                    o fluxo de atendimento configurado pela empresa.
                  </p>
                ) : null}
                <p>
                  Aten\u00e7\u00e3o: se a sua demanda estiver relacionada a atendimento ao cliente, suporte operacional, produtos ou servi\u00e7os,
                  utilize o canal oficial de atendimento da empresa para que a solicita\u00e7\u00e3o siga para o fluxo correto.
                </p>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="space-y-8">
            <SectionTitle
              kicker="Realizar relato"
              title="Registre um relato com sigilo, clareza e tratamento respons\u00e1vel."
              body="Use este canal para comunicar situa\u00e7\u00f5es que contrariem o C\u00f3digo de \u00c9tica, as pol\u00edticas internas, a legisla\u00e7\u00e3o ou a integridade do ambiente de trabalho."
            />
            <div className="flex flex-wrap gap-3">
              <ActionLink href={reportHref} primary>Abrir canal de relato<ArrowRight size={16} /></ActionLink>
              {config.contactEmail ? <ActionLink href={`mailto:${config.contactEmail}`}>Falar por e-mail</ActionLink> : null}
            </div>
            <article className="rounded-[34px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-5xl font-semibold tracking-tight text-[#635bff]">Realizar relato</h2>
              <div className="mt-10 space-y-8 text-[1.05rem] leading-9 text-slate-800">
                <p>
                  As informa\u00e7\u00f5es aqui registradas ser\u00e3o recebidas por uma empresa independente e especializada, a Aliant,
                  assegurando sigilo absoluto e o tratamento adequado de cada situa\u00e7\u00e3o pela alta administra\u00e7\u00e3o da S\u00f3lida,
                  sem conflitos de interesses.
                </p>
                <p>
                  A veracidade das informa\u00e7\u00f5es providas \u00e9 uma responsabilidade do relator. Todas as informa\u00e7\u00f5es ser\u00e3o
                  verificadas durante o processo de averigua\u00e7\u00e3o, e as a\u00e7\u00f5es decorrentes ser\u00e3o tomadas a crit\u00e9rio exclusivo
                  da S\u00f3lida.
                </p>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Prote\u00e7\u00e3o de Dados</h3>
                  <div className="mt-6 space-y-8">
                    <p>
                      Todas as informa\u00e7\u00f5es aqui registradas ser\u00e3o tratadas de forma confidencial por sua organiza\u00e7\u00e3o e pela
                      Aliant, uma empresa independente e especializada na capta\u00e7\u00e3o e tratamento de den\u00fancias.
                    </p>
                    <p>
                      A capta\u00e7\u00e3o dessas informa\u00e7\u00f5es tem por finalidade a apura\u00e7\u00e3o de poss\u00edveis condutas consideradas
                      anti\u00e9ticas ou que violem os princ\u00edpios \u00e9ticos e padr\u00f5es de conduta e/ou a legisla\u00e7\u00e3o vigente.
                    </p>
                    <p>
                      Todos os relatos ser\u00e3o armazenados pelo tempo necess\u00e1rio para realiza\u00e7\u00e3o do processo de apura\u00e7\u00e3o e
                      delibera\u00e7\u00e3o sobre o caso, observando-se as exig\u00eancias legais espec\u00edficas. Al\u00e9m disso, informa\u00e7\u00f5es
                      consolidadas poder\u00e3o ser utilizadas para gera\u00e7\u00e3o de estat\u00edsticas da opera\u00e7\u00e3o, sem exposi\u00e7\u00e3o de nomes
                      envolvidos ou dados pessoais.
                    </p>
                    <p>
                      Eventuais dados pessoais informados ser\u00e3o tratados conforme as normativas estabelecidas pela
                      legisla\u00e7\u00e3o vigente no que diz respeito \u00e0 prote\u00e7\u00e3o de dados pessoais, observadas pela Aliant no
                      processo de capta\u00e7\u00e3o e pela S\u00f3lida no processo de apura\u00e7\u00e3o dos relatos aqui registrados.
                    </p>
                    <p>
                      Ao clicar em &quot;Concordo&quot; voc\u00ea indica ci\u00eancia e concord\u00e2ncia com o fornecimento de informa\u00e7\u00f5es
                      que ser\u00e3o \u00fanica e exclusivamente utilizadas para esta finalidade.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportConsentOpen((prev) => !prev)}
                className="mt-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left text-lg font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Declaro que li e compreendi as informa\u00e7\u00f5es acima, e desejo prosseguir com a manifesta\u00e7\u00e3o.
              </button>
            </article>
            {reportConsentOpen ? (
              <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Identifica\u00e7\u00e3o do relator</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Voc\u00ea pode escolher fazer um relato an\u00f4nimo ou identificar-se.</h3>
                <div className="mt-5 space-y-4 text-sm leading-8 text-slate-600">
                  <p>
                    A op\u00e7\u00e3o identificada \u00e9 voltada para os casos em que o relator se disponibiliza a ser contatado para esclarecimento
                    de poss\u00edveis d\u00favidas sobre o relato fornecido.
                  </p>
                  <p>
                    Relatos com identifica\u00e7\u00e3o s\u00e3o muito importantes, pois podem tornar a apura\u00e7\u00e3o mais efetiva. Este \u00e9 um canal
                    seguro e confi\u00e1vel.
                  </p>
                  <p className="font-semibold text-slate-900">Voc\u00ea quer se identificar?</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => setReportIdentityChoice("identified")}
                    className={`min-w-28 rounded-2xl px-8 py-4 text-base font-semibold transition ${
                      reportIdentityChoice === "identified"
                        ? "bg-[#635bff] text-white shadow-[0_12px_30px_-18px_rgba(99,91,255,0.8)]"
                        : "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportIdentityChoice("anonymous")}
                    className={`min-w-28 rounded-2xl px-8 py-4 text-base font-semibold transition ${
                      reportIdentityChoice === "anonymous"
                        ? "bg-[#635bff] text-white shadow-[0_12px_30px_-18px_rgba(99,91,255,0.8)]"
                        : "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
                    }`}
                  >
                    N\u00e3o
                  </button>
                </div>

                {reportIdentityChoice === "identified" ? (
                  <div className="mt-8 space-y-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Nome</span>
                      <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Fun\u00e7\u00e3o ou sua rela\u00e7\u00e3o com a empresa</span>
                      <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    </label>
                    <p className="text-sm font-medium text-orange-600">\u00c9 necess\u00e1rio preencher pelo menos um dos campos abaixo:</p>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* E-mail</span>
                      <input
                        type="email"
                        placeholder="nome@exemplo.com"
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Telefone</span>
                      <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Celular</span>
                      <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Voc\u00ea j\u00e1 denunciou esta situa\u00e7\u00e3o anteriormente?</span>
                      <input className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none" />
                    </label>
                    <div className="pt-2">
                      <ActionLink href={reportHref} primary>
                        Continuar
                      </ActionLink>
                    </div>
                  </div>
                ) : null}

                {reportIdentityChoice === "anonymous" ? (
                  <div className="mt-8 space-y-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">E-mail an\u00f4nimo opcional</span>
                      <input
                        type="email"
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <p className="text-sm text-slate-700">
                      *Se seu relato for an\u00f4nimo, utilize endere\u00e7o de e-mail que n\u00e3o permita a sua identifica\u00e7\u00e3o
                      (ex.: anonimo123@gmail.com).
                    </p>
                    <div className="pt-2">
                      <ActionLink href={reportHref} primary>
                        Continuar
                      </ActionLink>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "follow-up" ? (
          <section className="rounded-[34px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-5xl font-semibold tracking-tight text-[#635bff]">Acompanhar relato</h2>
            <p className="mt-10 max-w-5xl text-[1.05rem] leading-8 text-slate-800">
              Para acompanhar o andamento do seu relato, por favor digite o n\u00famero do seu protocolo no campo abaixo e clique no bot\u00e3o
              &quot;Consultar protocolo&quot;.
            </p>

            <div className="mt-10 max-w-md">
              <input
                value={followUpProtocol}
                onChange={(event) => setFollowUpProtocol(event.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-[#635bff]"
              />
            </div>

            <div className="mt-10 flex flex-wrap gap-6">
              <a
                href={followUpHref !== "#" ? `${followUpHref}${followUpHref.includes("?") ? "&" : "?"}protocolo=${encodeURIComponent(followUpProtocol)}` : "#"}
                className="inline-flex min-w-64 items-center justify-center rounded-3xl bg-[#635bff] px-8 py-4 text-lg font-semibold text-white shadow-[0_12px_30px_-18px_rgba(99,91,255,0.75)] transition hover:bg-[#5148f5]"
              >
                Consultar protocolo
              </a>
              <Link
                href={tabHref(config.key, "home")}
                className="inline-flex min-w-40 items-center justify-center rounded-3xl bg-[#635bff] px-8 py-4 text-lg font-semibold text-white shadow-[0_12px_30px_-18px_rgba(99,91,255,0.75)] transition hover:bg-[#5148f5]"
              >
                Cancelar
              </Link>
            </div>
          </section>
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
