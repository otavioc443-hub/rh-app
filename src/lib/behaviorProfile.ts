export type BehaviorAxisKey = "executor" | "comunicador" | "planejador" | "analista";

export type BehaviorClassification =
  | "predominancia_muito_elevada"
  | "predominancia_elevada"
  | "presenca_complementar"
  | "presenca_de_apoio";

export type BehaviorWeights = Record<BehaviorAxisKey, number>;

export type BehaviorAdjective = {
  id: string;
  label: string;
  weights: BehaviorWeights;
  attention?: boolean;
};

export type BehaviorAxisResult = {
  key: BehaviorAxisKey;
  label: string;
  score: number;
  percent: number;
  classification: BehaviorClassification;
  isPredominant: boolean;
};

export type BehaviorFactorResult = {
  key: BehaviorAxisKey;
  label: string;
  positiveScore: number;
  negativeScore: number;
  positivePercent: number;
  negativePercent: number;
};

export type BehaviorIsolatedProfilePoint = {
  key: BehaviorAxisKey;
  label: string;
  profileCurrent: number;
  environmentDemand: number;
  adaptationStrength: number;
};

export type BehaviorLeadershipKey =
  | "dominante"
  | "informal"
  | "condescendente"
  | "formal";

export type BehaviorLeadershipPoint = {
  key: BehaviorLeadershipKey;
  label: string;
  profileCurrent: number;
  environmentDemand: number;
  adaptationStrength: number;
};

export type BehaviorCompetencyPoint = {
  order: number;
  label: string;
  score: number;
};

export type BehaviorConfidenceLevel = "baixa" | "media" | "alta";

export const BEHAVIOR_AXIS_META: Record<
  BehaviorAxisKey,
  { label: string; shortLabel: string; colorClass: string; chipClass: string }
> = {
  executor: {
    label: "Executor",
    shortLabel: "Execucao",
    colorClass: "bg-rose-600",
    chipClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
  comunicador: {
    label: "Comunicador",
    shortLabel: "Comunicacao",
    colorClass: "bg-amber-500",
    chipClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  planejador: {
    label: "Planejador",
    shortLabel: "Planejamento",
    colorClass: "bg-emerald-600",
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  analista: {
    label: "Analista",
    shortLabel: "Analise",
    colorClass: "bg-blue-600",
    chipClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
};

const BEHAVIOR_AXIS_PERCENT_CALIBRATION: Record<
  BehaviorAxisKey,
  { slope: number; intercept: number }
> = {
  executor: { slope: 1.055199905925003, intercept: -1.3564667280949396 },
  comunicador: { slope: 1.044456859978481, intercept: -0.6661512478682913 },
  planejador: { slope: 0.9606286380407641, intercept: 0.8582422425603998 },
  analista: { slope: 1.0203836265656867, intercept: -0.5060688183401639 },
};

function weights(
  executor: number,
  comunicador: number,
  planejador: number,
  analista: number
): BehaviorWeights {
  return { executor, comunicador, planejador, analista };
}

function normalizePercentMap(values: Record<BehaviorAxisKey, number>) {
  const nonNegative: Record<BehaviorAxisKey, number> = {
    executor: Math.max(0, values.executor),
    comunicador: Math.max(0, values.comunicador),
    planejador: Math.max(0, values.planejador),
    analista: Math.max(0, values.analista),
  };
  const sum =
    nonNegative.executor +
    nonNegative.comunicador +
    nonNegative.planejador +
    nonNegative.analista;
  if (sum <= 0) {
    return {
      executor: 25,
      comunicador: 25,
      planejador: 25,
      analista: 25,
    } as Record<BehaviorAxisKey, number>;
  }

  return {
    executor: (nonNegative.executor / sum) * 100,
    comunicador: (nonNegative.comunicador / sum) * 100,
    planejador: (nonNegative.planejador / sum) * 100,
    analista: (nonNegative.analista / sum) * 100,
  } as Record<BehaviorAxisKey, number>;
}

export const BEHAVIOR_ADJECTIVES: BehaviorAdjective[] = [
  { id: "alegre", label: "Alegre", weights: weights(0, 2, 1, 1) },
  { id: "animado", label: "Animado", weights: weights(0, 2, 1, 0) },
  { id: "anti_social", label: "Anti-Social", weights: weights(0, 0, 1, 2), attention: true },
  { id: "arrogante", label: "Arrogante", weights: weights(2, 0, 0, 1), attention: true },
  { id: "ativo", label: "Ativo", weights: weights(2, 0, 0, 0) },
  { id: "audacioso", label: "Audacioso (Ousado)", weights: weights(3, 0, 0, 0) },
  { id: "auto_disciplinado", label: "Auto-Disciplinado", weights: weights(0, 0, 2, 1) },
  { id: "auto_suficiente", label: "Auto-Suficiente", weights: weights(3, 3, 3, 0) },
  { id: "barulhento", label: "Barulhento", weights: weights(3, 0, 0, 0), attention: true },
  { id: "bem_humorado", label: "Bem-Humorado", weights: weights(0, 2, 1, 0) },
  { id: "bem_quisto", label: "Bem-Quisto", weights: weights(1, 1, 0, 0) },
  { id: "bom_companheiro", label: "Bom Companheiro", weights: weights(0, 1, 2, 0) },
  { id: "calculista", label: "Calculista", weights: weights(1, 0, 0, 2) },
  { id: "calmo", label: "Calmo", weights: weights(0, 0, 1, 2) },
  { id: "compreensivo", label: "Compreensivo", weights: weights(0, 2, 1, 0) },
  { id: "comunicativo", label: "Comunicativo", weights: weights(0, 3, 0, 0) },
  { id: "conservador", label: "Conservador", weights: weights(0, 0, 2, 1) },
  { id: "contagiante", label: "Contagiante", weights: weights(1, 0, 2, 1) },
  { id: "corajoso", label: "Corajoso", weights: weights(2, 1, 0, 0) },
  { id: "critico", label: "Critico", weights: weights(2, 0, 1, 1) },
  { id: "cumpridor", label: "Cumpridor", weights: weights(1, 0, 2, 0) },
  { id: "decidido", label: "Decidido", weights: weights(3, 0, 0, 0) },
  { id: "dedicado", label: "Dedicado", weights: weights(0, 0, 2, 1) },
  { id: "depressivo", label: "Depressivo", weights: weights(0, 0, 1, 1), attention: true },
  { id: "desconfiado", label: "Desconfiado", weights: weights(0, 0, 0, 2), attention: true },
  { id: "desmotivado", label: "Desmotivado", weights: weights(0, 0, 1, 1), attention: true },
  { id: "desorganizado", label: "Desorganizado", weights: weights(1, 1, 0, 0), attention: true },
  { id: "destacado", label: "Destacado", weights: weights(1, 2, 0, 0) },
  { id: "discreto", label: "Discreto", weights: weights(0, 0, 1, 2) },
  { id: "eficiente", label: "Eficiente", weights: weights(2, 0, 0, 1) },
  { id: "egocentrico", label: "Egocentrico", weights: weights(0, 1, 2, 0), attention: true },
  { id: "egoista", label: "Egoista", weights: weights(1, 0, 0, 1), attention: true },
  { id: "empolgante", label: "Empolgante", weights: weights(0, 3, 0, 3) },
  { id: "energico", label: "Energetico", weights: weights(2, 1, 0, 0) },
  { id: "entusiasta", label: "Entusiasta", weights: weights(2, 2, 0, 0) },
  { id: "equilibrado", label: "Equilibrado", weights: weights(0, 0, 2, 0) },
  { id: "espalhafatoso", label: "Espalhafatoso", weights: weights(1, 2, 0, 0), attention: true },
  { id: "estimulante", label: "Estimulante", weights: weights(1, 2, 0, 0) },
  { id: "exagerado", label: "Exagerado", weights: weights(1, 1, 0, 0), attention: true },
  { id: "exigente", label: "Exigente", weights: weights(2, 0, 0, 1) },
  { id: "extrovertido", label: "Extrovertido", weights: weights(0, 3, 0, 0) },
  { id: "exuberante", label: "Exuberante", weights: weights(1, 2, 0, 0) },
  { id: "firme", label: "Firme", weights: weights(1, 0, 2, 0) },
  { id: "frio", label: "Frio", weights: weights(2, 0, 0, 1), attention: true },
  { id: "habilidoso", label: "Habilidoso", weights: weights(2, 0, 0, 1) },
  { id: "idealista", label: "Idealista", weights: weights(0, 0, 1, 2) },
  { id: "impaciente", label: "Impaciente", weights: weights(2, 0, 0, 1), attention: true },
  { id: "indeciso", label: "Indeciso", weights: weights(0, 0, 2, 1), attention: true },
  { id: "independente", label: "Independente", weights: weights(2, 0, 0, 1) },
  { id: "indisciplinado", label: "Indisciplinado", weights: weights(1, 1, 0, 0), attention: true },
  { id: "inflexivel", label: "Inflexivel", weights: weights(2, 0, 3, 0), attention: true },
  { id: "influenciador", label: "Influenciador", weights: weights(1, 2, 0, 0) },
  { id: "ingenuo", label: "Ingenuo", weights: weights(1, 2, 3, 0), attention: true },
  { id: "inseguro", label: "Inseguro", weights: weights(0, 0, 0, 1), attention: true },
  { id: "insensivel", label: "Insensivel", weights: weights(1, 0, 0, 2), attention: true },
  { id: "intolerante", label: "Intolerante", weights: weights(1, 0, 0, 2), attention: true },
  { id: "introvertido", label: "Introvertido", weights: weights(0, 2, 3, 3) },
  { id: "leal", label: "Leal", weights: weights(0, 0, 1, 1) },
  { id: "lider", label: "Lider", weights: weights(2, 1, 0, 0) },
  { id: "medroso", label: "Medroso", weights: weights(0, 0, 1, 1), attention: true },
  { id: "metodico", label: "Metodico", weights: weights(0, 0, 1, 2) },
  { id: "minucioso", label: "Minucioso", weights: weights(1, 0, 0, 1) },
  { id: "modesto", label: "Modesto", weights: weights(0, 0, 1, 1) },
  { id: "orgulhoso", label: "Orgulhoso", weights: weights(2, 0, 0, 1), attention: true },
  { id: "otimista", label: "Otimista", weights: weights(0, 2, 0, 1) },
  { id: "paciente", label: "Paciente", weights: weights(0, 0, 3, 0) },
  { id: "perfeccionista", label: "Perfeccionista", weights: weights(0, 0, 0, 2) },
  { id: "persistente", label: "Persistente", weights: weights(2, 0, 1, 0) },
  { id: "pessimista", label: "Pessimista", weights: weights(0, 3, 3, 0), attention: true },
  { id: "popular", label: "Popular", weights: weights(0, 3, 0, 0) },
  { id: "pratico", label: "Pratico", weights: weights(1, 0, 2, 0) },
  { id: "pretensioso", label: "Pretensioso", weights: weights(2, 1, 0, 0), attention: true },
  { id: "procrastinador", label: "Procrastinador", weights: weights(0, 0, 3, 3), attention: true },
  { id: "racional", label: "Racional", weights: weights(1, 0, 0, 2) },
  { id: "reservado", label: "Reservado", weights: weights(0, 0, 0, 3) },
  { id: "resoluto", label: "Resoluto (Decidido)", weights: weights(1, 0, 1, 1) },
  { id: "rotineiro", label: "Rotineiro", weights: weights(0, 0, 2, 1) },
  { id: "sarcastico", label: "Sarcastico", weights: weights(0, 1, 3, 2), attention: true },
  { id: "sensivel", label: "Sensivel", weights: weights(1, 1, 1, 0) },
  { id: "sentimental", label: "Sentimental", weights: weights(0, 0, 2, 1) },
  { id: "simpatico", label: "Simpatico", weights: weights(0, 2, 0, 1) },
  { id: "sincero", label: "Sincero", weights: weights(1, 2, 1, 3) },
  { id: "temeroso", label: "Temeroso", weights: weights(0, 2, 1, 0), attention: true },
  { id: "teorico", label: "Teorico", weights: weights(0, 0, 1, 2) },
  { id: "tranquilo", label: "Tranquilo", weights: weights(0, 0, 2, 1) },
  { id: "vaidoso", label: "Vaidoso", weights: weights(2, 2, 0, 1), attention: true },
  { id: "vingativo", label: "Vingativo", weights: weights(2, 0, 0, 1), attention: true },
];

export function classifyBehaviorPercent(percent: number): BehaviorClassification {
  if (percent >= 30) return "predominancia_muito_elevada";
  if (percent >= 25) return "predominancia_elevada";
  if (percent >= 20) return "presenca_complementar";
  return "presenca_de_apoio";
}

export function getBehaviorClassificationLabel(classification: BehaviorClassification) {
  if (classification === "predominancia_muito_elevada") return "Predominancia muito elevada";
  if (classification === "predominancia_elevada") return "Predominancia elevada";
  if (classification === "presenca_complementar") return "Presenca complementar";
  return "Presenca de apoio";
}

export function getBehaviorConfidence(selectedCount: number): {
  level: BehaviorConfidenceLevel;
  label: string;
  description: string;
  reliability: number;
} {
  if (selectedCount <= 13) {
    return {
      level: "baixa",
      label: "Confianca baixa",
      description: "Amostragem reduzida. O resultado e valido, mas mais sensivel a variacoes.",
      reliability: 0.5,
    };
  }
  if (selectedCount <= 24) {
    return {
      level: "media",
      label: "Confianca media",
      description: "Amostragem moderada. O resultado tende a estabilidade intermediaria.",
      reliability: 0.75,
    };
  }

  return {
    level: "alta",
    label: "Confianca alta",
    description: "Amostragem ampla. O resultado tende a maior estabilidade.",
    reliability: 1,
  };
}

export function calculateBehaviorAxisResults(selectedIds: string[]): BehaviorAxisResult[] {
  const found = BEHAVIOR_ADJECTIVES.filter((item) => selectedIds.includes(item.id));
  const totals: BehaviorWeights = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };

  for (const item of found) {
    totals.executor += item.weights.executor;
    totals.comunicador += item.weights.comunicador;
    totals.planejador += item.weights.planejador;
    totals.analista += item.weights.analista;
  }
  const grandTotal =
    totals.executor + totals.comunicador + totals.planejador + totals.analista || 1;
  const rawPercents: Record<BehaviorAxisKey, number> = {
    executor: (totals.executor / grandTotal) * 100,
    comunicador: (totals.comunicador / grandTotal) * 100,
    planejador: (totals.planejador / grandTotal) * 100,
    analista: (totals.analista / grandTotal) * 100,
  };
  const calibratedPercents = normalizePercentMap({
    executor:
      rawPercents.executor * BEHAVIOR_AXIS_PERCENT_CALIBRATION.executor.slope +
      BEHAVIOR_AXIS_PERCENT_CALIBRATION.executor.intercept,
    comunicador:
      rawPercents.comunicador * BEHAVIOR_AXIS_PERCENT_CALIBRATION.comunicador.slope +
      BEHAVIOR_AXIS_PERCENT_CALIBRATION.comunicador.intercept,
    planejador:
      rawPercents.planejador * BEHAVIOR_AXIS_PERCENT_CALIBRATION.planejador.slope +
      BEHAVIOR_AXIS_PERCENT_CALIBRATION.planejador.intercept,
    analista:
      rawPercents.analista * BEHAVIOR_AXIS_PERCENT_CALIBRATION.analista.slope +
      BEHAVIOR_AXIS_PERCENT_CALIBRATION.analista.intercept,
  });

  return (Object.keys(BEHAVIOR_AXIS_META) as BehaviorAxisKey[]).map((key) => {
    const score = totals[key];
    const percent = Number(calibratedPercents[key].toFixed(2));
    return {
      key,
      label: BEHAVIOR_AXIS_META[key].label,
      score,
      percent,
      classification: classifyBehaviorPercent(percent),
      isPredominant: percent >= 25,
    };
  });
}

export function calculateBehaviorFactorResults(selectedIds: string[]): BehaviorFactorResult[] {
  const found = BEHAVIOR_ADJECTIVES.filter((item) => selectedIds.includes(item.id));
  const positiveTotals: BehaviorWeights = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };
  const negativeTotals: BehaviorWeights = { executor: 0, comunicador: 0, planejador: 0, analista: 0 };

  for (const item of found) {
    const target = item.attention ? negativeTotals : positiveTotals;
    target.executor += item.weights.executor;
    target.comunicador += item.weights.comunicador;
    target.planejador += item.weights.planejador;
    target.analista += item.weights.analista;
  }

  return (Object.keys(BEHAVIOR_AXIS_META) as BehaviorAxisKey[]).map((key) => {
    const positiveScore = positiveTotals[key];
    const negativeScore = negativeTotals[key];
    const total = positiveScore + negativeScore || 1;
    return {
      key,
      label: BEHAVIOR_AXIS_META[key].label,
      positiveScore,
      negativeScore,
      positivePercent: Number(((positiveScore / total) * 100).toFixed(2)),
      negativePercent: Number(((negativeScore / total) * 100).toFixed(2)),
    };
  });
}

export function combineBehaviorAxisResults(
  primary: BehaviorAxisResult[],
  secondary: BehaviorAxisResult[],
  primaryWeight = 0.7
): BehaviorAxisResult[] {
  const secondaryWeight = 1 - primaryWeight;
  return (Object.keys(BEHAVIOR_AXIS_META) as BehaviorAxisKey[]).map((key) => {
    const primaryItem = primary.find((item) => item.key === key);
    const secondaryItem = secondary.find((item) => item.key === key);
    const score = Number(
      (((primaryItem?.score ?? 0) * primaryWeight) + ((secondaryItem?.score ?? 0) * secondaryWeight)).toFixed(2)
    );
    const percent = Number(
      (((primaryItem?.percent ?? 0) * primaryWeight) + ((secondaryItem?.percent ?? 0) * secondaryWeight)).toFixed(2)
    );

    return {
      key,
      label: BEHAVIOR_AXIS_META[key].label,
      score,
      percent,
      classification: classifyBehaviorPercent(percent),
      isPredominant: percent >= 25,
    };
  });
}

export function calculateBehaviorIsolatedProfile(
  selfResults: BehaviorAxisResult[],
  othersResults: BehaviorAxisResult[]
): BehaviorIsolatedProfilePoint[] {
  return (Object.keys(BEHAVIOR_AXIS_META) as BehaviorAxisKey[]).map((key) => {
    const self = selfResults.find((item) => item.key === key)?.percent ?? 25;
    const others = othersResults.find((item) => item.key === key)?.percent ?? 25;

    return {
      key,
      label: BEHAVIOR_AXIS_META[key].label,
      profileCurrent: Number((self - 25).toFixed(2)),
      environmentDemand: Number((others - 25).toFixed(2)),
      // Keeps the adaptation line readable and centered between self and demand,
      // with more weight on the person's natural profile.
      adaptationStrength: Number((((self * 2 + others) / 3) - 25).toFixed(2)),
    };
  });
}

export function calculateBehaviorLeadershipProfile(
  selfResults: BehaviorAxisResult[],
  othersResults: BehaviorAxisResult[]
): BehaviorLeadershipPoint[] {
  const selfMap = Object.fromEntries(selfResults.map((item) => [item.key, item.percent])) as Record<
    BehaviorAxisKey,
    number
  >;
  const othersMap = Object.fromEntries(
    othersResults.map((item) => [item.key, item.percent])
  ) as Record<BehaviorAxisKey, number>;

  function derive(source: Record<BehaviorAxisKey, number>) {
    return {
      dominante: Number((((source.executor * 0.7) + (source.comunicador * 0.3)) - 25).toFixed(2)),
      informal: Number((((source.comunicador * 0.65) + (source.planejador * 0.35)) - 25).toFixed(2)),
      condescendente: Number((((source.planejador * 0.6) + (source.analista * 0.4)) - 25).toFixed(2)),
      formal: Number((((source.analista * 0.7) + (source.executor * 0.3)) - 25).toFixed(2)),
    };
  }

  const current = derive(selfMap);
  const demand = derive(othersMap);

  return [
    { key: "dominante", label: "Dominante", profileCurrent: current.dominante, environmentDemand: demand.dominante, adaptationStrength: Number((((current.dominante * 2) + demand.dominante) / 3).toFixed(2)) },
    { key: "informal", label: "Informal", profileCurrent: current.informal, environmentDemand: demand.informal, adaptationStrength: Number((((current.informal * 2) + demand.informal) / 3).toFixed(2)) },
    { key: "condescendente", label: "Condescendente", profileCurrent: current.condescendente, environmentDemand: demand.condescendente, adaptationStrength: Number((((current.condescendente * 2) + demand.condescendente) / 3).toFixed(2)) },
    { key: "formal", label: "Formal", profileCurrent: current.formal, environmentDemand: demand.formal, adaptationStrength: Number((((current.formal * 2) + demand.formal) / 3).toFixed(2)) },
  ];
}

export function calculateBehaviorCompetencies(
  consolidatedResults: BehaviorAxisResult[],
  factorResults: BehaviorFactorResult[],
  leadershipResults: BehaviorLeadershipPoint[]
): BehaviorCompetencyPoint[] {
  const consolidated = Object.fromEntries(
    consolidatedResults.map((item) => [item.key, item.percent / 10])
  ) as Record<BehaviorAxisKey, number>;
  const factors = Object.fromEntries(
    factorResults.map((item) => [item.key, (item.positivePercent - item.negativePercent) / 20])
  ) as Record<BehaviorAxisKey, number>;
  const leadership = Object.fromEntries(
    leadershipResults.map((item) => [item.key, item.adaptationStrength / 10])
  ) as Record<BehaviorLeadershipKey, number>;

  const metric = (value: number) => Number(Math.max(2.5, Math.min(9.5, value)).toFixed(2));

  return [
    { order: 1, label: "Tolerancia", score: metric(5 + consolidated.planejador * 0.5 + factors.planejador * 0.4) },
    { order: 2, label: "Planejamento", score: metric(5 + consolidated.planejador * 0.8 + leadership.formal * 0.3) },
    { order: 3, label: "Empatia", score: metric(5 + consolidated.comunicador * 0.5 + consolidated.planejador * 0.3 + factors.comunicador * 0.3) },
    { order: 4, label: "Capacidade de ouvir", score: metric(5 + consolidated.planejador * 0.4 + consolidated.analista * 0.4) },
    { order: 5, label: "Concentracao", score: metric(5 + consolidated.analista * 0.7 + leadership.formal * 0.2) },
    { order: 6, label: "Condescendencia", score: metric(5 + consolidated.planejador * 0.5 + leadership.condescendente * 0.5) },
    { order: 7, label: "Perfil Tecnico", score: metric(5 + consolidated.analista * 0.8 + factors.analista * 0.3) },
    { order: 8, label: "Organizacao", score: metric(5 + consolidated.analista * 0.5 + consolidated.planejador * 0.5) },
    { order: 9, label: "Detalhismo", score: metric(5 + consolidated.analista * 0.8) },
    { order: 10, label: "Rigorosidade", score: metric(5 + consolidated.analista * 0.7 + leadership.formal * 0.3) },
    { order: 11, label: "Orientado por resultado", score: metric(5 + consolidated.executor * 0.8 + leadership.dominante * 0.2) },
    { order: 12, label: "Multitarefas", score: metric(5 + consolidated.executor * 0.4 + consolidated.comunicador * 0.4) },
    { order: 13, label: "Automotivacao", score: metric(5 + consolidated.executor * 0.7 + factors.executor * 0.2) },
    { order: 14, label: "Proatividade", score: metric(5 + consolidated.executor * 0.7 + consolidated.comunicador * 0.2) },
    { order: 15, label: "Dinamismo", score: metric(5 + consolidated.executor * 0.5 + consolidated.comunicador * 0.5) },
    { order: 16, label: "Dominancia", score: metric(5 + leadership.dominante * 0.8 + consolidated.executor * 0.3) },
    { order: 17, label: "Extroversao", score: metric(5 + consolidated.comunicador * 0.8 + leadership.informal * 0.2) },
    { order: 18, label: "Relacionamento interpessoal", score: metric(5 + consolidated.comunicador * 0.6 + consolidated.planejador * 0.2) },
    { order: 19, label: "Sociabilidade", score: metric(5 + consolidated.comunicador * 0.8 + factors.comunicador * 0.2) },
    { order: 20, label: "Orientado por relacionamento", score: metric(5 + consolidated.comunicador * 0.5 + consolidated.planejador * 0.4) },
  ];
}

export function getPredominantBehaviorAxes(results: BehaviorAxisResult[]) {
  return results
    .filter((item) => item.isPredominant)
    .sort((a, b) => b.percent - a.percent || b.score - a.score);
}

export function getBehaviorSummaryLine(results: BehaviorAxisResult[], personName = "O colaborador") {
  const predominant = getPredominantBehaviorAxes(results);
  if (!predominant.length) {
    const highest = [...results].sort((a, b) => b.percent - a.percent)[0];
    return `${personName} apresenta maior presenca relativa em ${highest.label} neste momento.`;
  }

  if (predominant.length === 1) {
    return `${personName} apresenta predominancia principal em ${predominant[0].label} neste momento.`;
  }

  if (predominant.length === 2) {
    return `${personName} apresenta predominancia combinada em ${predominant[0].label} e ${predominant[1].label} neste momento.`;
  }

  return `${personName} apresenta uma composicao distribuida, com multiplos perfis predominantes neste momento.`;
}

export function getBehaviorAttentionCount(selectedIds: string[]) {
  return BEHAVIOR_ADJECTIVES.filter((item) => item.attention && selectedIds.includes(item.id)).length;
}
