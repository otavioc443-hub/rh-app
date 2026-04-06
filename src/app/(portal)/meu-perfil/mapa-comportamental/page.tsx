"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Download,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  User2,
  Users,
} from "lucide-react";
import {
  BEHAVIOR_ADJECTIVES,
  BEHAVIOR_AXIS_META,
  calculateBehaviorCompetencies,
  calculateBehaviorFactorResults,
  calculateBehaviorIsolatedProfile,
  calculateBehaviorLeadershipProfile,
  combineBehaviorAxisResults,
  getBehaviorClassificationLabel,
  getBehaviorConfidence,
  getBehaviorSummaryLine,
  getPredominantBehaviorAxes,
  type BehaviorAxisResult,
  type BehaviorCompetencyPoint,
  type BehaviorFactorResult,
  type BehaviorIsolatedProfilePoint,
  type BehaviorLeadershipPoint,
} from "@/lib/behaviorProfile";

type Step = 2 | 3;

type BehaviorHistoryItem = {
  id: string;
  created_at: string;
  predominant_self: string[] | null;
  predominant_others: string[] | null;
  self_result: BehaviorAxisResult[];
  others_result: BehaviorAxisResult[];
  self_selected_ids: string[] | null;
  others_selected_ids: string[] | null;
};

type HistoryWindow = "all" | "3m" | "6m" | "12m";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function sortResults(results: BehaviorAxisResult[]) {
  return [...results].sort((a, b) => b.percent - a.percent || b.score - a.score);
}

function normalizeDisplayName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name || name.includes("@")) return null;
  return name;
}

function firstName(value: string | null | undefined) {
  const normalized = normalizeDisplayName(value);
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] ?? null;
}

function initials(value: string | null | undefined) {
  const normalized = normalizeDisplayName(value);
  if (!normalized) return "PC";
  const parts = normalized.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "PC";
}

function summarizePredominance(predominant: BehaviorAxisResult[]) {
  if (!predominant.length) return "Perfil equilibrado";
  return predominant.map((item) => item.label).join(" + ");
}

function signedValue(value: number) {
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}` : rounded;
}

function getAxisTextClass(key: string) {
  switch (key) {
    case "executor":
      return "text-amber-600";
    case "communicator":
      return "text-cyan-700";
    case "planner":
      return "text-emerald-600";
    case "analyst":
      return "text-sky-700";
    default:
      return "text-slate-800";
  }
}

function getCompetencyLevel(score: number) {
  if (score >= 8.6) return "Alta";
  if (score >= 7.4) return "Normal alta";
  if (score >= 6.2) return "Normal baixa";
  return "Baixa";
}

function buildFactorAttention(selfFactors: BehaviorFactorResult[], othersFactors: BehaviorFactorResult[]) {
  const items: string[] = [];
  const selfCritical = [...selfFactors].sort((a, b) => b.negativePercent - a.negativePercent).slice(0, 2);
  const envCritical = [...othersFactors].sort((a, b) => b.negativePercent - a.negativePercent).slice(0, 2);

  for (const item of selfCritical) {
    if (item.negativePercent > 0) {
      items.push(`${item.label}: ${item.negativePercent.toFixed(2)}% de fatores de atenção no perfil natural.`);
    }
  }
  for (const item of envCritical) {
    if (item.negativePercent > 0) {
      items.push(`${item.label}: ${item.negativePercent.toFixed(2)}% de tensão percebida na exigência do meio.`);
    }
  }

  return items.length
    ? items
    : ["Não foram identificados fatores de atenção relevantes nas seleções atuais."];
}

function buildBehaviorRecommendations(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  predominantOthers: BehaviorAxisResult[],
  dominantGaps: BehaviorIsolatedProfilePoint[],
  mainCompetencies: BehaviorCompetencyPoint[]
) {
  const topSelf = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const topEnvironment = predominantOthers[0]?.label ?? "ambiente equilibrado";
  const gap = dominantGaps[0];
  const competenciesText = mainCompetencies.slice(0, 3).map((item) => item.label).join(", ");

  return [
    {
      title: "Usar a predominância natural com intenção",
      text: `${personName} tende a operar com maior naturalidade em ${topSelf}. Vale priorizar contextos e entregas em que esse estilo apareça como força principal, sem perder abertura para ajuste situacional.`,
    },
    {
      title: "Adaptação ao contexto atual",
      text: `O ambiente hoje puxa mais para ${topEnvironment}. Isso sugere calibrar comunicação, ritmo e forma de decisão para reduzir desgaste sem descaracterizar o perfil natural.`,
    },
    {
      title: "Foco de desenvolvimento",
      text: gap
        ? `A maior diferença aparece em ${gap.label}. Um plano simples e prático é observar esse eixo nas próximas semanas e testar pequenas adaptações na rotina e na interação com o time.`
        : "O perfil está relativamente equilibrado. O próximo passo mais útil é manter consistência nas entregas e observar variações ao longo do tempo.",
    },
    {
      title: "Competências a explorar",
      text: `As competências com maior potencial nesta leitura são: ${competenciesText}. Vale usar isso como base para PDI, conversas com gestor e definição de responsabilidades.`,
    },
  ];
}

function buildManagerGuidance(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  predominantOthers: BehaviorAxisResult[],
  competencies: BehaviorCompetencyPoint[],
  dominantGaps: BehaviorIsolatedProfilePoint[]
) {
  const primary = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const environment = predominantOthers[0]?.label ?? "um contexto mais equilibrado";
  const topCompetencies = competencies.slice(0, 3).map((item) => item.label);
  const mainGap = dominantGaps[0]?.label ?? null;

  return [
    {
      title: "Como essa pessoa tende a render melhor",
      text: `${personName} tende a responder melhor quando pode usar ${primary.toLowerCase()} com clareza de expectativa, espaço de decisão e contexto bem sinalizado.`,
    },
    {
      title: "Como alinhar com o ambiente atual",
      text: `Hoje o ambiente parece demandar mais ${environment.toLowerCase()}. Para RH e liderança, isso sugere combinar autonomia com alinhamento frequente sobre ritmo, prioridades e forma de entrega.`,
    },
    {
      title: "Onde vale acompanhar mais de perto",
      text: mainGap
        ? `O maior desvio atual aparece em ${mainGap}. Esse eixo merece observação em one-on-ones, feedbacks e combinados de rotina para evitar desgaste desnecessário.`
        : "O perfil está relativamente equilibrado. O ganho aqui é manter boa cadência de alinhamento e usar o relatório como apoio de desenvolvimento, não como rótulo fixo.",
    },
    {
      title: "Como usar essa leitura em PDI e feedback",
      text: topCompetencies.length
        ? `As competências mais fortes hoje são ${topCompetencies.join(", ")}. Elas podem servir como base para PDI, definição de projetos e feedbacks mais objetivos sobre contribuição e desenvolvimento.`
        : "Use esta leitura para reforçar pontos fortes observáveis, registrar exemplos práticos e construir próximos passos de desenvolvimento com o colaborador.",
    },
  ];
}

function buildHistoryComparison(
  currentResults: BehaviorAxisResult[],
  previousResults: BehaviorAxisResult[]
) {
  const previousByKey = new Map(previousResults.map((item) => [item.key, item]));

  return currentResults.map((item) => {
    const previous = previousByKey.get(item.key);
    return {
      key: item.key,
      label: item.label,
      current: item.percent,
      previous: previous?.percent ?? 0,
      delta: item.percent - (previous?.percent ?? 0),
    };
  });
}

function buildTeamContributionHighlights(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  competencies: BehaviorCompetencyPoint[]
) {
  const mainAxis = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const secondAxis = predominantSelf[1]?.label ?? null;
  const topCompetencies = competencies.slice(0, 3).map((item) => item.label);

  return [
    {
      title: "Como tende a agregar ao time",
      text: secondAxis
        ? `${personName} tende a contribuir combinando ${mainAxis} com ${secondAxis}, o que favorece dinamismo, leitura de contexto e entregas com mais presença.`
        : `${personName} tende a contribuir com uma presença mais forte em ${mainAxis}, apoiando o time com consistência e clareza na forma de atuar.`,
    },
    {
      title: "Onde mais pode gerar valor",
      text: topCompetencies.length
        ? `Os sinais mais fortes desta leitura aparecem em ${topCompetencies.join(", ")}. Essas frentes podem orientar distribuição de responsabilidades, PDI e projetos de maior aderência.`
        : "A leitura atual aponta para um perfil relativamente equilibrado, com boa margem para desenvolvimento situacional conforme o contexto.",
    },
  ];
}

function buildExecutiveBehaviorNarrative(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  competencies: BehaviorCompetencyPoint[]
) {
  const primary = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const secondary = predominantSelf[1]?.label ?? null;
  const topCompetencies = competencies.slice(0, 5).map((item) => item.label);

  const styleSummary =
    primary === "Executor"
      ? `${personName} tende a se movimentar com energia, iniciativa e senso de urgencia, buscando avancar com autonomia e resposta rapida.`
      : primary === "Comunicador"
        ? `${personName} tende a operar com forte presenca relacional, repertorio verbal e capacidade de mobilizar pessoas em torno de ideias e projetos.`
        : primary === "Planejador"
          ? `${personName} tende a agir com constancia, estabilidade e boa leitura do coletivo, favorecendo continuidade e colaboracao.`
          : `${personName} tende a atuar com análise, critério e cuidado com estrutura, priorizando clareza, previsibilidade e qualidade.`;

  return {
    subcharacteristics: secondary
      ? `A combinação entre ${primary} e ${secondary} sugere um estilo de atuação com boa complementaridade entre ritmo, comunicação e forma de decisão.`
      : `A leitura atual mostra uma predominância mais clara em ${primary}, reforçando um estilo de atuação mais reconhecível no dia a dia.`,
    basicSkills: `${styleSummary} As competências mais favorecidas nesta leitura são ${topCompetencies.slice(0, 3).join(", ")}, o que tende a favorecer entregas com mais aderência e consistência.`,
    commonSkills: `No funcionamento cotidiano, esse perfil costuma responder melhor quando existe espaço para usar ${topCompetencies.slice(0, 4).join(", ")} em situações reais de trabalho, com clareza de expectativa e contexto.`,
  };
}

function buildProfileCombinationNarrative(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  predominantOthers: BehaviorAxisResult[]
) {
  const primary = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const secondary = predominantSelf[1]?.label ?? null;
  const environment = predominantOthers[0]?.label ?? null;
  const combinationKey = [primary, secondary].filter(Boolean).join("|");

  const combinationCopy: Record<string, string> = {
    "Comunicador|Executor": `${personName} tende a combinar presença relacional com impulso de ação, o que favorece influência, mobilização e ritmo nas entregas.`,
    "Executor|Analista": `${personName} tende a unir velocidade de execução com leitura crítica, o que pode gerar entregas objetivas e decisões mais racionais.`,
    "Planejador|Analista": `${personName} tende a operar com mais estabilidade, organização e cuidado com consistência, favorecendo previsibilidade e qualidade.`,
    "Comunicador|Planejador": `${personName} tende a sustentar colaboração com boa leitura de clima e continuidade, o que ajuda em alinhamento, suporte e cadência.`,
  };

  const base =
    combinationCopy[combinationKey] ??
    `${personName} tende a atuar com maior naturalidade em ${primary.toLowerCase()}${secondary ? `, apoiado por ${secondary.toLowerCase()}` : ""}.`;

  return environment
    ? `${base} No contexto atual, o ambiente parece valorizar mais ${environment.toLowerCase()}, o que ajuda a orientar ajustes sem perder autenticidade.`
    : base;
}

function buildPredominanceOpeningSummary(
  personName: string,
  selfResults: BehaviorAxisResult[],
  othersResults: BehaviorAxisResult[]
) {
  const [primary, secondary] = selfResults;
  const lowest = [...selfResults].sort((a, b) => a.percent - b.percent)[0];
  const environmentLead = othersResults[0];

  if (!primary) {
    return `${personName} apresenta uma leitura equilibrada neste momento, sem um eixo isolado dominando de forma clara.`;
  }

  const secondaryText =
    secondary && secondary.percent >= 20
      ? ` com apoio relevante de ${secondary.label.toLowerCase()}`
      : "";

  const lowestText = lowest
    ? ` O eixo com menor expressão agora é ${lowest.label.toLowerCase()}, o que ajuda a entender onde tende a existir menor espontaneidade.`
    : "";

  const environmentText = environmentLead
    ? ` No contexto atual, o ambiente parece demandar mais ${environmentLead.label.toLowerCase()}, o que orienta melhor os ajustes esperados nas relações e entregas.`
    : "";

  return `${personName} tende a atuar com maior naturalidade em ${primary.label.toLowerCase()}${secondaryText}.${lowestText}${environmentText}`;
}

function buildSituationalIndicators(
  selfConfidenceLabel: string,
  othersConfidenceLabel: string,
  selfFactors: BehaviorFactorResult[],
  isolatedProfile: BehaviorIsolatedProfilePoint[],
  competencies: BehaviorCompetencyPoint[]
) {
  const attentionAverage =
    selfFactors.reduce((sum, item) => sum + item.negativePercent, 0) / Math.max(1, selfFactors.length);
  const topCompetency = competencies[0]?.score ?? 0;
  const largestGap = Math.max(
    ...isolatedProfile.map((item) => Math.abs(item.environmentDemand - item.profileCurrent)),
    0
  );

  const indicators = [
    {
      title: "Energia",
      status: topCompetency >= 8 ? "Alta" : topCompetency >= 6.5 ? "Normal alta" : "Moderada",
      description: "Estimativa de intensidade com que o perfil tende a sustentar ritmo, iniciativa e presença nas entregas.",
    },
    {
      title: "Exigência do meio",
      status: largestGap >= 20 ? "Alta" : largestGap >= 12 ? "Moderada" : "Baixa",
      description: "Leitura do quanto o contexto atual está pedindo ajustes além do padrão mais natural de atuação.",
    },
    {
      title: "Aproveitamento",
      status: selfConfidenceLabel === "Confianca alta" ? "Alto" : selfConfidenceLabel === "Confianca media" ? "Consistente" : "Em formação",
      description: "Sinal de quanto o desenho atual da leitura consegue capturar o melhor do perfil percebido.",
    },
    {
      title: "Autoconfiança",
      status: selfConfidenceLabel,
      description: "Nível de consistência da leitura do perfil natural com base no volume de adjetivos selecionados.",
    },
    {
      title: "Leitura do ambiente",
      status: othersConfidenceLabel,
      description: "Segurança da leitura sobre a exigência atual do contexto, útil para calibrar adaptação e expectativas.",
    },
    {
      title: "Flexibilidade",
      status: largestGap <= 10 ? "Alta" : largestGap <= 18 ? "Normal alta" : "Em atenção",
      description: "Capacidade percebida de ajustar comportamento sem perder identidade profissional no processo.",
    },
  ];

  if (attentionAverage > 18) {
    indicators.push({
      title: "Fatores de observação",
      status: "Em atenção",
      description: "Há sinais de tensão comportamental que merecem acompanhamento próximo para evitar desgaste ou ruído relacional.",
    });
  }

  return indicators;
}

function filterBehaviorHistory(history: BehaviorHistoryItem[], window: HistoryWindow) {
  if (window === "all") return history;

  const months = window === "3m" ? 3 : window === "6m" ? 6 : 12;
  const limit = new Date();
  limit.setMonth(limit.getMonth() - months);

  return history.filter((item) => new Date(item.created_at) >= limit);
}

function buildDevelopmentPlan(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  dominantGaps: BehaviorIsolatedProfilePoint[],
  competencies: BehaviorCompetencyPoint[]
) {
  const primary = predominantSelf[0]?.label ?? "perfil predominante";
  const topCompetencies = competencies.slice(0, 2).map((item) => item.label);
  const mainGap = dominantGaps[0]?.label ?? "o eixo de maior oscilação";

  return [
    {
      horizon: "30 dias",
      title: "Consolidar força principal",
      text: `${personName} pode focar em usar ${primary.toLowerCase()} com mais intenção em reuniões, decisões e rotina, registrando exemplos concretos de onde isso mais gera resultado.`,
    },
    {
      horizon: "60 dias",
      title: "Aplicar a leitura em entregas reais",
      text: topCompetencies.length
        ? `Vale escolher uma atividade do dia a dia para exercitar ${topCompetencies.join(" e ")} de forma observável, com feedback simples do gestor ou do time.`
        : "Vale escolher uma atividade do dia a dia para transformar esta leitura em comportamento observável e passível de feedback.",
    },
    {
      horizon: "90 dias",
      title: "Calibrar o principal ponto de ajuste",
      text: `O próximo ciclo pode mirar ${mainGap.toLowerCase()}, testando pequenas mudanças de ritmo, organização ou comunicação para reduzir desgaste e ampliar aderência ao contexto.`,
    },
  ];
}

function buildManagerActionMatrix(
  personName: string,
  predominantSelf: BehaviorAxisResult[],
  predominantOthers: BehaviorAxisResult[],
  dominantGaps: BehaviorIsolatedProfilePoint[],
  competencies: BehaviorCompetencyPoint[]
) {
  const mainStyle = predominantSelf[0]?.label ?? "Perfil equilibrado";
  const mainDemand = predominantOthers[0]?.label ?? "um contexto mais equilibrado";
  const criticalGap = dominantGaps[0]?.label ?? "o principal ponto de ajuste";
  const topCompetency = competencies[0]?.label ?? "a principal competência observada";

  return [
    {
      title: "Leitura de aderência ao contexto",
      text: `${personName} tende a operar com mais naturalidade em ${mainStyle.toLowerCase()}, enquanto o contexto atual parece pedir mais ${mainDemand.toLowerCase()}. Esse distanciamento orienta o nível de calibração que liderança e RH devem acompanhar.`,
    },
    {
      title: "Cuidados de gestão",
      text: `O eixo mais sensível hoje é ${criticalGap.toLowerCase()}. Vale usar conversas curtas e frequentes para ajustar expectativa, clareza de prioridade e forma de acompanhamento.`,
    },
    {
      title: "Onde apoiar desenvolvimento",
      text: `${topCompetency} aparece como um bom ponto de alavanca. O melhor uso gerencial é transformar essa força em responsabilidade prática, projeto real e critério objetivo de evolução.`,
    },
  ];
}

function formatHistoryWindowLabel(window: HistoryWindow) {
  if (window === "3m") return "3 meses";
  if (window === "6m") return "6 meses";
  if (window === "12m") return "12 meses";
  return "todo o histórico";
}

export default function MapaComportamentalPage() {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPdiPlan, setSavingPdiPlan] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<BehaviorHistoryItem[]>([]);
  const [activeRelease, setActiveRelease] = useState<{
    id: string;
    window_start: string;
    window_end: string;
  } | null>(null);
  const [step, setStep] = useState<Step>(2);
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>("12m");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selfSelected, setSelfSelected] = useState<string[]>([]);
  const [othersSelected, setOthersSelected] = useState<string[]>([]);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);

  const personName = firstName(fullName) ?? "O colaborador";
  const canPerformAssessment = !!activeRelease;
  const latestAssessment = history[0] ?? null;
  const filteredHistory = useMemo(() => filterBehaviorHistory(history, historyWindow), [history, historyWindow]);
  const previousAssessment = filteredHistory[1] ?? null;
  const reportSelfResults = sortResults(latestAssessment?.self_result ?? []);
  const reportOthersResults = sortResults(latestAssessment?.others_result ?? []);
  const previousSelfResults = sortResults(previousAssessment?.self_result ?? []);
  const reportPredominantSelf = getPredominantBehaviorAxes(reportSelfResults);
  const reportPredominantOthers = getPredominantBehaviorAxes(reportOthersResults);
  const reportSelfSelectedIds = latestAssessment?.self_selected_ids ?? [];
  const reportOthersSelectedIds = latestAssessment?.others_selected_ids ?? [];

  const selfFactors = useMemo(
    () => calculateBehaviorFactorResults(reportSelfSelectedIds),
    [reportSelfSelectedIds]
  );
  const othersFactors = useMemo(
    () => calculateBehaviorFactorResults(reportOthersSelectedIds),
    [reportOthersSelectedIds]
  );
  const isolatedProfile = useMemo(
    () => calculateBehaviorIsolatedProfile(reportSelfResults, reportOthersResults),
    [reportSelfResults, reportOthersResults]
  );
  const leadershipProfile = useMemo(
    () => calculateBehaviorLeadershipProfile(reportSelfResults, reportOthersResults),
    [reportSelfResults, reportOthersResults]
  );
  const consolidatedResults = useMemo(
    () => combineBehaviorAxisResults(reportSelfResults, reportOthersResults),
    [reportSelfResults, reportOthersResults]
  );
  const competencies = useMemo(
    () => calculateBehaviorCompetencies(consolidatedResults, selfFactors, leadershipProfile),
    [consolidatedResults, selfFactors, leadershipProfile]
  );
  const selfConfidence = useMemo(
    () => getBehaviorConfidence(reportSelfSelectedIds.length),
    [reportSelfSelectedIds.length]
  );
  const othersConfidence = useMemo(
    () => getBehaviorConfidence(reportOthersSelectedIds.length),
    [reportOthersSelectedIds.length]
  );
  const dominantGaps = useMemo(
    () =>
      [...isolatedProfile]
        .sort((a, b) => Math.abs(b.environmentDemand - b.profileCurrent) - Math.abs(a.environmentDemand - a.profileCurrent))
        .slice(0, 2),
    [isolatedProfile]
  );
  const mainCompetencies = useMemo(
    () => [...competencies].sort((a, b) => b.score - a.score),
    [competencies]
  );
  const recommendations = useMemo(
    () =>
      buildBehaviorRecommendations(
        personName,
        reportPredominantSelf,
        reportPredominantOthers,
        dominantGaps,
        mainCompetencies
      ),
    [personName, reportPredominantSelf, reportPredominantOthers, dominantGaps, mainCompetencies]
  );
  const teamHighlights = useMemo(
    () => buildTeamContributionHighlights(personName, reportPredominantSelf, mainCompetencies),
    [personName, reportPredominantSelf, mainCompetencies]
  );
  const managerGuidance = useMemo(
    () =>
      buildManagerGuidance(
        personName,
        reportPredominantSelf,
        reportPredominantOthers,
        mainCompetencies,
        dominantGaps
      ),
    [personName, reportPredominantSelf, reportPredominantOthers, mainCompetencies, dominantGaps]
  );
  const openingSummary = useMemo(
    () => buildPredominanceOpeningSummary(personName, reportSelfResults, reportOthersResults),
    [personName, reportSelfResults, reportOthersResults]
  );
  const executiveNarrative = useMemo(
    () => buildExecutiveBehaviorNarrative(personName, reportPredominantSelf, mainCompetencies),
    [personName, reportPredominantSelf, mainCompetencies]
  );
  const combinationNarrative = useMemo(
    () => buildProfileCombinationNarrative(personName, reportPredominantSelf, reportPredominantOthers),
    [personName, reportPredominantSelf, reportPredominantOthers]
  );
  const situationalIndicators = useMemo(
    () => buildSituationalIndicators(selfConfidence.label, othersConfidence.label, selfFactors, isolatedProfile, mainCompetencies),
    [selfConfidence.label, othersConfidence.label, selfFactors, isolatedProfile, mainCompetencies]
  );
  const historyComparison = useMemo(
    () => (previousSelfResults.length ? buildHistoryComparison(reportSelfResults, previousSelfResults) : []),
    [reportSelfResults, previousSelfResults]
  );
  const historySummary = useMemo(() => {
    const up = historyComparison.filter((item) => item.delta > 0.15).length;
    const down = historyComparison.filter((item) => item.delta < -0.15).length;
    const stable = historyComparison.length - up - down;
    return { up, down, stable };
  }, [historyComparison]);
  const developmentPlan = useMemo(
    () => buildDevelopmentPlan(personName, reportPredominantSelf, dominantGaps, mainCompetencies),
    [personName, reportPredominantSelf, dominantGaps, mainCompetencies]
  );
  const managerActionMatrix = useMemo(
    () =>
      buildManagerActionMatrix(
        personName,
        reportPredominantSelf,
        reportPredominantOthers,
        dominantGaps,
        mainCompetencies
      ),
    [personName, reportPredominantSelf, reportPredominantOthers, dominantGaps, mainCompetencies]
  );
  const pdiPrefillHref = useMemo(() => {
    const focus = dominantGaps[0]?.label ?? reportPredominantSelf[0]?.label ?? "Desenvolvimento";
    const strength = mainCompetencies[0]?.label ?? reportPredominantSelf[0]?.label ?? "Competência principal";
    return `/meu-perfil/pdi?origem=mapa-comportamental&foco=${encodeURIComponent(focus)}&forca=${encodeURIComponent(strength)}`;
  }, [dominantGaps, mainCompetencies, reportPredominantSelf]);

  async function exportReportAsPdf() {
    if (!reportRef.current) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!printWindow) {
      setMsg("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-up.");
      return;
    }

    const reportHtml = reportRef.current.innerHTML;
    const title = `Relatório comportamental - ${fullName || "Colaborador"}`;
    const exportDate = new Date().toLocaleDateString("pt-BR");

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: white; }
            .print-shell { padding: 0 0 18mm; }
            .print-cover { border-bottom: 1px solid #dbe4f0; padding: 0 0 12px; margin: 0 0 16px; }
            .print-cover h1 { margin: 0; font-size: 26px; line-height: 1.1; color: #0f172a; }
            .print-cover p { margin: 6px 0 0; font-size: 12px; color: #475569; }
            .print-footer {
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #dbe4f0;
              background: white;
              padding: 6px 10mm 0;
              font-size: 11px;
              color: #475569;
            }
            .print-page-number::after { content: counter(page); }
            .report-page { display: flex; flex-direction: column; gap: 14px; }
            .report-page > section { break-inside: avoid; page-break-inside: avoid; }
            svg { max-width: 100%; height: auto; }
            .text-sky-700,.text-cyan-700,.text-teal-700,.text-blue-600,.text-slate-900,.text-slate-950 { color: #0f172a !important; }
            .text-slate-600,.text-slate-700,.text-slate-500 { color: #475569 !important; }
            .bg-slate-900 { background: #0f172a !important; color: white !important; }
            .border-slate-200 { border-color: #dbe4f0 !important; }
            .from-white,.to-slate-50,.to-sky-50\/20,.to-sky-50\/30,.to-amber-50\/30 { background: white !important; }
            @page { size: A4; margin: 12mm 10mm 16mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-shell { padding: 0 0 16mm; }
            }
          </style>
        </head>
        <body>
          <div class="print-shell">
            <div class="print-cover">
              <h1>Relatório comportamental</h1>
              <p>${fullName || "Colaborador"} • ${exportDate} • Portal RH</p>
            </div>
            ${reportHtml}
            <div class="print-footer">
              <span>Portal RH • Relatório comportamental</span>
              <span>${exportDate} • Página <span class="print-page-number"></span></span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  }

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/behavior/me", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await res.json()) as {
        error?: string;
        userId?: string;
        fullName?: string;
        email?: string;
        activeRelease?: { id: string; window_start: string; window_end: string } | null;
        history?: BehaviorHistoryItem[];
      };

      if (!res.ok) {
        throw new Error(body.error || "Erro ao carregar mapa comportamental.");
      }

      setUserId(body.userId ?? null);
      setFullName((prev) => normalizeDisplayName(prev) ?? normalizeDisplayName(body.fullName) ?? "");
      setEmail((prev) => prev || body.email || "");
      setHistory(body.history ?? []);
      setActiveRelease(body.activeRelease ?? null);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Erro ao carregar mapa comportamental.";
      setMsg(`Erro ao carregar mapa comportamental: ${text}. Rode supabase/sql/2026-03-04_create_behavior_assessment_module.sql.`);
      setHistory([]);
      setActiveRelease(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAssessment() {
    if (!userId) return;

    if (!canPerformAssessment) {
      setMsg("A avaliação comportamental não está liberada para você neste momento. Solicite ao RH.");
      return;
    }

    if (!selfSelected.length || !othersSelected.length) {
      setMsg("Selecione adjetivos nas etapas 2 e 3 para registrar o mapa.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const payload = {
        full_name: fullName.trim() || "Colaborador",
        email: email.trim() || "sem-email@local",
        selfSelectedIds: selfSelected,
        othersSelectedIds: othersSelected,
      };

      const res = await fetch("/api/behavior/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(body.error || "Erro ao registrar mapa comportamental.");
      }

      setMsg("Mapa comportamental registrado com sucesso.");
      await load();
      setStep(2);
      setSelfSelected([]);
      setOthersSelected([]);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao registrar mapa comportamental.");
    } finally {
      setSaving(false);
    }
  }

  async function createSuggestedPdiPlan() {
    setSavingPdiPlan(true);
    setMsg("");
    try {
      const res = await fetch("/api/behavior/pdi-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: developmentPlan,
          focus: dominantGaps[0]?.label ?? reportPredominantSelf[0]?.label ?? "Desenvolvimento",
          strength: mainCompetencies[0]?.label ?? reportPredominantSelf[0]?.label ?? "Competência principal",
        }),
      });
      const body = (await res.json()) as { error?: string; created?: number };
      if (!res.ok) throw new Error(body.error || "Não foi possível gerar o plano no PDI.");
      setMsg(`Plano sugerido enviado ao PDI com ${body.created ?? 0} item(ns).`);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Erro ao gerar plano no PDI.");
    } finally {
      setSavingPdiPlan(false);
    }
  }

  const showReport = !!latestAssessment;
  const showAssessmentArea = !latestAssessment || showAssessmentForm;

  return (
    <div className="space-y-6">
      {showReport ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void exportReportAsPdf()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            <Download size={16} />
            Exportar em PDF
          </button>
          <button
            type="button"
            onClick={() => setShowAssessmentForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            {showAssessmentForm ? "Fechar atualização" : "Atualizar avaliação"}
          </button>
        </div>
      ) : (
        <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Mapa comportamental</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">Sua leitura de perfil</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Uma leitura mais executiva, inspiradora e aplicável do seu estilo de trabalho, de como o contexto atual te demanda e dos pontos que mais podem acelerar seu desenvolvimento em equipe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setSelfSelected([]);
                setOthersSelected([]);
                if (latestAssessment) setShowAssessmentForm(true);
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Reiniciar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {canPerformAssessment ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Janela ativa:{" "}
              <b>
                {new Date(activeRelease.window_start).toLocaleDateString("pt-BR")} ate{" "}
                {new Date(activeRelease.window_end).toLocaleDateString("pt-BR")}
              </b>
              .
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                A avaliação comportamental ainda não foi liberada pelo RH para o período atual.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Assim que o RH liberar a avaliação dentro de uma janela ativa, o relatório será exibido aqui.
              </div>
            </>
          )}

          {showReport ? (
            <section ref={reportRef} className="report-page space-y-6">
              <section id="perfil-predominante" className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="px-8 py-10">
                  <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">Síntese comportamental</p>
                  <h1 className="mt-3 text-center text-5xl font-semibold tracking-tight text-slate-950">
                    {summarizePredominance(reportPredominantSelf)}
                  </h1>
                  <p className="mt-2 text-center text-base text-slate-500">
                    em {new Date(latestAssessment.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="mt-8">
                    <PredominanceSpectrum results={reportSelfResults} />
                  </div>
                  <p className="mx-auto mt-8 max-w-5xl text-center text-lg leading-8 text-slate-700">
                    {openingSummary}
                  </p>
                  <p className="mx-auto mt-4 max-w-4xl text-center text-sm leading-7 text-slate-500">
                    {combinationNarrative}
                  </p>
                </div>
              </section>

              {historyComparison.length ? (
                <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <SectionHeader
                      title="Evolução desde a leitura anterior"
                      description="Comparativo visual do que ganhou força, cedeu espaço ou permaneceu estável na leitura mais recente."
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { value: "3m", label: "3 meses" },
                        { value: "6m", label: "6 meses" },
                        { value: "12m", label: "12 meses" },
                        { value: "all", label: "Tudo" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setHistoryWindow(option.value as HistoryWindow)}
                          className={cx(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            historyWindow === option.value
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <MiniHistoryStat label="Ganharam força" value={String(historySummary.up)} tone="emerald" />
                    <MiniHistoryStat label="Caíram" value={String(historySummary.down)} tone="amber" />
                    <MiniHistoryStat label="Estáveis" value={String(historySummary.stable)} tone="slate" />
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {historyComparison.map((item) => (
                      <HistoryDeltaCard key={item.key} item={item} />
                    ))}
                  </div>
                </section>
              ) : null}

              {filteredHistory.length > 1 ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <SectionHeader
                    title="Linha do tempo das leituras"
                    description={`Resumo cronológico das leituras registradas em ${formatHistoryWindowLabel(historyWindow)}, para facilitar percepção de continuidade e mudança.`}
                  />
                  <div className="mt-5 grid gap-4">
                    {filteredHistory.slice(0, 6).map((item, index) => (
                      <HistoryTimelineCard
                        key={item.id}
                        item={item}
                        index={index}
                        isLatest={index === 0}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section id="subcaracteristicas" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-6 shadow-sm">
                <SectionHeader
                  title="Como seu estilo tende a aparecer no trabalho"
                  description="Uma leitura prática da sua forma de atuar, se relacionar e transformar intenção em entrega."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <NarrativeBlock
                    title="Subcaracterísticas"
                    text={executiveNarrative.subcharacteristics}
                  />
                  <NarrativeBlock
                    title="Habilidades básicas"
                    text={executiveNarrative.basicSkills}
                  />
                  <NarrativeBlock
                    title="Habilidades comuns"
                    text={executiveNarrative.commonSkills}
                  />
                </div>
              </section>

              <section id="indicadores-situacionais" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-amber-50/30 p-6 shadow-sm">
                <SectionHeader
                  title="Indicadores situacionais"
                  description="Sinais de ritmo, confiança, flexibilidade e aproveitamento no contexto atual."
                />
                <div className="mt-6 space-y-5">
                  {situationalIndicators.map((item) => (
                    <SituationalIndicatorRow key={item.title} title={item.title} status={item.status} description={item.description} />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
                <SectionHeader
                  title="Leitura gráfica do perfil"
                  description="Comparativos visuais para apoiar entendimento do momento atual e conversas de desenvolvimento."
                />
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <TrendLineChart
                    title="Perfil isolado"
                    items={isolatedProfile}
                    lineAColor="#0f766e"
                    lineBColor="#d97706"
                    lineCColor="#475569"
                  />
                  <LeadershipLineChart items={leadershipProfile} />
                </div>
              </section>

              <section id="competencias" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/20 p-6 shadow-sm">
                <SectionHeader
                  title="Competências em evidência"
                  description="Potenciais com maior tendência de aparecer no seu jeito de contribuir, organizar e se relacionar."
                />
                <div className="mt-8">
                  <CompetencyRadar points={mainCompetencies.slice(0, 20)} />
                </div>
                <div className="mt-10 rounded-[26px] border border-slate-200 bg-white px-8 py-4 shadow-sm">
                  {mainCompetencies.map((item, index) => (
                    <CompetencyBar key={item.label} point={item} highlight={index < 3} index={index} />
                  ))}
                </div>
              </section>

              <section id="pontos-de-atencao" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  title="Pontos para calibragem"
                  description="Sinais de observação para apoiar desenvolvimento, distribuição de demandas e ajuste fino da forma de trabalhar."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <AttentionPanel
                    title="Principais desvios de adaptação"
                    items={dominantGaps.map((item) => `${item.label}: diferença de ${Math.abs(item.environmentDemand - item.profileCurrent).toFixed(2)} pontos entre perfil atual e demanda do meio.`)}
                  />
                  <AttentionPanel
                    title="Fatores de observação"
                    items={buildFactorAttention(selfFactors, othersFactors)}
                  />
                </div>
              </section>

              <section id="lideranca" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  title="Como tende a conduzir e influenciar"
                  description="Leitura da forma mais provável de comunicar expectativa, orientar o time e responder ao contexto."
                />
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {leadershipProfile.map((item) => (
                    <LeadershipCard key={item.key} point={item} />
                  ))}
                </div>
              </section>

              <section id="recomendacoes" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  title="Direções de desenvolvimento"
                  description="Sugestões objetivas para potencializar sua contribuição, reduzir desgaste e evoluir no contexto atual."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {teamHighlights.map((item, index) => (
                    <RecommendationCard key={item.title} title={item.title} text={item.text} index={index} highlighted />
                  ))}
                  {recommendations.map((item, index) => (
                    <RecommendationCard key={item.title} title={item.title} text={item.text} index={index + teamHighlights.length} />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-6 shadow-sm">
                <SectionHeader
                  title="Leitura para RH e liderança"
                  description="Uma visão mais gerencial para apoiar PDI, feedback, distribuição de responsabilidades e acompanhamento de desenvolvimento."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {managerGuidance.map((item, index) => (
                    <RecommendationCard key={item.title} title={item.title} text={item.text} index={index} highlighted={index === 0} />
                  ))}
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {managerActionMatrix.map((item, index) => (
                    <RecommendationCard
                      key={item.title}
                      title={item.title}
                      text={item.text}
                      index={index + managerGuidance.length}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  title="Transformar leitura em ação"
                  description="Atalhos práticos para levar essa leitura para desenvolvimento individual, feedbacks e conversas de acompanhamento."
                />
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void createSuggestedPdiPlan()}
                    disabled={savingPdiPlan}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                  >
                    {savingPdiPlan ? "Gerando plano..." : "Gerar plano no PDI"}
                  </button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <PortalActionCard
                    href={pdiPrefillHref}
                    title="Levar para o PDI"
                    text="Abrir o PDI já com foco sugerido a partir do seu perfil, para transformar leitura em próximos passos concretos."
                  />
                  <PortalActionCard
                    href="/meu-perfil/feedback"
                    title="Conectar com feedback"
                    text="Usar os pontos fortes e de atenção para preparar conversas mais objetivas e úteis."
                  />
                  <PortalActionCard
                    href="/meu-perfil/competencias"
                    title="Cruzar com competências"
                    text="Comparar essa leitura com outras avaliações e construir um plano mais consistente."
                  />
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-6 shadow-sm">
                <SectionHeader
                  title="Plano sugerido para desenvolvimento"
                  description="Um roteiro simples de 30, 60 e 90 dias para transformar a leitura comportamental em prática observável."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {developmentPlan.map((item, index) => (
                    <RecommendationCard
                      key={item.horizon}
                      title={`${item.horizon} • ${item.title}`}
                      text={item.text}
                      index={index}
                      highlighted={index === 0}
                    />
                  ))}
                </div>
              </section>
            </section>
          ) : null}

          {showAssessmentArea ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {step === 2
                    ? "Marque os adjetivos que melhor te representam"
                    : "Agora marque como os outros pensam que você deveria ser"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Não existem respostas certas. O objetivo é identificar predominância relativa entre os perfis.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 2xl:grid-cols-10">
                {BEHAVIOR_ADJECTIVES.map((item) => {
                  const selected = step === 2 ? selfSelected.includes(item.id) : othersSelected.includes(item.id);

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        !canPerformAssessment
                          ? null
                          : step === 2
                            ? setSelfSelected((prev) => toggle(prev, item.id))
                            : setOthersSelected((prev) => toggle(prev, item.id))
                      }
                      disabled={!canPerformAssessment}
                      className={cx(
                        "flex min-h-[56px] items-center justify-center rounded-xl border px-2 py-2 text-center text-[15px] font-medium leading-snug transition",
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        !canPerformAssessment && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <span className="break-words">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Selecionados nesta etapa: <b>{step === 2 ? selfSelected.length : othersSelected.length}</b>
              </p>

              <div className="mt-4 flex justify-end">
                <div className="flex gap-2">
                  {step === 2 ? (
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={!selfSelected.length || !canPerformAssessment}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                    >
                      Ir para etapa 3
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Voltar etapa 2
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              O relatório completo será exibido após a conclusão do envio, com os gráficos e análises finais.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void saveAssessment()}
                disabled={saving || loading || !userId || !canPerformAssessment || !selfSelected.length || !othersSelected.length}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {saving ? "Registrando..." : "Registrar mapa comportamental"}
              </button>
            </div>
          </section>
          ) : null}
        </>
      )}

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Relatório</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</div>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function PredominanceSpectrum({ results }: { results: BehaviorAxisResult[] }) {
  const palette: Record<string, { segment: string; text: string }> = {
    executor: { segment: "#D97706", text: "text-amber-600" },
    comunicador: { segment: "#0F766E", text: "text-teal-700" },
    planejador: { segment: "#2563EB", text: "text-blue-600" },
    analista: { segment: "#475569", text: "text-slate-600" },
  };

  return (
    <div>
      <div className="overflow-hidden rounded-full border border-slate-200">
        <div className="flex h-12 w-full">
          {results.map((item) => (
            <div
              key={item.key}
              className="relative h-12"
              style={{ width: `${item.percent}%`, backgroundColor: palette[item.key]?.segment ?? "#64748B" }}
            >
              <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-white/80" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 text-center md:grid-cols-4">
        {results.map((item) => (
          <div key={item.key}>
            <div className={cx("text-4xl font-semibold", palette[item.key]?.text ?? "text-slate-700")}>{item.percent.toFixed(2)}%</div>
            <div className={cx("mt-1 text-2xl font-semibold", palette[item.key]?.text ?? "text-slate-700")}>{item.label}</div>
            <div className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
              {getBehaviorClassificationLabel(item.classification)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveSummaryTile({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{title}</div>
      <div className="mt-3 text-2xl font-semibold leading-tight text-slate-950">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function ExecutiveStatCard({
  title,
  value,
  description,
  highlighted,
}: {
  title: string;
  value: string;
  description: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-[24px] border p-5 backdrop-blur",
        highlighted ? "border-white/15 bg-white/10" : "border-white/10 bg-violet-950/20"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100">{title}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{description}</p>
    </div>
  );
}

function ProfileTag({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white">
      {icon}
      {label}
    </span>
  );
}

function NarrativeBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{title}</p>
      <p className="mt-4 text-sm leading-7 text-slate-700">{text}</p>
    </div>
  );
}

function IndicatorCard({
  title,
  status,
  description,
}: {
  title: string;
  status: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{status}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function SituationalIndicatorRow({
  title,
  status,
  description,
}: {
  title: string;
  status: string;
  description: string;
}) {
  const statusMap: Record<string, number> = {
    "Baixa": 38,
    "Muito baixa": 26,
    "Normal baixa": 50,
    "Moderada": 58,
    "Consistente": 64,
    "Normal alta": 76,
    "Alta": 88,
    "Em formação": 34,
    "Em atenção": 42,
    "Alto": 82,
  };
  const normalized = status.toLowerCase();
  const width =
    statusMap[status] ??
    (normalized.includes("alta")
      ? 82
      : normalized.includes("media")
        ? 60
        : normalized.includes("aten")
          ? 42
          : normalized.includes("baixa")
            ? 38
            : 55);

  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
      <div>
        <p className="text-[28px] font-semibold tracking-tight text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-700">{status}</div>
        <div className="mt-2 h-2 rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-700" style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cx("font-medium text-slate-800", strong && "font-semibold text-slate-950")}>{value}</span>
    </div>
  );
}

function CompetencyBar({
  point,
  highlight,
  index,
}: {
  point: BehaviorCompetencyPoint;
  highlight?: boolean;
  index: number;
}) {
  const width = `${Math.min(100, (point.score / 10) * 100)}%`;
  const level = getCompetencyLevel(point.score);
  return (
    <div className="grid gap-4 border-b border-slate-200 py-4 md:grid-cols-[56px_320px_minmax(0,1fr)] md:items-center">
      <div className="text-xl font-semibold text-sky-700">{index + 1}</div>
      <div className="text-[30px] font-semibold tracking-tight text-slate-900">{point.label}</div>
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-700">{level}</div>
        <div className="mt-2 h-2 rounded-full bg-slate-200">
          <div
            className={cx(
              "h-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-700",
              highlight && "from-sky-700 to-slate-900"
            )}
            style={{ width }}
          />
        </div>
      </div>
    </div>
  );
}

function AttentionPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldAlert size={16} />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  title,
  icon,
  personName,
  results,
  predominant,
  accentClass,
}: {
  title: string;
  icon: ReactNode;
  personName: string;
  results: BehaviorAxisResult[];
  predominant: BehaviorAxisResult[];
  accentClass: string;
}) {
  const predominantTitle = summarizePredominance(predominant);

  return (
    <div className={cx("rounded-[26px] border border-slate-200 bg-gradient-to-br p-5 shadow-sm", accentClass)}>
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>

      <div className="mt-4 rounded-[22px] border border-white/80 bg-white/80 px-4 py-5 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] leading-4 text-slate-500">
          Neste momento, {personName} esta:
        </p>
        <p className="mt-2 text-3xl font-semibold leading-none text-slate-950">{predominantTitle}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {results.map((item) => (
          <div key={item.key} className="rounded-[22px] border border-white/80 bg-white/90 p-4 backdrop-blur">
            <p className="text-3xl font-semibold leading-none tracking-tight text-slate-950">{item.percent.toFixed(2)}%</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{item.label}</p>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div
                className={cx("h-2 rounded-full", BEHAVIOR_AXIS_META[item.key].colorClass)}
                style={{ width: `${Math.min(item.percent, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] leading-4 text-slate-500">
              {item.isPredominant ? "Perfil predominante" : "Perfil complementar"}
            </p>
            <div className={cx("mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", BEHAVIOR_AXIS_META[item.key].chipClass)}>
              {getBehaviorClassificationLabel(item.classification)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[18px] border border-white/80 bg-white/85 p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">Leitura de predominância</p>
        <p className="mt-1">{getBehaviorSummaryLine(results, personName)}</p>
      </div>
    </div>
  );
}

function AdaptationCard({ point }: { point: BehaviorIsolatedProfilePoint }) {
  const intensity = Math.min(100, Math.abs(point.environmentDemand - point.profileCurrent) * 4);
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-950">{point.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Força de adaptação</p>
        </div>
        <span className="text-lg font-semibold text-slate-950">{signedValue(point.adaptationStrength)}</span>
      </div>
      <div className="mt-4 h-2.5 rounded-full bg-slate-200">
        <div className="h-2.5 rounded-full bg-gradient-to-r from-cyan-600 via-blue-600 to-slate-700" style={{ width: `${intensity}%` }} />
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <MetricRow label="Perfil atual" value={signedValue(point.profileCurrent)} />
        <MetricRow label="Exigência do meio" value={signedValue(point.environmentDemand)} />
      </div>
    </div>
  );
}

function LeadershipCard({ point }: { point: BehaviorLeadershipPoint }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <p className="text-lg font-semibold text-slate-950">{point.label}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <MetricRow label="Natural" value={signedValue(point.profileCurrent)} />
        <MetricRow label="Ambiente" value={signedValue(point.environmentDemand)} />
        <MetricRow label="Força de adaptação" value={signedValue(point.adaptationStrength)} strong />
      </div>
    </div>
  );
}

function AxisComparisonCard({
  current,
  environment,
}: {
  current: BehaviorAxisResult;
  environment?: BehaviorAxisResult;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/20 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-950">{current.label}</p>
          <p className="mt-1 text-sm text-slate-500">Comparativo entre estilo natural e demanda do meio.</p>
        </div>
        <div className={cx("rounded-full border px-2.5 py-1 text-[11px] font-semibold", BEHAVIOR_AXIS_META[current.key].chipClass)}>
          {current.percent.toFixed(1)}%
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>Perfil natural</span>
            <span className="font-semibold text-slate-900">{current.percent.toFixed(2)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200">
            <div className={cx("h-2.5 rounded-full", BEHAVIOR_AXIS_META[current.key].colorClass)} style={{ width: `${current.percent}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>Exigência do meio</span>
            <span className="font-semibold text-slate-900">{environment?.percent.toFixed(2) ?? "0.00"}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200">
            <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${environment?.percent ?? 0}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendLineChart({
  title,
  items,
  lineAColor,
  lineBColor,
  lineCColor,
}: {
  title: string;
  items: Array<{
    key: string;
    label: string;
    profileCurrent: number;
    environmentDemand: number;
    adaptationStrength: number;
  }>;
  lineAColor: string;
  lineBColor: string;
  lineCColor: string;
}) {
  const width = 760;
  const height = 280;
  const padding = 32;
  const maxAbs = 25;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = items.length > 1 ? innerWidth / (items.length - 1) : innerWidth;
  const mapY = (value: number) => padding + ((maxAbs - value) / (maxAbs * 2)) * innerHeight;
  const line = (values: number[]) =>
    values
      .map((value, index) => `${padding + stepX * index},${mapY(value)}`)
      .join(" ");

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900">{title}</p>
        <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">i</div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full">
        {[-20, -10, 0, 10, 20].map((tick) => (
          <g key={tick}>
            <line x1={padding} x2={width - padding} y1={mapY(tick)} y2={mapY(tick)} stroke="#dbe4f0" strokeWidth="1" />
            <text x={8} y={mapY(tick) + 4} fontSize="11" fill="#64748b">
              {tick}
            </text>
          </g>
        ))}
            <polyline fill="none" stroke={lineAColor} strokeWidth="3.5" points={line(items.map((item) => item.profileCurrent))} />
            <polyline fill="none" stroke={lineBColor} strokeWidth="3.5" points={line(items.map((item) => item.environmentDemand))} />
            <polyline fill="none" stroke={lineCColor} strokeWidth="3" points={line(items.map((item) => item.adaptationStrength))} />
        {items.map((item, index) => {
          const x = padding + stepX * index;
          return (
            <g key={item.key}>
              <circle cx={x} cy={mapY(item.profileCurrent)} r="6" fill={lineAColor} />
              <rect x={x - 5} y={mapY(item.environmentDemand) - 5} width="10" height="10" rx="3" fill={lineBColor} />
              <polygon points={`${x},${mapY(item.adaptationStrength) - 6} ${x - 6},${mapY(item.adaptationStrength) + 5} ${x + 6},${mapY(item.adaptationStrength) + 5}`} fill={lineCColor} />
              <text x={x} y={height - 8} textAnchor="middle" fontSize="12" fill="#334155">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-slate-200 pt-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
        <span className="text-slate-900">Legenda:</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineAColor }} /> Perfil atual</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: lineBColor }} /> Exigência do meio</span>
        <span className="inline-flex items-center gap-2"><span className="h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent" style={{ borderBottomColor: lineCColor }} /> Força de adaptação</span>
      </div>
    </div>
  );
}

function LeadershipLineChart({ items }: { items: BehaviorLeadershipPoint[] }) {
  const adapted = items.map((item) => ({
    key: item.key,
    label: item.label,
    profileCurrent: item.profileCurrent,
    environmentDemand: item.environmentDemand,
    adaptationStrength: item.adaptationStrength,
  }));

  return (
    <TrendLineChart
      title="Estilo de liderança x contexto atual"
      items={adapted}
        lineAColor="#0f766e"
        lineBColor="#d97706"
        lineCColor="#475569"
      />
  );
}

function CompetencyRadar({ points }: { points: BehaviorCompetencyPoint[] }) {
  const size = 420;
  const center = size / 2;
  const radius = 140;
  const levels = [0.25, 0.5, 0.75, 1];
  const angleStep = (Math.PI * 2) / Math.max(points.length, 1);

  const pointFor = (score: number, index: number) => {
    const angle = -Math.PI / 2 + angleStep * index;
    const distance = (score / 10) * radius;
    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    };
  };

  const polygon = points.map((point, index) => {
    const { x, y } = pointFor(point.score, index);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-center text-4xl font-semibold uppercase tracking-[0.1em] text-slate-900">Competências</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-[520px_minmax(0,1fr)] xl:items-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[420px]">
          {levels.map((level) => {
            const polygonPoints = points.map((_, index) => {
              const angle = -Math.PI / 2 + angleStep * index;
              return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
            }).join(" ");
            return <polygon key={level} points={polygonPoints} fill="none" stroke="#dbe4f0" strokeWidth="1" />;
          })}
          {points.map((point, index) => {
            const angle = -Math.PI / 2 + angleStep * index;
            const labelX = center + Math.cos(angle) * (radius + 26);
            const labelY = center + Math.sin(angle) * (radius + 26);
            return (
              <g key={point.label}>
                <line x1={center} y1={center} x2={labelX} y2={labelY} stroke="#e2e8f0" strokeWidth="1" />
                <text x={labelX} y={labelY} textAnchor="middle" fontSize="11" fill="#475569">
                  {point.label}
                </text>
              </g>
            );
          })}
          <polygon points={polygon} fill="rgba(14,116,144,0.24)" stroke="#0f766e" strokeWidth="3" />
          {points.map((point, index) => {
            const { x, y } = pointFor(point.score, index);
            return <circle key={point.label} cx={x} cy={y} r="4" fill="#0f766e" />;
          })}
        </svg>
        <div className="space-y-3">
          {points.map((point, index) => (
            <div key={point.label} className="rounded-[18px] border border-slate-200 bg-gradient-to-r from-white to-sky-50/30 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{index + 1}. {point.label}</span>
                <span className="text-sm font-semibold text-sky-700">{point.score.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  title,
  text,
  index,
  highlighted,
}: {
  title: string;
  text: string;
  index: number;
  highlighted?: boolean;
}) {
  return (
    <div className={cx("rounded-[24px] border p-5 shadow-sm", highlighted ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white" : "border-slate-200 bg-gradient-to-br from-white to-sky-50/50")}>
      <div className={cx("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", highlighted ? "bg-sky-600 text-white" : "bg-slate-900 text-white")}>
        Insight {index + 1}
      </div>
      <div className="mt-4 text-base font-semibold text-slate-950">{title}</div>
      <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function MiniHistoryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cx("rounded-[22px] border p-4", toneClass)}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none">{value}</div>
    </div>
  );
}

function HistoryDeltaCard({
  item,
}: {
  item: { key: string; label: string; current: number; previous: number; delta: number };
}) {
  const positive = item.delta > 0.15;
  const negative = item.delta < -0.15;
  const tone = positive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : negative
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  const statusLabel = positive ? "Subiu" : negative ? "Caiu" : "Estável";

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cx("text-lg font-semibold", getAxisTextClass(item.key))}>{item.label}</p>
          <p className="mt-1 text-sm text-slate-500">Leitura anterior: {item.previous.toFixed(2)}%</p>
        </div>
        <span className={cx("rounded-full border px-3 py-1 text-xs font-semibold", tone)}>
          {statusLabel} •{" "}
          {item.delta > 0 ? "+" : ""}
          {item.delta.toFixed(2)} p.p.
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{item.current.toFixed(2)}%</div>
      <div className="mt-3 h-2 rounded-full bg-slate-200">
        <div
          className={cx(
            "h-2 rounded-full",
            item.key === "executor" && "bg-amber-600",
            item.key === "comunicador" && "bg-teal-700",
            item.key === "planejador" && "bg-blue-600",
            item.key === "analista" && "bg-slate-600"
          )}
          style={{ width: `${item.current}%` }}
        />
      </div>
    </div>
  );
}

function HistoryTimelineCard({
  item,
  index,
  isLatest,
}: {
  item: BehaviorHistoryItem;
  index: number;
  isLatest?: boolean;
}) {
  const sorted = sortResults(item.self_result ?? []);
  const predominant = summarizePredominance(getPredominantBehaviorAxes(sorted));
  const topAxis = sorted[0];

  return (
    <div className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Leitura {index + 1}
            </span>
            {isLatest ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                Atual
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-950">{predominant}</p>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(item.created_at).toLocaleDateString("pt-BR")} • eixo líder {topAxis?.label ?? "não identificado"}
          </p>
        </div>
        <div className="min-w-[180px]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Distribuição</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            {sorted.map((axis) => (
              <div
                key={axis.key}
                className={cx(
                  "h-2 float-left",
                  axis.key === "executor" && "bg-amber-600",
                  axis.key === "comunicador" && "bg-teal-700",
                  axis.key === "planejador" && "bg-blue-600",
                  axis.key === "analista" && "bg-slate-600"
                )}
                style={{ width: `${axis.percent}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalActionCard({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/30 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="text-base font-semibold text-slate-950">{title}</div>
      <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
      <div className="mt-4 text-sm font-semibold text-sky-700">Abrir área</div>
    </Link>
  );
}

