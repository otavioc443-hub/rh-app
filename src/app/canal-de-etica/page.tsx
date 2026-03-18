import EthicsChannelLanding from "@/components/public/EthicsChannelLanding";
import { getDefaultEthicsChannelConfig, getEthicsChannelConfigs } from "@/lib/ethicsChannel";

export const metadata = {
  title: "Canal de Etica",
  description: "Canal de etica e integridade para registro seguro de relatos.",
};

export default function CanalDeEticaPage() {
  const config = getDefaultEthicsChannelConfig();
  const companies = getEthicsChannelConfigs();

  return <EthicsChannelLanding config={config} companies={companies} />;
}
