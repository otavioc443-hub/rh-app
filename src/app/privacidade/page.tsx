import { FileCheck2, LockKeyhole, Mail, Phone, Scale, ShieldCheck, TimerReset, UserRoundSearch } from "lucide-react";
import { getPrivacyNoticeConfig } from "@/lib/privacyNotice";

export const metadata = {
  title: "Privacidade e LGPD",
  description: "Aviso público de privacidade e orientações sobre tratamento de dados.",
};

const sections = [
  {
    title: "Dados tratados",
    icon: FileCheck2,
    items: [
      "Dados cadastrais e funcionais, como nome, e-mail corporativo, cargo, setor e histórico interno.",
      "Dados operacionais do portal, como logs de sessão, acessos, notificações e interações em módulos internos.",
      "Dados adicionais de RH e projetos apenas quando necessários para execução de contrato, gestão interna, obrigações legais ou segurança.",
    ],
  },
  {
    title: "Finalidades",
    icon: Scale,
    items: [
      "Permitir autenticação, controle de acesso e funcionamento dos módulos do portal.",
      "Executar rotinas de RH, comunicação interna, gestão de projetos, pagamentos e processos administrativos.",
      "Registrar trilhas de auditoria, prevenir fraudes, investigar incidentes e cumprir obrigações legais e regulatórias.",
    ],
  },
  {
    title: "Direitos do titular",
    icon: UserRoundSearch,
    items: [
      "Solicitar confirmação de tratamento, acesso, correção e revisão de dados desatualizados.",
      "Solicitar informações sobre compartilhamento, base legal aplicável e critério de retenção.",
      "Registrar pedidos de eliminação, oposição ou revisão, observadas as hipóteses legais de guarda e obrigação regulatória.",
    ],
  },
  {
    title: "Segurança e retenção",
    icon: LockKeyhole,
    items: [
      "O portal adota autenticação, segregação de acesso por perfil e trilhas de auditoria para proteger informações.",
      "Os dados são mantidos pelo período necessário para a finalidade, requisitos contratuais, auditoria e obrigações legais.",
      "Quando o tratamento deixa de ser necessário, os dados devem seguir política interna de descarte, anonimização ou bloqueio.",
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#ffffff_100%)] px-6 py-10 text-slate-950 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-7 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
              <ShieldCheck size={14} />
              Privacidade e LGPD
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Aviso de privacidade do portal</h1>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Esta página resume como o portal utiliza dados pessoais para operação interna, segurança, rotinas de RH,
              comunicação corporativa e processos administrativos. O texto serve como camada de transparência e deve ser
              complementado pela política institucional da empresa e pelas bases legais definidas pelo controlador.
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
                    <p className="text-sm text-slate-500">Resumo objetivo para consulta rápida.</p>
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
                <h2 className="text-lg font-semibold text-slate-900">Compartilhamento e governança</h2>
                <p className="text-sm text-slate-500">Pontos que o portal precisa deixar claros para conformidade contínua.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Compartilhamento interno</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Os dados podem ser acessados por áreas autorizadas conforme perfil, necessidade operacional, auditoria e atribuições de gestão.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Operadores e fornecedores</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Serviços de infraestrutura, autenticação, armazenamento e notificação podem atuar como operadores, sob contrato e controles de segurança aplicáveis.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Bases legais</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  As operações devem ser enquadradas, conforme o caso, em execução contratual, cumprimento de obrigação legal, exercício regular de direitos, segurança, tutela da saúde e legítimo interesse validamente documentado.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">Incidentes</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Incidentes de segurança com risco relevante devem seguir rito interno de classificação, resposta e eventual comunicação ao controlador, ao encarregado e aos titulares afetados.
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
                <p className="text-sm text-slate-500">Use este bloco para localizar o contato responsável pela privacidade.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Responsável</p>
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
                  href={`mailto:${config.contactEmail}?subject=Solicitação%20LGPD%20-%20Portal`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Mail size={16} />
                  Enviar solicitação por e-mail
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
                  Abrir formulário de atendimento
                </a>
              ) : null}

              {hasPhone ? (
                <a
                  href={`tel:${config.contactPhone}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Phone size={16} />
                  Ligar para o canal responsável
                </a>
              ) : null}
            </div>

            {!hasFullContactConfig ? (
              <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Se os dados de contato ainda não estiverem definidos, configure `NEXT_PUBLIC_LGPD_CONTACT_NAME`,
                `NEXT_PUBLIC_LGPD_CONTACT_EMAIL`, `NEXT_PUBLIC_LGPD_CONTACT_PHONE` e `NEXT_PUBLIC_LGPD_REQUEST_URL`.
              </p>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
