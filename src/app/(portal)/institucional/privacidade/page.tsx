import { FileCheck2, LockKeyhole, Mail, Phone, Scale, ShieldCheck, TimerReset, UserRoundSearch } from "lucide-react";
import { getPrivacyNoticeConfig } from "@/lib/privacyNotice";
import LgpdRequestCenter from "@/components/privacy/LgpdRequestCenter";

export const metadata = {
  title: "Privacidade e LGPD",
  description: "Aviso de privacidade e canal do titular do portal.",
};

const sections = [
  {
    title: "Dados tratados",
    icon: FileCheck2,
    items: [
      "Dados cadastrais e funcionais, como nome, e-mail corporativo, cargo, setor e historico interno.",
      "Dados operacionais do portal, como logs de sessao, acessos, notificacoes e interacoes em modulos internos.",
      "Dados adicionais de RH e projetos apenas quando necessarios para execucao de contrato, gestao interna, obrigacoes legais ou seguranca.",
    ],
  },
  {
    title: "Finalidades",
    icon: Scale,
    items: [
      "Permitir autenticacao, controle de acesso e funcionamento dos modulos do portal.",
      "Executar rotinas de RH, comunicacao interna, gestao de projetos, pagamentos e processos administrativos.",
      "Registrar trilhas de auditoria, prevenir fraudes, investigar incidentes e cumprir obrigacoes legais e regulatorias.",
    ],
  },
  {
    title: "Direitos do titular",
    icon: UserRoundSearch,
    items: [
      "Solicitar confirmacao de tratamento, acesso, correcao e revisao de dados desatualizados.",
      "Solicitar informacoes sobre compartilhamento, base legal aplicavel e criterio de retencao.",
      "Registrar pedidos de eliminacao, oposicao ou revisao, observadas as hipoteses legais de guarda e obrigacao regulatoria.",
    ],
  },
  {
    title: "Seguranca e retencao",
    icon: LockKeyhole,
    items: [
      "O portal adota autenticacao, segregacao de acesso por perfil e trilhas de auditoria para proteger informacoes.",
      "Os dados sao mantidos pelo periodo necessario para a finalidade, requisitos contratuais, auditoria e obrigacoes legais.",
      "Quando o tratamento deixa de ser necessario, os dados devem seguir politica interna de descarte, anonimização ou bloqueio.",
    ],
  },
];

export default function PrivacidadePage() {
  const config = getPrivacyNoticeConfig();
  const hasEmail = Boolean(config.contactEmail);
  const hasPhone = Boolean(config.contactPhone);
  const hasRequestUrl = Boolean(config.requestUrl);
  const hasFullContactConfig = hasEmail && hasPhone && hasRequestUrl;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-7 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
            <ShieldCheck size={14} />
            Privacidade e LGPD
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Aviso de privacidade do portal</h1>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            Esta pagina resume como o portal utiliza dados pessoais para operacao interna, seguranca, rotinas de RH,
            comunicacao corporativa e processos administrativos. O texto serve como camada de transparencia e deve ser
            complementado pela politica institucional da empresa e pelas bases legais definidas pelo controlador.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                  <p className="text-sm text-slate-500">Resumo objetivo para consulta rapida no portal.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <TimerReset size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Compartilhamento e governanca</h2>
              <p className="text-sm text-slate-500">Pontos que o portal precisa deixar claros para conformidade continua.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Compartilhamento interno</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Os dados podem ser acessados por areas autorizadas conforme perfil, necessidade operacional, auditoria e
                atribuicoes de gestao.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Operadores e fornecedores</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Servicos de infraestrutura, autenticacao, armazenamento e notificacao podem atuar como operadores, sob
                contrato e controles de seguranca aplicaveis.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Bases legais</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                As operacoes devem ser enquadradas, conforme o caso, em execucao contratual, cumprimento de obrigacao
                legal, exercicio regular de direitos, seguranca, tutela da saude e legitimo interesse validamente documentado.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Incidentes</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Incidentes de seguranca com risco relevante devem seguir rito interno de classificacao, resposta e eventual
                comunicacao ao controlador, ao encarregado e aos titulares afetados.
              </p>
            </div>
          </div>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Canal do titular</h2>
              <p className="text-sm text-slate-500">Use este bloco para centralizar atendimento e registrar demandas.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Responsavel</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{config.contactName}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">E-mail</p>
              <p className="mt-1 text-sm text-slate-900">{hasEmail ? config.contactEmail : "Definir NEXT_PUBLIC_LGPD_CONTACT_EMAIL"}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Telefone</p>
              <p className="mt-1 text-sm text-slate-900">{hasPhone ? config.contactPhone : "Opcional"}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {hasEmail ? (
              <a
                href={`mailto:${config.contactEmail}?subject=Solicitacao%20LGPD%20-%20Portal`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Mail size={16} />
                Enviar solicitacao por e-mail
              </a>
            ) : null}

            {hasRequestUrl ? (
              <a
                href={config.requestUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <UserRoundSearch size={16} />
                Abrir formulario de atendimento
              </a>
            ) : null}

            {hasPhone ? (
              <a
                href={`tel:${config.contactPhone}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Phone size={16} />
                Ligar para o canal responsavel
              </a>
            ) : null}
          </div>

          {!hasFullContactConfig ? (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Se os dados de contato ainda nao estiverem definidos, configure `NEXT_PUBLIC_LGPD_CONTACT_NAME`,
              `NEXT_PUBLIC_LGPD_CONTACT_EMAIL`, `NEXT_PUBLIC_LGPD_CONTACT_PHONE` e `NEXT_PUBLIC_LGPD_REQUEST_URL`.
            </p>
          ) : null}
        </aside>
      </section>

      <LgpdRequestCenter />
    </div>
  );
}
