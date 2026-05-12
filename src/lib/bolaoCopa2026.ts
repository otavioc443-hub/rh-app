export type BolaoPlayerPosition = "Goleiros" | "Defensores" | "Meio-campistas" | "Atacantes";

export type BolaoPlayer = {
  id: string;
  name: string;
  club: string;
  position: BolaoPlayerPosition;
};

export type BolaoConfig = {
  id: string;
  titulo: string | null;
  valor: number | null;
  regulamento: string | null;
  prazo: string | null;
  pix_link: string | null;
  qr_code_url: string | null;
  status: "ativo" | "encerrado" | string | null;
  updated_at?: string | null;
};

export type BolaoBet = {
  id: string;
  user_id: string;
  nome: string | null;
  email: string | null;
  jogadores: BolaoSelectedPlayer[];
  jogadores_manuais: BolaoManualPlayer[] | null;
  total_jogadores: number;
  status: string | null;
  created_at: string;
};

export type BolaoSelectedPlayer = {
  id: string;
  nome: string;
  clube: string;
  posicao: BolaoPlayerPosition;
  manual?: false;
};

export type BolaoManualPlayer = {
  id: string;
  nome: string;
  clube?: string;
  manual: true;
};

export const BOLAO_REQUIRED_PLAYERS = 26;
export const BOLAO_DEFAULT_TITLE = "Bolão Copa do Mundo 2026";
export const BOLAO_DEFAULT_DEADLINE = "2026-05-18T02:59:00.000Z"; // 17/05/2026 23:59 America/Fortaleza
export const BOLAO_DEFAULT_VALUE = 20;

export const BOLAO_RULES = [
  "Apenas quem acertar os 26 nomes convocados ganhará o prêmio, considerando o valor acumulado.",
  "Caso tenha mais de um ganhador, o prêmio será dividido igualmente entre eles.",
  "Caso não haja ganhadores, o valor será guardado para a Festa de São João 2026.",
  "Caso o apostador acredite que um jogador fora da lista será convocado, deverá ter a opção de incluir manualmente um nome.",
  "Caso o apostador não escolha exatamente 26 jogadores, estará desclassificado.",
  "O prazo final para envio da lista com os 26 nomes é 17/05/2026 às 23h59.",
];

export const BOLAO_DEFAULT_REGULATION = BOLAO_RULES.join("\n");

export const BOLAO_PLAYERS: BolaoPlayer[] = [
  { id: "goleiros-alisson-liverpool", name: "Alisson", club: "Liverpool", position: "Goleiros" },
  { id: "goleiros-ederson-fenerbahce", name: "Ederson", club: "Fenerbahçe", position: "Goleiros" },
  { id: "goleiros-bento-al-nassr", name: "Bento", club: "Al-Nassr", position: "Goleiros" },
  { id: "goleiros-hugo-souza-corinthians", name: "Hugo Souza", club: "Corinthians", position: "Goleiros" },
  { id: "goleiros-john-nottingham-forest", name: "John", club: "Nottingham Forest", position: "Goleiros" },
  { id: "goleiros-carlos-miguel-palmeiras", name: "Carlos Miguel", club: "Palmeiras", position: "Goleiros" },
  { id: "defensores-marquinhos-psg", name: "Marquinhos", club: "PSG", position: "Defensores" },
  { id: "defensores-thiago-silva-porto", name: "Thiago Silva", club: "Porto", position: "Defensores" },
  { id: "defensores-gabriel-magalhaes-arsenal", name: "Gabriel Magalhães", club: "Arsenal", position: "Defensores" },
  { id: "defensores-bremer-juventus", name: "Bremer", club: "Juventus", position: "Defensores" },
  { id: "defensores-leo-pereira-flamengo", name: "Léo Pereira", club: "Flamengo", position: "Defensores" },
  { id: "defensores-ibanez-al-ahli", name: "Ibañez", club: "Al-Ahli", position: "Defensores" },
  { id: "defensores-alexsandro-lille", name: "Alexsandro", club: "Lille", position: "Defensores" },
  { id: "defensores-fabricio-bruno-cruzeiro", name: "Fabrício Bruno", club: "Cruzeiro", position: "Defensores" },
  { id: "defensores-beraldo-psg", name: "Beraldo", club: "PSG", position: "Defensores" },
  { id: "defensores-murillo-nottingham-forest", name: "Murillo", club: "Nottingham Forest", position: "Defensores" },
  { id: "defensores-wesley-roma", name: "Wesley", club: "Roma", position: "Defensores" },
  { id: "defensores-danilo-flamengo", name: "Danilo", club: "Flamengo", position: "Defensores" },
  { id: "defensores-paulo-henrique-vasco", name: "Paulo Henrique", club: "Vasco", position: "Defensores" },
  { id: "defensores-vitinho-botafogo", name: "Vitinho", club: "Botafogo", position: "Defensores" },
  { id: "defensores-alex-sandro-flamengo", name: "Alex Sandro", club: "Flamengo", position: "Defensores" },
  { id: "defensores-douglas-santos-zenit", name: "Douglas Santos", club: "Zenit", position: "Defensores" },
  { id: "defensores-luciano-juba-bahia", name: "Luciano Juba", club: "Bahia", position: "Defensores" },
  { id: "defensores-caio-henrique-monaco", name: "Caio Henrique", club: "Monaco", position: "Defensores" },
  { id: "defensores-kaiki-cruzeiro", name: "Kaiki", club: "Cruzeiro", position: "Defensores" },
  { id: "defensores-carlos-augusto-internazionale", name: "Carlos Augusto", club: "Internazionale", position: "Defensores" },
  { id: "meio-campistas-casemiro-manchester-united", name: "Casemiro", club: "Manchester United", position: "Meio-campistas" },
  { id: "meio-campistas-bruno-guimaraes-newcastle", name: "Bruno Guimarães", club: "Newcastle", position: "Meio-campistas" },
  { id: "meio-campistas-fabinho-al-ittihad", name: "Fabinho", club: "Al-Ittihad", position: "Meio-campistas" },
  { id: "meio-campistas-andrey-santos-chelsea", name: "Andrey Santos", club: "Chelsea", position: "Meio-campistas" },
  { id: "meio-campistas-danilo-botafogo", name: "Danilo", club: "Botafogo", position: "Meio-campistas" },
  { id: "meio-campistas-lucas-paqueta-flamengo", name: "Lucas Paquetá", club: "Flamengo", position: "Meio-campistas" },
  { id: "meio-campistas-gabriel-sara-galatasaray", name: "Gabriel Sara", club: "Galatasaray", position: "Meio-campistas" },
  { id: "meio-campistas-joao-gomes-wolverhampton", name: "João Gomes", club: "Wolverhampton", position: "Meio-campistas" },
  { id: "meio-campistas-andreas-pereira-palmeiras", name: "Andreas Pereira", club: "Palmeiras", position: "Meio-campistas" },
  { id: "meio-campistas-joelinton-newcastle", name: "Joelinton", club: "Newcastle", position: "Meio-campistas" },
  { id: "meio-campistas-gerson-cruzeiro", name: "Gerson", club: "Cruzeiro", position: "Meio-campistas" },
  { id: "meio-campistas-matheus-pereira-cruzeiro", name: "Matheus Pereira", club: "Cruzeiro", position: "Meio-campistas" },
  { id: "atacantes-vini-jr-real-madrid", name: "Vini Jr", club: "Real Madrid", position: "Atacantes" },
  { id: "atacantes-neymar-jr-santos", name: "Neymar Jr", club: "Santos", position: "Atacantes" },
  { id: "atacantes-endrick-lyon", name: "Endrick", club: "Lyon", position: "Atacantes" },
  { id: "atacantes-raphinha-barcelona", name: "Raphinha", club: "Barcelona", position: "Atacantes" },
  { id: "atacantes-matheus-cunha-manchester-united", name: "Matheus Cunha", club: "Manchester United", position: "Atacantes" },
  { id: "atacantes-luiz-henrique-zenit", name: "Luiz Henrique", club: "Zenit", position: "Atacantes" },
  { id: "atacantes-martinelli-arsenal", name: "Martinelli", club: "Arsenal", position: "Atacantes" },
  { id: "atacantes-joao-pedro-chelsea", name: "João Pedro", club: "Chelsea", position: "Atacantes" },
  { id: "atacantes-estevao-chelsea", name: "Estêvão", club: "Chelsea", position: "Atacantes" },
  { id: "atacantes-rayan-bournemouth", name: "Rayan", club: "Bournemouth", position: "Atacantes" },
  { id: "atacantes-antony-real-betis", name: "Antony", club: "Real Betis", position: "Atacantes" },
  { id: "atacantes-igor-thiago-brentford", name: "Igor Thiago", club: "Brentford", position: "Atacantes" },
  { id: "atacantes-pedro-flamengo", name: "Pedro", club: "Flamengo", position: "Atacantes" },
  { id: "atacantes-richarlison-tottenham", name: "Richarlison", club: "Tottenham", position: "Atacantes" },
  { id: "atacantes-igor-jesus-nottingham-forest", name: "Igor Jesus", club: "Nottingham Forest", position: "Atacantes" },
  { id: "atacantes-kaio-jorge-cruzeiro", name: "Kaio Jorge", club: "Cruzeiro", position: "Atacantes" },
];

export const BOLAO_POSITIONS: BolaoPlayerPosition[] = ["Goleiros", "Defensores", "Meio-campistas", "Atacantes"];

export function formatBolaoCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? BOLAO_DEFAULT_VALUE);
}

export function formatBolaoDateTime(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date(BOLAO_DEFAULT_DEADLINE);
  if (Number.isNaN(date.getTime())) return "17/05/2026 às 23h59";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isBolaoClosed(config?: Pick<BolaoConfig, "prazo" | "status"> | null) {
  if (config?.status === "encerrado") return true;
  const deadline = new Date(config?.prazo || BOLAO_DEFAULT_DEADLINE);
  return Number.isFinite(deadline.getTime()) && Date.now() > deadline.getTime();
}
