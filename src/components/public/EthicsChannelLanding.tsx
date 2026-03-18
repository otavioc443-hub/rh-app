import Link from "next/link";
import {
  ArrowRight,
  BadgeAlert,
  Building2,
  FileWarning,
  HeartHandshake,
  LockKeyhole,
  MessageSquareWarning,
  Phone,
  Scale,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import type { EthicsChannelConfig } from "@/lib/ethicsChannel";

const reportTopics = [
  {
    title: "Assedio e discriminacao",
    description: "Situacoes de assedio moral, assedio sexual, humilhacao, preconceito ou retaliacao.",
    icon: HeartHandshake,
  },
  {
    title: "Fraude e corrupcao",
    description: "Suborno, desvio de recursos, conflito de interesses, favorecimento indevido ou fraude documental.",
    icon: Scale,
  },
  {
    title: "Conduta inadequada",
    description: "Violacoes do codigo interno, abuso de autoridade, descumprimento de regras ou comportamento antietico.",
    icon: BadgeAlert,
  },
  {
    title: "Seguranca e dados",
    description: "Uso indevido de informacoes, vazamento de dados, falhas de controle ou risco relevante para pessoas e ativos.",
    icon: ShieldCheck,
  },
];

const guarantees = [
  "Recebimento de relatos com tratamento confidencial.",
  "Possibilidade de relato com preservacao de identidade, conforme o canal adotado pela empresa.",
  "Analise imparcial, com registro, triagem e encaminhamento para apuracao.",
  "Proibicao de retaliacao contra quem relatar de boa-fe.",
];

const flow = [
  {
    step: "1",
    title: "Registro do relato",
    body: "A pessoa relatora informa o ocorrido, data aproximada, envolvidos e, se houver, evidencias.",
  },
  {
    step: "2",
    title: "Triagem e classificacao",
    body: "O caso e qualificado por natureza, risco e urgencia, com definicao da frente responsavel pela apuracao.",
  },
  {
    step: "3",
    title: "Apuracao protegida",
    body: "As evidencias sao analisadas com restricao de acesso, preservacao de sigilo e documentacao da decisao.",
  },
  {
    step: "4",
    title: "Resposta e fechamento",
    body: "O caso recebe desfecho, medidas aplicaveis e possibilidade de acompanhamento quando o modelo de canal permitir.",
  },
];

const faq = [
  {
    question: "Quem pode utilizar o canal?",
    answer:
      "Colaboradores, liderancas, terceiros, parceiros, fornecedores e qualquer pessoa que precise relatar situacoes contrarias a etica, integridade ou conformidade.",
  },
  {
    question: "O canal aceita denuncia anonima?",
    answer:
      "A pagina foi preparada para trabalhar com canais que permitam preservacao de identidade. A forma exata depende do fluxo configurado pela empresa no link de registro.",
  },
  {
    question: "Que informacoes ajudam na apuracao?",
    answer:
      "Contexto do ocorrido, data aproximada, local, area envolvida, nomes, documentos, prints, e qualquer evidencia objetiva que facilite a analise.",
  },
  {
    question: "Posso acompanhar meu relato?",
    answer:
      "Sim, quando a empresa disponibilizar fluxo de acompanhamento por protocolo. O botao de acompanhamento desta pagina pode ser apontado para esse processo.",
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
    ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
    : "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50";
  const external = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
  if (external) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
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
  const reportHref = config.reportUrl || (config.contactEmail ? `mailto:${config.contactEmail}?subject=Canal%20de%20Etica` : "#contatos");
  const followUpHref = config.followUpUrl || "#como-funciona";
  const phoneHref = config.contactPhone ? `tel:${config.contactPhone}` : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f7fb_0%,#eef2f7_46%,#ffffff_100%)] text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.14),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#f7fafc_42%,#ecf3ff_100%)]">
        <div className="absolute left-[-120px] top-[-80px] h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute right-[-80px] top-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700 hover:text-slate-950">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                <Building2 size={20} />
              </span>
              <span>
                <span className="block text-base text-slate-950">Canal de Etica</span>
                <span className="block text-xs font-medium text-slate-500">{config.companyName}</span>
              </span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <ActionLink href={reportHref} primary>
                Fazer um relato
                <ArrowRight size={16} />
              </ActionLink>
              <ActionLink href={followUpHref}>Acompanhar protocolo</ActionLink>
            </div>
          </div>

          {companies.length > 1 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {companies.map((item) => (
                <Link
                  key={item.key}
                  href={`/canal-de-etica/${item.key}`}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    item.key === config.key
                      ? "bg-slate-950 text-white"
                      : "border border-slate-300 bg-white/90 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.companyName}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-sm">
                <LockKeyhole size={14} />
                Integridade, sigilo e confianca
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Um canal seguro para relatar condutas que nao combinam com a nossa empresa.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                Este espaco foi desenhado para apoiar relatos sobre assedio, fraude, discriminacao, conflito de interesses,
                corrupcao, desvio de conduta, violacoes de seguranca e outras situacoes que afetem a integridade do ambiente
                de trabalho e dos nossos relacionamentos.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ActionLink href={reportHref} primary>
                  Registrar relato
                  <MessageSquareWarning size={16} />
                </ActionLink>
                {config.contactEmail ? (
                  <ActionLink href={`mailto:${config.contactEmail}`}>
                    Falar com o canal responsavel
                  </ActionLink>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Compromisso</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">Nao toleramos retaliacao.</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Relatos feitos de boa-fe devem ser tratados com respeito, seriedade e protecao contra represalias.
                </p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.55)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Tratamento</p>
                <p className="mt-3 text-lg font-semibold">Recebimento confidencial e apuracao formal.</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Cada caso precisa ser registrado, classificado e encaminhado com criterio, rastreabilidade e acesso restrito.
                </p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Canais ativos</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">Relato, acompanhamento e contato direto</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {config.contactEmail ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{config.contactEmail}</span>
                    ) : null}
                    {config.contactPhone ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{config.contactPhone}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reportTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <article key={topic.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                  <Icon size={20} />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">{topic.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{topic.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="como-funciona" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Como funciona</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Um fluxo simples, protegido e orientado a apuracao.</h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {flow.map((item) => (
              <article key={item.step} className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <article className="rounded-[32px] border border-slate-200 bg-slate-950 p-7 text-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Garantias do canal</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Protecao para quem relata e seriedade na apuracao.</h2>
            <div className="mt-8 space-y-3">
              {guarantees.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article id="contatos" className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Canais da empresa</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Escolha a forma mais adequada para registrar o caso.</h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-950">Registrar relato</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Use este acesso para enviar um relato com contexto, envolvidos, documentos e evidencias.
                </p>
                <div className="mt-4">
                  <ActionLink href={reportHref} primary>
                    Abrir canal de relato
                    <ArrowRight size={16} />
                  </ActionLink>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-950">Acompanhar protocolo</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Quando o processo da empresa permitir, use o protocolo para consultar andamento e retorno.
                </p>
                <div className="mt-4">
                  <ActionLink href={followUpHref}>
                    Consultar andamento
                    <SearchCheck size={16} />
                  </ActionLink>
                </div>
              </div>

              {config.contactEmail ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-950">E-mail do canal</p>
                  <p className="mt-2 break-all text-sm leading-7 text-slate-600">{config.contactEmail}</p>
                  <div className="mt-4">
                    <ActionLink href={`mailto:${config.contactEmail}`}>
                      Falar por e-mail
                      <ArrowRight size={16} />
                    </ActionLink>
                  </div>
                </div>
              ) : null}

              {phoneHref ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-950">Contato telefonico</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{config.contactPhone}</p>
                  <div className="mt-4">
                    <ActionLink href={phoneHref}>
                      <Phone size={16} />
                      Ligar para o canal
                    </ActionLink>
                  </div>
                </div>
              ) : null}
            </div>

            {!config.reportUrl || !config.followUpUrl ? (
              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
                Para ativar o fluxo real da empresa, configure `NEXT_PUBLIC_ETHICS_CHANNELS_JSON` ou, no modo simples,
                `NEXT_PUBLIC_ETHICS_REPORT_URL`, `NEXT_PUBLIC_ETHICS_FOLLOWUP_URL`,
                `NEXT_PUBLIC_ETHICS_CONTACT_EMAIL`, `NEXT_PUBLIC_ETHICS_CONTACT_PHONE` e
                `NEXT_PUBLIC_ETHICS_COMPANY_NAME`.
              </div>
            ) : null}
          </article>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Perguntas frequentes</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">O que normalmente gera mais duvida antes de relatar.</h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faq.map((item) => (
              <article key={item.question} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
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
        </div>
      </section>
    </main>
  );
}
