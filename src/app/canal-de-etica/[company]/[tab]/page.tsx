import { notFound } from "next/navigation";
import EthicsChannelLanding from "@/components/public/EthicsChannelLanding";
import { getEthicsChannelPageData } from "@/lib/ethicsChannelServer";

const tabMap = {
  "realizar-relato": "report",
  "acompanhar-relato": "follow-up",
  "protecao-de-dados": "data",
  "codigo-de-etica": "code",
} as const;

type RouteTab = keyof typeof tabMap;

function getTabTitle(tab: RouteTab) {
  if (tab === "realizar-relato") return "Realizar Relato";
  if (tab === "acompanhar-relato") return "Acompanhar Relato";
  if (tab === "protecao-de-dados") return "Proteção de Dados";
  return "Código de Ética";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string; tab: string }>;
}) {
  const { company, tab } = await params;
  if (!(tab in tabMap)) {
    return {
      title: "Canal de Ética",
    };
  }

  const routeTab = tab as RouteTab;
  const { config } = await getEthicsChannelPageData(company);

  return {
    title: `${getTabTitle(routeTab)} - ${config.companyName}`,
    description: `${getTabTitle(routeTab)} no canal de ética e integridade de ${config.companyName}.`,
  };
}

export default async function CanalDeEticaCompanyTabPage({
  params,
}: {
  params: Promise<{ company: string; tab: string }>;
}) {
  const { company, tab } = await params;

  if (!(tab in tabMap)) {
    notFound();
  }

  const routeTab = tab as RouteTab;
  const { config, companies, content } = await getEthicsChannelPageData(company);

  return (
    <EthicsChannelLanding
      config={config}
      companies={companies}
      content={content}
      activeTab={tabMap[routeTab]}
    />
  );
}
