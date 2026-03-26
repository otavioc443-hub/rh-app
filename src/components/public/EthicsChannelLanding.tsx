"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { EthicsChannelConfig } from "@/lib/ethicsChannel";
import type { EthicsManagedContent } from "@/lib/ethicsChannelDefaults";
import type { PublicEthicsCaseFollowUpResult } from "@/lib/ethicsCases/types";

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function innerHeroContent(activeTab: Exclude<TabKey, "home">, content: EthicsManagedContent) {
  if (activeTab === "report") {
    return {
      title: content.pageTexts.reportHeroTitle ?? "Registre um relato com clareza e segurança.",
      body:
        content.pageTexts.reportHeroBody ??
        "Use este espaço para comunicar situações que contrariem a ética, a integridade, as políticas internas ou a legislação aplicável.",
      asideTitle: content.pageTexts.reportHeroAsideTitle ?? "Diretriz principal",
      asideBody: content.pageTexts.reportHeroAsideBody ?? "Descreva o fato com objetividade, contexto e evidências sempre que possível.",
    };
  }
  if (activeTab === "follow-up") {
    return {
      title: content.pageTexts.followUpHeroTitle ?? "Acompanhe um relato já registrado.",
      body:
        content.pageTexts.followUpHeroBody ??
        "Consulte o andamento de um caso aberto utilizando o fluxo de acompanhamento disponibilizado pela empresa.",
      asideTitle: content.pageTexts.followUpHeroAsideTitle ?? "Diretriz principal",
      asideBody: content.pageTexts.followUpHeroAsideBody ?? "Use o acompanhamento apenas para consultas relacionadas a um protocolo existente.",
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

const guarantees = [
  "Tratamento confidencial do relato e das evidências.",
  "Triagem com critério, registro formal e restrição de acesso.",
  "Não tolerância à retaliação contra relatos feitos de boa-fé.",
  "Encaminhamento para apuração com rastreabilidade e imparcialidade.",
];

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
  const [reportConsentChecked, setReportConsentChecked] = useState(false);
  const [reportStep, setReportStep] = useState<"intro" | "identity" | "incident">("intro");
  const [reportIdentityChoice, setReportIdentityChoice] = useState<"identified" | "anonymous" | null>(null);
  const [followUpProtocol, setFollowUpProtocol] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [incidentFiles, setIncidentFiles] = useState<File[]>([]);
  const [reporterName, setReporterName] = useState("");
  const [reporterRole, setReporterRole] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [reporterMobile, setReporterMobile] = useState("");
  const [previouslyReported, setPreviouslyReported] = useState("");
  const [incidentCategory, setIncidentCategory] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const [reportSubmitLoading, setReportSubmitLoading] = useState(false);
  const [submittedProtocol, setSubmittedProtocol] = useState<string | null>(null);
  const [reportReceiptOpen, setReportReceiptOpen] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpResult, setFollowUpResult] = useState<PublicEthicsCaseFollowUpResult | null>(null);
  const isSolida = config.companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes("solida");
  const accent = isSolida ? "#99A41A" : "#1E3A8A";
  const accentSoft = isSolida ? "#2E3647" : "#0F172A";
  const codeTabHref = config.codeOfEthicsUrl;
  const steerCards = buildSteerCards(content.steerBody);
  const companyTabs = companies.map((item) => ({ ...item, href: `/canal-de-etica/${item.key}` }));

  async function handleSubmitReport() {
    if (!config.companyId) {
      setReportSubmitError("Empresa do canal nao identificada.");
      return;
    }

    if (!incidentCategory || !incidentLocation.trim() || !incidentDescription.trim()) {
      setReportSubmitError("Preencha tipo do relato, local do ocorrido e descricao.");
      return;
    }

    if (reportIdentityChoice === "identified" && (!reporterName.trim() || !reporterRole.trim() || !reporterEmail.trim())) {
      setReportSubmitError("Preencha nome, funcao/relacao com a empresa e e-mail para o relato identificado.");
      return;
    }

    setReportSubmitError(null);
    setReportSubmitLoading(true);

    try {
      const response = await fetch("/api/public/ethics/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: config.companyId,
          isAnonymous: reportIdentityChoice !== "identified",
          reporterName,
          reporterEmail,
          reporterRole,
          reporterPhone,
          reporterMobile,
          previouslyReported,
          category: incidentCategory,
          location: incidentLocation,
          description: incidentDescription,
        }),
      });

      const payload = (await response.json()) as { item?: { protocol: string }; error?: string };
      if (!response.ok || !payload.item) {
        throw new Error(payload.error ?? "Falha ao registrar o relato.");
      }

      setSubmittedProtocol(payload.item.protocol);
      setFollowUpProtocol(payload.item.protocol);
      setReportReceiptOpen(true);
    } catch (error) {
      setReportSubmitError(error instanceof Error ? error.message : "Falha ao registrar o relato.");
    } finally {
      setReportSubmitLoading(false);
    }
  }

  async function handleFollowUpSearch() {
    if (!config.companyId || !followUpProtocol.trim()) {
      setFollowUpError("Informe o protocolo para continuar.");
      setFollowUpResult(null);
      return;
    }

    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      const response = await fetch(
        `/api/public/ethics/follow-up?companyId=${encodeURIComponent(config.companyId)}&protocol=${encodeURIComponent(followUpProtocol.trim())}`,
      );
      const payload = (await response.json()) as { item?: PublicEthicsCaseFollowUpResult; error?: string };
      if (!response.ok || !payload.item) {
        throw new Error(payload.error ?? "Falha ao consultar o protocolo.");
      }

      setFollowUpResult(payload.item);
    } catch (error) {
      setFollowUpResult(null);
      setFollowUpError(error instanceof Error ? error.message : "Falha ao consultar o protocolo.");
    } finally {
      setFollowUpLoading(false);
    }
  }

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
              <span className="block text-sm text-slate-500">Canal de Ética e Integridade</span>
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

      {activeTab === "home" ? <HomeHero config={config} content={content} /> : null}

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
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Orientações do canal</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{content.pageTexts.homeGuidanceTitle}</h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-slate-600">
                {content.pageTexts.homeGuidanceParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="space-y-6">
            {reportStep === "intro" ? (
              <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-4xl font-semibold tracking-tight text-slate-950">{content.pageTexts.reportIntroTitle}</h2>
                <div className="mt-7 space-y-5 text-[0.98rem] leading-7 text-slate-800 [text-align:justify]">
                  {content.pageTexts.reportIntroParagraphs.map((paragraph, index) =>
                    paragraph.toLowerCase() === "proteção de dados" ? (
                      <h3 key={`${paragraph}-${index}`} className="text-2xl font-semibold tracking-tight text-slate-950">
                        {paragraph}
                      </h3>
                    ) : (
                      <p key={`${paragraph}-${index}`}>{paragraph}</p>
                    ),
                  )}
                </div>
                <label className="mt-7 flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <input
                    type="checkbox"
                    checked={reportConsentChecked}
                    onChange={(event) => setReportConsentChecked(event.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300"
                  />
                  <span className="text-base font-semibold text-slate-950">
                    {content.pageTexts.reportConsentLabel || "Declaro que li e compreendi as informações acima, e desejo prosseguir com a manifestação."}
                  </span>
                </label>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!reportConsentChecked}
                    onClick={() => {
                      setReportStep("identity");
                      setReportIdentityChoice(null);
                    }}
                    className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition ${
                      reportConsentChecked
                        ? "bg-slate-950 text-white hover:bg-slate-800"
                        : "cursor-not-allowed bg-slate-200 text-slate-500"
                    }`}
                  >
                    Continuar
                  </button>
                </div>
              </article>
            ) : null}
            {reportStep === "identity" ? (
              <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-4xl font-semibold tracking-tight text-slate-950">{content.pageTexts.reportIdentityTitle}</h2>
                <div className="mt-7 space-y-5 text-[0.98rem] leading-7 text-slate-900 [text-align:justify]">
                  {content.pageTexts.reportIdentityParagraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <p className="font-semibold">{content.pageTexts.reportIdentityQuestion}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setReportIdentityChoice("identified");
                      setReportSubmitError(null);
                    }}
                    className={`min-w-28 rounded-2xl px-8 py-4 text-base font-semibold transition ${
                      reportIdentityChoice === "identified"
                        ? "text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]"
                        : "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
                    }`}
                    style={reportIdentityChoice === "identified" ? { backgroundColor: "var(--ethics-accent)" } : undefined}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportIdentityChoice("anonymous");
                      setReportSubmitError(null);
                    }}
                    className={`min-w-28 rounded-2xl px-8 py-4 text-base font-semibold transition ${
                      reportIdentityChoice === "anonymous"
                        ? "text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]"
                        : "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50"
                    }`}
                    style={reportIdentityChoice === "anonymous" ? { backgroundColor: "var(--ethics-accent)" } : undefined}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportStep("intro");
                      setReportIdentityChoice(null);
                    }}
                    className="min-w-28 rounded-2xl border border-slate-200 bg-white px-8 py-4 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                  >
                    Voltar
                  </button>
                </div>

                {reportIdentityChoice === "identified" ? (
                  <div className="mt-6 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Nome</span>
                      <input
                        value={reporterName}
                        onChange={(event) => setReporterName(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Função ou sua relação com a empresa</span>
                      <input
                        value={reporterRole}
                        onChange={(event) => setReporterRole(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <p className="text-sm font-medium text-orange-600">É necessário preencher pelo menos um dos campos abaixo:</p>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* E-mail</span>
                      <input
                        type="email"
                        placeholder="nome@exemplo.com"
                        value={reporterEmail}
                        onChange={(event) => setReporterEmail(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Telefone</span>
                      <input
                        value={reporterPhone}
                        onChange={(event) => setReporterPhone(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Celular</span>
                      <input
                        value={reporterMobile}
                        onChange={(event) => setReporterMobile(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">* Você já denunciou esta situação anteriormente?</span>
                      <input
                        value={previouslyReported}
                        onChange={(event) => setPreviouslyReported(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setReportStep("incident")}
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                ) : null}

                {reportIdentityChoice === "anonymous" ? (
                  <div className="mt-6 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-900">E-mail anônimo opcional</span>
                      <input
                        type="email"
                        value={reporterEmail}
                        onChange={(event) => setReporterEmail(event.target.value)}
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <p className="text-sm text-slate-700">
                      *Se seu relato for anônimo, utilize endereço de e-mail que não permita a sua identificação
                      (ex.: anonimo123@gmail.com).
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setReportStep("incident")}
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {reportStep === "incident" ? (
              <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-4xl font-semibold tracking-tight text-slate-950">{content.pageTexts.reportIncidentTitle}</h2>
                <div className="mt-7 space-y-4 text-[0.98rem] leading-7 text-slate-800 [text-align:justify]">
                  <p>{content.pageTexts.reportIncidentParagraphs[0]}</p>
                  <ul className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-700">
                    {content.pageTexts.reportIncidentParagraphs.slice(1, 8).map((paragraph) => (
                      <li key={paragraph}>{paragraph}</li>
                    ))}
                  </ul>
                  {content.pageTexts.reportIncidentParagraphs.slice(8).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                <div className="mt-8 space-y-5">
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Dados do incidente</h3>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-900">* Tipo do relato</span>
                    <select
                      value={incidentCategory}
                      onChange={(event) => setIncidentCategory(event.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
                    >
                      <option value="">Selecione</option>
                      <option value="assedio">Assédio</option>
                      <option value="fraude">Fraude</option>
                      <option value="conduta">Conduta inadequada</option>
                      <option value="conflito">Conflito de interesses</option>
                      <option value="outro">Outro</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-900">* Local do ocorrido</span>
                    <input
                      value={incidentLocation}
                      onChange={(event) => setIncidentLocation(event.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-900">* Descrição</span>
                    <textarea
                      rows={8}
                      value={incidentDescription}
                      onChange={(event) => setIncidentDescription(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                    />
                  </label>
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5">
                    <p className="text-sm leading-6 text-slate-700">
                      Se você quiser anexar arquivos como fotos e documentos, adicione-os aqui. O tamanho máximo do conjunto de arquivos é de 100 MB.
                    </p>
                    <div className="mt-4">
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                        Anexar arquivo
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event) => setIncidentFiles(Array.from(event.target.files ?? []))}
                        />
                      </label>
                    </div>
                    {incidentFiles.length ? (
                      <ul className="mt-4 space-y-2 text-sm text-slate-600">
                        {incidentFiles.map((file) => (
                          <li key={`${file.name}-${file.size}`}>{file.name}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                {reportSubmitError ? <p className="mt-6 text-sm font-medium text-rose-600">{reportSubmitError}</p> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSubmitReport()}
                    disabled={reportSubmitLoading}
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {reportSubmitLoading ? "Gravando..." : "Gravar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportStep("identity")}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        ) : null}

        {activeTab === "follow-up" ? (
          <section className="rounded-[34px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-5xl font-semibold tracking-tight text-slate-950">{content.pageTexts.followUpTitle}</h2>
            <p className="mt-10 max-w-5xl text-[1.05rem] leading-8 text-slate-800">
              {content.pageTexts.followUpDescription}
            </p>

            <div className="mt-10 max-w-md">
              <input
                value={followUpProtocol}
                onChange={(event) => {
                  setFollowUpProtocol(event.target.value);
                  setFollowUpError(null);
                  setFollowUpResult(null);
                }}
                placeholder={content.pageTexts.followUpPlaceholder ?? undefined}
                className="h-12 w-full rounded-md border border-slate-300 px-4 text-base text-slate-900 outline-none"
                style={{ borderColor: followUpProtocol ? "var(--ethics-accent)" : undefined }}
              />
            </div>

            <div className="mt-10 flex flex-wrap gap-6">
              <button
                type="button"
                onClick={() => void handleFollowUpSearch()}
                disabled={followUpLoading}
                className="inline-flex min-w-64 items-center justify-center rounded-3xl px-8 py-4 text-lg font-semibold text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: "var(--ethics-accent)" }}
              >
                {followUpLoading ? "Consultando..." : "Consultar protocolo"}
              </button>
              <Link
                href={tabHref(config.key, "home")}
                className="inline-flex min-w-40 items-center justify-center rounded-3xl px-8 py-4 text-lg font-semibold text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)] transition hover:brightness-105"
                style={{ backgroundColor: "var(--ethics-accent)" }}
              >
                Cancelar
              </Link>
            </div>

            {followUpError ? <p className="mt-6 text-sm font-medium text-rose-600">{followUpError}</p> : null}
            {followUpResult ? (
              <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Protocolo</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{followUpResult.protocol}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{followUpResult.status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tipo</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{followUpResult.category}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Abertura</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(followUpResult.createdAt)}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Assunto</p>
                  <p className="mt-2 text-sm text-slate-700">{followUpResult.subject}</p>
                </div>

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Historico</p>
                  <div className="mt-3 space-y-3">
                    {followUpResult.history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{entry.status}</span>
                        <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "data" ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <article className="hidden rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: "var(--ethics-soft)" }}><ShieldCheck size={22} /></div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Proteção de dados</p>
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
                <div className="mt-6"><ActionLink href={config.dataProtectionUrl}>Ver política de proteção de dados<ArrowRight size={16} /></ActionLink></div>
              ) : null}
            </article>

            <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{content.pageTexts.dataFaqSubtitle}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{content.pageTexts.dataFaqTitle}</h2>
              <div className="mt-8 grid gap-4">
                {content.faqItems.map((item, index) => (
                  <article key={item.question} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                      className="flex w-full items-center gap-4 px-5 py-5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-slate-500 transition ${openFaqIndex === index ? "rotate-180" : ""}`}
                      />
                    </button>
                    {openFaqIndex === index ? (
                      <div className="border-t border-slate-200 px-5 pb-5 pt-4">
                        <p className="text-sm leading-7 text-slate-600">{item.answer}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </article>
          </div>
        ) : null}

        {false && activeTab === "code" ? (
          <div className="space-y-8">
            <SectionTitle
              kicker="C\u00f3digo de \u00c9tica"
              title={content.pageTexts.codeHeroTitle ?? "Princípios que orientam decisões, relacionamentos e condutas."}
              body={content.pageTexts.codeHeroBody ?? content.codeSummary ?? ""}
            />
            <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
              <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Compromissos do canal</p>
                <div className="mt-5 grid gap-3">{guarantees.map((item) => (<div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">{item}</div>))}</div>
              </article>
              <article className="rounded-[34px] border border-slate-200 bg-slate-950 p-7 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Documento oficial</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Consulte o c\u00f3digo completo da empresa.</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">O canal de \u00e9tica complementa, mas n\u00e3o substitui, as regras formais de conduta, integridade, preven\u00e7\u00e3o de conflitos, respeito \u00e0s pessoas e prote\u00e7\u00e3o das informa\u00e7\u00f5es.</p>
                {config.codeOfEthicsUrl ? (<div className="mt-6"><ActionLink href={config.codeOfEthicsUrl ?? "#"} primary>Abrir c\u00f3digo de \u00e9tica<ArrowRight size={16} /></ActionLink></div>) : null}
              </article>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="bg-[#030712] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">Encaminhamento ético</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-white lg:text-[2.15rem]">Se algo não parece correto, registre. O silêncio não protege a integridade.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={tabHref(config.key, "report")} className="inline-flex items-center justify-center rounded-full px-7 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-24px_rgba(153,164,26,0.95)] transition hover:brightness-105" style={{ backgroundColor: "var(--ethics-accent)" }} scroll>Registrar agora</Link>
            <Link href="/canal-de-etica" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-transparent px-7 py-4 text-base font-semibold text-white transition hover:border-white/25 hover:bg-white/5" scroll>Trocar empresa</Link>
          </div>
        </div>
      </footer>

      {reportReceiptOpen && submittedProtocol ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-7 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Relato encaminhado</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Seu relato foi enviado com sucesso.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              O comite responsavel recebeu a manifestacao e o acompanhamento pode ser feito com o protocolo abaixo.
            </p>

            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Protocolo</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-950">{submittedProtocol}</p>
            </div>

            <div className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tipo do relato</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{incidentCategory || "Nao informado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Local</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{incidentLocation || "Nao informado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Origem</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {reportIdentityChoice === "identified" ? "Relato identificado" : "Relato anonimo"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Contato informado</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{reporterEmail || "Nao informado"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resumo enviado</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{incidentDescription}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setReportReceiptOpen(false);
                  setReportStep("incident");
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Fechar
              </button>
              <Link
                href={tabHref(config.key, "follow-up")}
                onClick={() => setReportReceiptOpen(false)}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                style={{ backgroundColor: "var(--ethics-accent)" }}
                scroll
              >
                Acompanhar protocolo
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
