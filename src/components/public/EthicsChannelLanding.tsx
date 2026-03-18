"use client";

import { useMemo, useState } from "react";
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
import type { EthicsManagedContent } from "@/lib/ethicsChannelDefaults";

type TabKey = "home" | "report" | "follow-up" | "data" | "code";

const reportTopics = [
  {
    title: "Assédio e discriminação",
    description: "Assédio moral, assédio sexual, humilhação, preconceito, retaliação ou condutas que comprometam a dignidade.",
    icon: HeartHandshake,
  },
  {
    title: "Fraude e corrupção",
    description: "Suborno, fraude documental, desvio de recursos, conflito de interesses ou favorecimento indevido.",
    icon: Scale,
  },
  {
    title: "Conduta inadequada",
    description: "Violações do código de ética, abuso de autoridade, quebra de regras internas ou comportamento antiético.",
    icon: BadgeAlert,
  },
  {
    title: "Segurança e dados",
    description: "Vazamento de informações, falhas de controle, acesso indevido ou risco relevante para pessoas e ativos.",
    icon: ShieldCheck,
  },
];

const guarantees = [
  "Tratamento confidencial do relato e das evidências.",
  "Triagem com critério, registro formal e restrição de acesso.",
  "Não tolerância à retaliação contra relatos feitos de boa-fé.",
  "Encaminhamento para apuração com rastreabilidade e imparcialidade.",
];

const flow = [
  {
    step: "01",
    title: "Registro do relato",
    body: "Informe o contexto, a data aproximada, as pessoas envolvidas e, se houver, documentos ou evidências.",
  },
  {
    step: "02",
    title: "Triagem e classificação",
    body: "O caso é avaliado por natureza, gravidade, urgência e necessidade de investigação complementar.",
  },
  {
    step: "03",
    title: "Apuração protegida",
    body: "As evidências são analisadas com sigilo, acesso controlado e documentação das decisões do processo.",
  },
  {
    step: "04",
    title: "Desfecho",
    body: "O caso recebe tratamento, medidas cabíveis e, quando houver protocolo, possibilidade de acompanhamento.",
  },
];

const faq = [
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

export default function EthicsChannelLanding({
  config,
  companies,
  content,
}: {
  config: EthicsChannelConfig;
  companies: EthicsChannelConfig[];
  content: EthicsManagedContent;
}) {
  const isSolida = config.companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("solida");
  const accent = isSolida ? "#99A41A" : "#1E3A8A";
  const accentSoft = isSolida ? "#2E3647" : "#0F172A";
  const accentLight = isSolida ? "#EEF1D4" : "#E7EEFF";

  const reportHref = config.reportUrl || (config.contactEmail ? `mailto:${config.contactEmail}?subject=Canal%20de%20Ética` : "#");
  const followUpHref = config.followUpUrl || "#";
  const phoneHref = config.contactPhone ? `tel:${config.contactPhone}` : null;

  const [activeTab, setActiveTab] = useState<TabKey>("home");

  const companyTabs = useMemo(
    () =>
      companies.map((item) => ({
        ...item,
        href: `/canal-de-etica/${item.key}`,
      })),
    [companies],
  );

  return (
    <main
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_40%,#ffffff_100%)] text-slate-950"
      style={
        {
          "--ethics-accent": accent,
          "--ethics-soft": accentSoft,
          "--ethics-light": accentLight,
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
              <span className="block text-sm text-slate-500">Canal de Ética e Integridade</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <TabButton active={activeTab === "home"} onClick={() => setActiveTab("home")}>
              Página Inicial
            </TabButton>
            <TabButton active={activeTab === "report"} onClick={() => setActiveTab("report")}>
              Realizar relato
            </TabButton>
            <TabButton active={activeTab === "follow-up"} onClick={() => setActiveTab("follow-up")}>
              Acompanhar relato
            </TabButton>
            <TabButton active={activeTab === "data"} onClick={() => setActiveTab("data")}>
              Proteção de Dados
            </TabButton>
            <TabButton active={activeTab === "code"} onClick={() => setActiveTab("code")}>
              Código de Ética
            </TabButton>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
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
          {companyTabs.length > 1 ? (
            <div className="mb-8 flex flex-wrap gap-2">
              {companyTabs.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
                <Image
                  src={content.heroImageUrl || config.heroImageUrl || "/bg-login.jpg"}
                  alt={isSolida ? "Atuação da Sólida em projetos de energia renovável" : `Equipe da ${config.companyName}`}
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.34)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                  <div className="max-w-md rounded-[28px] border border-white/15 bg-slate-950/58 p-5 text-white backdrop-blur-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Compromisso</p>
                    <p className="mt-3 text-2xl font-semibold leading-tight">{content.heading}</p>
                    <p className="mt-3 text-sm leading-7 text-white/80">{content.intro}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[40px] border border-slate-200 bg-white px-7 py-8 shadow-[0_36px_100px_-60px_rgba(15,23,42,0.8)] lg:px-10 lg:py-10">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white"
                style={{ backgroundColor: "var(--ethics-soft)" }}
              >
                <LockKeyhole size={14} />
                Canal seguro e confidencial
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">{content.heroTitle}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-9 text-slate-600">{content.heroSubtitle}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:translate-y-[-1px]"
                  style={{ backgroundColor: "var(--ethics-accent)" }}
                >
                  Realizar relato
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("follow-up")}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Acompanhar relato
                  <SearchCheck size={16} />
                </button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sigilo</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">Recebimento reservado</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Informações e evidências devem circular com acesso restrito.</p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Integridade</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">Análise imparcial</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Cada caso precisa ser triado, registrado e tratado com critério.</p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Proteção</p>
                  <p className="mt-3 text-base font-semibold text-slate-950">Sem retaliação</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">Relatos de boa-fé devem ser acolhidos com seriedade e proteção.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        {activeTab === "home" ? (
          <div className="space-y-10">
            <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Mensagem central</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Canal exclusivo para preservar ética, respeito e confiança.</h2>
                  <p className="mt-4 text-base leading-8 text-slate-600">{content.codeSummary}</p>
                </div>
                <div className="grid gap-3">
                  {content.principles.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium leading-7 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {content.foundationTitle ? (
              <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
                <div
                  className="border-b border-slate-200 px-7 py-7 lg:px-8"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in srgb, var(--ethics-light) 82%, white 18%) 0%, #ffffff 100%)",
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Identidade institucional</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{content.foundationTitle}</h2>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{content.foundationSubtitle}</p>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1fr,320px]">
                  <div className="grid gap-0 md:grid-cols-3">
                    {content.foundationPillars.map((pillar, index) => (
                      <article
                        key={pillar.label}
                        className={`p-7 lg:p-8 ${index < content.foundationPillars.length - 1 ? "border-b border-slate-200 md:border-b-0 md:border-r" : ""}`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{pillar.label}</p>
                        <p className="mt-4 text-base leading-8 text-slate-700">{pillar.text}</p>
                      </article>
                    ))}
                  </div>

                  {content.steerTitle ? (
                    <aside className="border-t border-slate-200 bg-slate-950 p-7 text-white lg:border-l lg:border-t-0 lg:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Cultura</p>
                      <h3 className="mt-3 text-3xl font-semibold tracking-tight">{content.steerTitle}</h3>
                      <p className="mt-4 text-base leading-8 text-slate-300">{content.steerBody}</p>
                    </aside>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="space-y-8">
            <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Realizar relato</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Escolha a forma mais adequada para registrar o caso.</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
                Use este canal para comunicar situações que contrariem o Código de Ética, as políticas internas, a legislação ou a integridade do ambiente de trabalho.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink href={reportHref} primary>
                  Abrir canal de relato
                  <ArrowRight size={16} />
                </ActionLink>
                {config.contactEmail ? <ActionLink href={`mailto:${config.contactEmail}`}>Falar por e-mail</ActionLink> : null}
              </div>
            </div>

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
                    <h3 className="mt-5 text-lg font-semibold text-slate-950">{topic.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{topic.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === "follow-up" ? (
          <div className="space-y-8">
            <div className="rounded-[34px] border border-slate-200 bg-slate-950 p-7 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Acompanhar relato</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Uma jornada clara para receber, analisar e tratar cada caso.</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                O objetivo do canal não é apenas receber relatos, mas garantir tratamento estruturado, documentado e coerente com a gravidade de cada situação.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink href={followUpHref} primary>
                  Consultar andamento
                  <SearchCheck size={16} />
                </ActionLink>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {flow.map((item) => (
                <article key={item.step} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: "var(--ethics-accent)" }}
                  >
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "data" ? (
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
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Proteção de dados</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Sigilo e necessidade de conhecimento.</h2>
                </div>
              </div>
              <p className="mt-6 text-sm leading-8 text-slate-600">{content.dataProtectionSummary}</p>
              <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                Os dados do relato devem ser usados exclusivamente para triagem, investigação, medidas de tratamento e cumprimento de obrigações legais, sempre com proporcionalidade e controle de acesso.
              </div>
              {config.dataProtectionUrl ? (
                <div className="mt-6">
                  <ActionLink href={config.dataProtectionUrl}>
                    Ver política de proteção de dados
                    <ArrowRight size={16} />
                  </ActionLink>
                </div>
              ) : null}
            </article>

            <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Perguntas frequentes</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Dúvidas comuns antes de registrar um caso.</h2>
              <div className="mt-8 grid gap-4">
                {faq.map((item) => (
                  <article key={item.question} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
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
            </article>
          </div>
        ) : null}

        {activeTab === "code" ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <article className="rounded-[34px] border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#f8fafc_100%)] p-7 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: "var(--ethics-accent)" }}
                >
                  <FileCheck2 size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Código de ética</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Princípios que orientam a conduta esperada.</h2>
                </div>
              </div>
              <p className="mt-6 text-sm leading-8 text-slate-600">{content.codeSummary}</p>
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
                    Acessar código completo
                    <ArrowRight size={16} />
                  </ActionLink>
                </div>
              ) : null}
            </article>

            <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Canais disponíveis</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Acesse os pontos de contato do canal.</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold text-slate-950">Registrar relato</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">Use este acesso para detalhar o fato, anexar evidências e formalizar o caso.</p>
                  <div className="mt-5">
                    <ActionLink href={reportHref} primary>
                      Realizar relato
                      <ArrowRight size={16} />
                    </ActionLink>
                  </div>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold text-slate-950">Acompanhar protocolo</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">Quando houver protocolo, acompanhe a evolução do atendimento pelo canal indicado.</p>
                  <div className="mt-5">
                    <ActionLink href={followUpHref}>
                      Consultar andamento
                      <SearchCheck size={16} />
                    </ActionLink>
                  </div>
                </article>

                {config.contactEmail ? (
                  <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                    <p className="text-sm font-semibold text-slate-950">E-mail do canal</p>
                    <p className="mt-3 break-all text-sm leading-7 text-slate-600">{config.contactEmail}</p>
                    <div className="mt-5">
                      <ActionLink href={`mailto:${config.contactEmail}`}>Falar por e-mail</ActionLink>
                    </div>
                  </article>
                ) : null}

                {phoneHref ? (
                  <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                    <p className="text-sm font-semibold text-slate-950">Contato telefônico</p>
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
            </article>
          </div>
        ) : null}
      </section>

      <section className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Encaminhamento ético</p>
            <p className="mt-3 text-lg font-semibold">Se algo não parece correto, registre. O silêncio não protege a integridade.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionLink href={reportHref} primary>
              Registrar agora
              <Sparkles size={16} />
            </ActionLink>
            <Link
              href="/canal-de-etica"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
            >
              Trocar empresa
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
