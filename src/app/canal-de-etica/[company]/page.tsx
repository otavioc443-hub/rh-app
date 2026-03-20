import EthicsChannelLanding from "@/components/public/EthicsChannelLanding";
import { getEthicsChannelPageData } from "@/lib/ethicsChannelServer";

export async function generateMetadata({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const { config } = await getEthicsChannelPageData(company);
  return {
    title: `Canal de Ética - ${config.companyName}`,
    description: `Canal de ética e integridade de ${config.companyName}.`,
  };
}

export default async function CanalDeEticaCompanyPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const { config, companies, content } = await getEthicsChannelPageData(company);

  return <EthicsChannelLanding config={config} companies={companies} content={content} activeTab="home" />;
}

