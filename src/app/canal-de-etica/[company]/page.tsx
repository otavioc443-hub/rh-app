import EthicsChannelLanding from "@/components/public/EthicsChannelLanding";
import { getEthicsChannelConfig, getEthicsChannelConfigs } from "@/lib/ethicsChannel";

export async function generateMetadata({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const config = getEthicsChannelConfig(company);
  return {
    title: `Canal de Etica - ${config.companyName}`,
    description: `Canal de etica e integridade de ${config.companyName}.`,
  };
}

export default async function CanalDeEticaCompanyPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const config = getEthicsChannelConfig(company);
  const companies = getEthicsChannelConfigs();

  return <EthicsChannelLanding config={config} companies={companies} />;
}
