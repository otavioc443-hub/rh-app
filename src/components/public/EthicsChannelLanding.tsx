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
  if (tab === "home") return "Pagina Inicial";
  if (tab === "report") return "Realizar relato";
  if (tab === "follow-up") return "Acompanhar relato";
  if (tab === "data") return "Protecao de Dados";
  return "Codigo de Etica";
}

function innerHeroContent(activeTab: Exclude<TabKey, "home">, content: EthicsManagedContent) {
  if (activeTab === "report") {
    return {
      title: "Registre um relato com clareza e seguranca.",
      body:
        "Use este espaco para comunicar situacoes que contrariem a etica, a integridade, as politicas internas ou a legislacao aplicavel.",
      asideTitle: "Diretriz principal",
      asideBody: "Descreva o fato com objetividade, contexto e evidencias sempre que possivel.",
    };
  }
  if (activeTab === "follow-up") {
    return {
      title: "Acompanhe um relato ja registrado.",
      body:
        "Consulte o andamento de um caso aberto utilizando o fluxo de acompanhamento disponibilizado pela empresa.",
      asideTitle: "Diretriz principal",
      asideBody: "Use o acompanhamento apenas para consultas relacionadas a um protocolo existente.",
    };
  }
  if (activeTab === "data") {
    return {
      title: "Protecao de dados e tratamento reservado.",
      body:
        content.dataProtectionSummary ||
        "As informacoes tratadas neste canal devem seguir criterios de sigilo, acesso restrito e necessidade de conhecimento.",
      asideTitle: "Diretriz principal",
      asideBody: "Dados pessoais e evidencias devem ser usados apenas para triagem, apuracao e tratamento do caso.",
    };
  }
  return {
    title: "Consulte os principios do Codigo de Etica.",
    body:
      content.codeSummary ||
      "Os principios eticos orientam condutas, decisoes e relacoes internas e externas da empresa.",
    asideTitle: "Diretriz principal",
    asideBody: "O canal complementa o codigo, mas nao substitui as regras formais de conduta e integridade.",
  };
}

const reportTopics = [
  {
    title: "Assédio e discriminação",
    description:
      "Assédio moral, assédio sexual, humilhação, preconceito, retaliação ou condutas que comprometam a dignidade.",
    icon: HeartHandshake,
  },
  {
    title: "Fraude e corrupção",
    description:
      "Suborno, fraude documental, desvio de recursos, conflito de interesses ou favorecimento indevido.",
    icon: Scale,
  },
  {
    title: "Conduta inadequada",
    description:
      "Violações do código de ética, abuso de autoridade, quebra de regras internas ou comportamento antiético.",
    icon: BadgeAlert,
  },
  {
    title: "Segurança e dados",
    description:
      "Vazamento de informações, falhas de controle, acesso indevido ou risco relevante para pessoas e ativos.",
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
    <Link href={href} className={className} style={style} scroll>
      {children}
    </Link>
  );
}

function TabButton({ active, children }: { active: boolean; children: React.ReactNode }) {
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

function HomeHero({
  config,
  content,
}: {
  config: EthicsChannelConfig;
  content: EthicsManagedContent;
}) {
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
          alt={isSolida ? "Atuação da Sólida em projetos de energia renovável" : `Equipe da ${config.companyName}`}
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

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sigilo</p>
              <p className="mt-3 text-base font-semibold text-slate-950">Recebimento reservado</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Informações e evidências devem circular com acesso restrito.
              </p>
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
  const reportHref = config.reportUrl || (config.contactEmail ? `mailto:${config.contactEmail}?subject=Canal%20de%20Ética` : "#");
  const followUpHref = config.followUpUrl || "#";
  const companyTabs = companies.map((item) => ({ ...item, href: `/canal-de-etica/${item.key}` }));

  return (
    <main
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#ffffff_100%)] text-slate-950"
      style={{ "--ethics-accent": accent, "--ethics-soft": accentSoft } as React.CSSProperties}
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
            <Link href={tabHref(config.key, "home")} scroll>
              <TabButton active={activeTab === "home"}>{tabLabel("home")}</TabButton>
            </Link>
            <Link href={tabHref(config.key, "report")} scroll>
              <TabButton active={activeTab === "report"}>{tabLabel("report")}</TabButton>
            </Link>
            <Link href={tabHref(config.key, "follow-up")} scroll>
              <TabButton active={activeTab === "follow-up"}>{tabLabel("follow-up")}</TabButton>
            </Link>
            <Link href={tabHref(config.key, "data")} scroll>
              <TabButton active={activeTab === "data"}>{tabLabel("data")}</TabButton>
            </Link>
            <Link href={tabHref(config.key, "code")} scroll>
              <TabButton active={activeTab === "code"}>{tabLabel("code")}</TabButton>
            </Link>
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
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  item.key === config.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                scroll
              >
                {item.companyName}
              </Link>
            ))}
          </div>
        ) : null}

        {activeTab === "home" ? (
          <div className="space-y-10">
            <SectionTitle
              kicker="Mensagem central"
              title="Canal exclusivo para preservar ética, respeito e confiança."
              body={content.codeSummary ?? ""}
            />

            {content.foundationTitle ? (
              <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-7 py-7 lg:px-8">
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
            <SectionTitle
              kicker="Realizar relato"
              title="Escolha a forma mais adequada para registrar o caso."
              body="Use este canal para comunicar situações que contrariem o Código de Ética, as políticas internas, a legislação ou a integridade do ambiente de trabalho."
            />
            <div className="flex flex-wrap gap-3">
              <ActionLink href={reportHref} primary>
                Abrir canal de relato
                <ArrowRight size={16} />
              </ActionLink>
              {config.contactEmail ? <ActionLink href={`mailto:${config.contactEmail}`}>Falar por e-mail</ActionLink> : null}
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr,0.9fr]">
              <div className="grid gap-4 md:grid-cols-2">
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
              <div className="rounded-[34px] border border-slate-200 bg-slate-950 p-7 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Antes de enviar</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">Prepare um relato claro, verificável e útil para apuração.</h3>
                <div className="mt-6 space-y-3">
                  {[
                    "Descreva objetivamente o fato, sem suposições desnecessárias.",
                    "Informe data aproximada, local, área e pessoas envolvidas.",
                    "Anexe documentos, prints ou evidências quando existirem.",
                    "Se houver risco imediato à segurança, use também o canal emergencial da empresa.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "follow-up" ? (
          <div className="space-y-8">
            <SectionTitle
              kicker="Acompanhar relato"
              title="Uma jornada clara para receber, analisar e tratar cada caso."
              body="O objetivo do canal não é apenas receber relatos, mas garantir tratamento estruturado, documentado e coerente com a gravidade de cada situação."
              dark
            />
            <div className="flex flex-wrap gap-3">
              <ActionLink href={followUpHref} primary>
                Consultar andamento
                <SearchCheck size={16} />
              </ActionLink>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr,0.9fr]">
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
              <div className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">O que ter em mãos</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Facilite a consulta do protocolo.</h3>
                <div className="mt-6 space-y-3">
                  {[
                    "Tenha em mãos o número de protocolo ou identificador do atendimento.",
                    "Mantenha atualizados os meios de contato informados no registro.",
                    "Use o acompanhamento apenas para consultas ligadas ao caso já aberto.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                      {item}
                    </div>
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
              <div className="mt-6 space-y-3">
                {[
                  "Acesso limitado a pessoas autorizadas e com necessidade de conhecimento.",
                  "Uso exclusivo das informações para triagem, investigação e tratamento do caso.",
                  "Preservação de evidências e proteção de dados pessoais durante toda a apuração.",
                ].map((item) => (
                  <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
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
          <div className="space-y-8">
            <SectionTitle
              kicker="Código de Ética"
              title="Princípios que orientam decisões, relacionamentos e condutas."
              body={content.codeSummary ?? ""}
            />
            <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
              <article className="rounded-[34px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Compromissos do canal</p>
                <div className="mt-5 grid gap-3">
                  {guarantees.map((item) => (
                    <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[34px] border border-slate-200 bg-slate-950 p-7 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Documento oficial</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Consulte o código completo da empresa.</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  O canal de ética complementa, mas não substitui, as regras formais de conduta, integridade, prevenção
                  de conflitos, respeito às pessoas e proteção das informações.
                </p>
                {config.codeOfEthicsUrl ? (
                  <div className="mt-6">
                    <ActionLink href={config.codeOfEthicsUrl} primary>
                      Abrir código de ética
                      <ArrowRight size={16} />
                    </ActionLink>
                  </div>
                ) : null}
              </article>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="border-t border-slate-200 bg-white/96">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="font-semibold text-slate-900">{config.companyName}</p>
            <p className="mt-1">
              Canal de etica institucional com acesso a registro, acompanhamento e orientacoes de integridade.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {config.dataProtectionUrl ? (
              <Link href={config.dataProtectionUrl} className="font-semibold text-slate-700 hover:text-slate-950">
                Protecao de dados
              </Link>
            ) : null}
            {config.codeOfEthicsUrl ? (
              <Link href={config.codeOfEthicsUrl} className="font-semibold text-slate-700 hover:text-slate-950">
                Codigo de etica
              </Link>
            ) : null}
            <span className="text-slate-400">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
