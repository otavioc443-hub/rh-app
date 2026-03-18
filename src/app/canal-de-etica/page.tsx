import Link from "next/link";
import { ArrowRight, Building2, CircleAlert, Search } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildEthicsChannelSlug, findEthicsChannelConfig } from "@/lib/ethicsChannel";

export const metadata = {
  title: "Canal de Etica",
  description: "Selecione a empresa para consultar o canal de etica correspondente.",
};

type CompanyRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
};

export default async function CanalDeEticaPage() {
  const { data } = await supabaseAdmin
    .from("companies")
    .select("id,name,logo_url,primary_color")
    .order("name", { ascending: true });

  const companies = ((data ?? []) as CompanyRow[]).map((company) => {
    const config = findEthicsChannelConfig(company.name) ?? findEthicsChannelConfig(company.id);
    return {
      ...company,
      slug: buildEthicsChannelSlug(config?.key ?? company.name),
      configured: Boolean(config),
    };
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#edf2f8_46%,#ffffff_100%)] text-slate-950">
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.10),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#f7fafc_45%,#eef4ff_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-sm">
              <Search size={14} />
              Selecao de empresa
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Escolha a empresa para consultar o canal de etica.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              Cada empresa pode ter fluxo, contatos e links proprios para relato e acompanhamento. Selecione abaixo a
              organizacao desejada para visualizar as informacoes corretas.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-12">
        {companies.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <article
                key={company.id}
                className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.4)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="grid h-14 w-14 place-items-center rounded-2xl text-white"
                      style={{ backgroundColor: company.primary_color?.trim() || "#0f172a" }}
                    >
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">{company.name}</h2>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {company.configured ? "Canal configurado" : "Configuracao pendente"}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-7 text-slate-600">
                  {company.configured
                    ? "Acesse o canal dedicado desta empresa para registrar relatos, acompanhar protocolos e consultar os contatos corretos."
                    : "Esta empresa ainda nao possui links especificos configurados para o canal de etica no ambiente atual."}
                </p>

                <div className="mt-6">
                  {company.configured ? (
                    <Link
                      href={`/canal-de-etica/${company.slug}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Abrir canal desta empresa
                      <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                      <CircleAlert size={16} />
                      Configurar canal desta empresa
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Nenhuma empresa cadastrada foi encontrada no portal.
          </div>
        )}
      </section>
    </main>
  );
}
