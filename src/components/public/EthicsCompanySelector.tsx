"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, CircleAlert, Search } from "lucide-react";

type EthicsCompanyCard = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  slug: string;
  configured: boolean;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function EthicsCompanySelector({
  companies,
}: {
  companies: EthicsCompanyCard[];
}) {
  const [query, setQuery] = useState("");

  const filteredCompanies = useMemo(() => {
    const term = normalizeText(query);
    const base = [...companies].sort((a, b) => {
      if (a.configured !== b.configured) return a.configured ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    if (!term) return base;
    return base.filter((company) => normalizeText(company.name).includes(term));
  }, [companies, query]);

  const configuredCount = companies.filter((item) => item.configured).length;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-12">
      <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Empresas cadastradas</p>
          <p className="mt-2 text-sm text-slate-600">
            {configuredCount} canal(is) configurado(s) de {companies.length} empresa(s) cadastrada(s).
          </p>
        </div>

        <label className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 lg:max-w-sm">
          <Search size={16} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empresa"
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      {filteredCompanies.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCompanies.map((company) => (
            <article
              key={company.id}
              className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.4)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {company.logo_url ? (
                    <div
                      className="h-14 w-14 rounded-2xl border border-slate-200 bg-white bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url("${company.logo_url}")` }}
                      aria-label={`Logo da empresa ${company.name}`}
                    />
                  ) : (
                    <div
                      className="grid h-14 w-14 place-items-center rounded-2xl text-white"
                      style={{ backgroundColor: company.primary_color?.trim() || "#0f172a" }}
                    >
                      <Building2 size={22} />
                    </div>
                  )}
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
          Nenhuma empresa encontrada para a busca informada.
        </div>
      )}
    </section>
  );
}
