"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, Search } from "lucide-react";
import { useRouter } from "next/navigation";

type EthicsCompanyCard = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  cidade?: string | null;
  estado?: string | null;
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const stateOptions = useMemo(
    () =>
      Array.from(new Set(companies.map((item) => String(item.estado ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [companies]
  );

  const cityOptions = useMemo(() => {
    const scope = selectedState
      ? companies.filter((item) => String(item.estado ?? "").trim() === selectedState)
      : companies;
    return Array.from(new Set(scope.map((item) => String(item.cidade ?? "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [companies, selectedState]);

  const filteredCompanies = useMemo(() => {
    const term = normalizeText(query);
    return [...companies]
      .sort((a, b) => {
        if (a.configured !== b.configured) return a.configured ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      })
      .filter((company) => {
        const companyState = String(company.estado ?? "").trim();
        const companyCity = String(company.cidade ?? "").trim();
        if (selectedState && companyState !== selectedState) return false;
        if (selectedCity && companyCity !== selectedCity) return false;
        if (!term) return true;
        return [company.name, companyCity, companyState].some((value) => normalizeText(value).includes(term));
      });
  }, [companies, query, selectedCity, selectedState]);

  const directOptions = filteredCompanies
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-12">
      <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),220px,220px,220px]">
          <label className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empresa"
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>

          <select
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedCity("");
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">Escolha um estado</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">Escolha uma cidade</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            defaultValue=""
            onChange={(e) => {
              const next = e.target.value;
              if (!next) return;
              router.push(`/canal-de-etica/${next}`);
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
          >
            <option value="">Acesso rapido</option>
            {directOptions.map((company) => (
              <option key={company.id} value={company.slug}>
                {company.cidade ? `${company.name} - ${company.cidade}` : company.name}
              </option>
            ))}
          </select>
        </div>
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
                        {company.configured ? "Canal dedicado" : "Canal corporativo"}
                      </p>
                      {(company.cidade || company.estado) ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {[company.cidade, company.estado].filter(Boolean).join(" - ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

              <div
                className="mt-5 rounded-2xl px-4 py-3 text-sm leading-7"
                style={{
                  backgroundColor: company.configured ? `${company.primary_color?.trim() || "#0f172a"}12` : "#f8fafc",
                  color: "#475569",
                }}
              >
                {company.configured
                  ? "Acesse o canal dedicado desta empresa para registrar relatos, acompanhar protocolos e consultar os contatos corretos."
                  : "Esta empresa utilizará o canal corporativo padrao para registro e acompanhamento de relatos."}
              </div>

              <div className="mt-6">
                <Link
                  href={`/canal-de-etica/${company.slug}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Abrir canal desta empresa
                  <ArrowRight size={16} />
                </Link>
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
