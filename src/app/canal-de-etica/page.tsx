import { Search } from "lucide-react";
import { getEthicsChannelCompanies } from "@/lib/ethicsChannelServer";
import EthicsCompanySelector from "@/components/public/EthicsCompanySelector";

export const metadata = {
  title: "Canal de Ética",
  description: "Selecione a empresa para consultar o canal de ética correspondente.",
};

export default async function CanalDeEticaPage() {
  const companies = await getEthicsChannelCompanies();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#edf2f8_46%,#ffffff_100%)] text-slate-950">
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.10),_transparent_34%),linear-gradient(135deg,#ffffff_0%,#f7fafc_45%,#eef4ff_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-sm">
              <Search size={14} />
              Seleção de empresa
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Escolha a empresa para consultar o canal de ética.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              Selecione o estado e a empresa desejada para visualizar o canal correto. Quando não houver uma configuração
              dedicada, o portal pode direcionar para o canal corporativo padrão da organização.
            </p>
          </div>
        </div>
      </section>

      <EthicsCompanySelector companies={companies} />
    </main>
  );
}

