"use client";

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
      return "text-rose-600";
    case "communicator":
      return "text-amber-500";
    case "planner":
      return "text-emerald-600";
    case "analyst":
      return "text-blue-600";
    default:
      return "text-violet-700";
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
      items.push(`${item.label}: ${item.negativePercent.toFixed(2)}% de fatores de atencao no perfil natural.`);
    }
  }
  for (const item of envCritical) {
    if (item.negativePercent > 0) {
      items.push(`${item.label}: ${item.negativePercent.toFixed(2)}% de tensao percebida na exigencia do meio.`);
    }
  }

  return items.length
    ? items
    : ["Nao foram identificados fatores de atencao relevantes nas selecoes atuais."];
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
      title: "Usar a predominância natural com intencao",
      text: `${personName} tende a operar com maior naturalidade em ${topSelf}. Vale priorizar contextos e entregas em que esse estilo apareca como forca principal, sem perder abertura para ajuste situacional.`,
    },
    {
      title: "Adaptacao ao contexto atual",
      text: `O ambiente hoje puxa mais para ${topEnvironment}. Isso sugere calibrar comunicação, ritmo e forma de decisão para reduzir desgaste sem descaracterizar o perfil natural.`,
    },
    {
      title: "Foco de desenvolvimento",
      text: gap
        ? `A maior diferenca aparece em ${gap.label}. Um plano simples e pratico e observar esse eixo nas proximas semanas e testar pequenas adaptacoes na rotina e na interacao com o time.`
        : "O perfil esta relativamente equilibrado. O proximo passo mais util e manter consistencia nas entregas e observar variacoes ao longo do tempo.",
    },
    {
      title: "Competencias a explorar",
      text: `As competencias com maior potencial nesta leitura sao: ${competenciesText}. Vale usar isso como base para PDI, conversas com gestor e definicao de responsabilidades.`,
    },
  ];
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
        ? `${personName} tende a contribuir combinando ${mainAxis} com ${secondAxis}, o que favorece dinamismo, leitura de contexto e entregas com mais presenca.`
        : `${personName} tende a contribuir com uma presenca mais forte em ${mainAxis}, apoiando o time com consistencia e clareza na forma de atuar.`,
    },
    {
      title: "Onde mais pode gerar valor",
      text: topCompetencies.length
        ? `Os sinais mais fortes desta leitura aparecem em ${topCompetencies.join(", ")}. Essas frentes podem orientar distribuicao de responsabilidades, PDI e projetos de maior aderencia.`
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
          : `${personName} tende a atuar com analise, critÃ©rio e cuidado com estrutura, priorizando clareza, previsibilidade e qualidade.`;

  return {
    subcharacteristics: secondary
      ? `A combinação entre ${primary} e ${secondary} sugere um estilo de atuação com boa complementaridade entre ritmo, comunicaÃ§Ã£o e forma de decisÃ£o.`
      : `A leitura atual mostra uma predominância mais clara em ${primary}, reforcando um estilo de atuação mais reconhecÃ­vel no dia a dia.`,
    basicSkills: `${styleSummary} As competencias mais favorecidas nesta leitura sao ${topCompetencies.slice(0, 3).join(", ")}, o que tende a favorecer entregas com mais aderencia e consistencia.`,
    commonSkills: `No funcionamento cotidiano, esse perfil costuma responder melhor quando existe espaÃ§o para usar ${topCompetencies.slice(0, 4).join(", ")} em situaÃ§Ãµes reais de trabalho, com clareza de expectativa e contexto.`,
  };
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
      description: "Estimativa de intensidade com que o perfil tende a sustentar ritmo, iniciativa e presenÃ§a nas entregas.",
    },
    {
      title: "Exigencia do meio",
      status: largestGap >= 20 ? "Alta" : largestGap >= 12 ? "Moderada" : "Baixa",
      description: "Leitura do quanto o contexto atual estÃ¡ pedindo ajustes alÃ©m do padrÃ£o mais natural de atuação.",
    },
    {
      title: "Aproveitamento",
      status: selfConfidenceLabel === "Confianca alta" ? "Alto" : selfConfidenceLabel === "Confianca media" ? "Consistente" : "Em formaÃ§Ã£o",
      description: "Sinal de quanto o desenho atual da leitura consegue capturar o melhor do perfil percebido.",
    },
    {
      title: "Autoconfiança",
      status: selfConfidenceLabel,
      description: "NÃ­vel de consistência da leitura do perfil natural com base no volume de adjetivos selecionados.",
    },
    {
      title: "Leitura do ambiente",
      status: othersConfidenceLabel,
      description: "SeguranÃ§a da leitura sobre a exigÃªncia atual do contexto, Ãºtil para calibrar adaptaÃ§Ã£o e expectativas.",
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
      description: "HÃ¡ sinais de tensÃ£o comportamental que merecem acompanhamento prÃ³ximo para evitar desgaste ou ruÃ­do relacional.",
    });
  }

  return indicators;
}

export default function MapaComportamentalPage() {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<BehaviorHistoryItem[]>([]);
  const [activeRelease, setActiveRelease] = useState<{
    id: string;
    window_start: string;
    window_end: string;
  } | null>(null);
  const [step, setStep] = useState<Step>(2);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selfSelected, setSelfSelected] = useState<string[]>([]);
  const [othersSelected, setOthersSelected] = useState<string[]>([]);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);

  const personName = firstName(fullName) ?? "O colaborador";
  const canPerformAssessment = !!activeRelease;
  const latestAssessment = history[0] ?? null;
  const reportSelfResults = sortResults(latestAssessment?.self_result ?? []);
  const reportOthersResults = sortResults(latestAssessment?.others_result ?? []);
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
  const openingSummary = useMemo(
    () => buildPredominanceOpeningSummary(personName, reportSelfResults, reportOthersResults),
    [personName, reportSelfResults, reportOthersResults]
  );
  const executiveNarrative = useMemo(
    () => buildExecutiveBehaviorNarrative(personName, reportPredominantSelf, mainCompetencies),
    [personName, reportPredominantSelf, mainCompetencies]
  );
  const situationalIndicators = useMemo(
    () => buildSituationalIndicators(selfConfidence.label, othersConfidence.label, selfFactors, isolatedProfile, mainCompetencies),
    [selfConfidence.label, othersConfidence.label, selfFactors, isolatedProfile, mainCompetencies]
  );

  async function exportReportAsPdf() {
    if (!reportRef.current) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!printWindow) {
      setMsg("Nao foi possivel abrir a janela de impressao. Verifique se o navegador bloqueou pop-up.");
      return;
    }

    const reportHtml = reportRef.current.innerHTML;
    const title = `Relatorio comportamental - ${fullName || "Colaborador"}`;

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
            .print-shell { padding: 24px; }
            .report-page { display: flex; flex-direction: column; gap: 18px; }
            .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%); color: white; border-radius: 24px; padding: 28px; }
            .hero h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.1; }
            .hero p { margin: 0; color: rgba(255,255,255,.84); line-height: 1.6; }
            .grid-4,.grid-3,.grid-2 { display: grid; gap: 14px; }
            .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .card { border: 1px solid #dbe4f0; border-radius: 20px; padding: 18px; background: white; }
            .card-muted { background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%); }
            .eyebrow { margin: 0 0 8px; color: #64748b; font-weight: 700; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; }
            .value { font-size: 28px; line-height: 1.1; font-weight: 700; margin: 0 0 8px; }
            .body { margin: 0; color: #475569; font-size: 13px; line-height: 1.65; }
            .section-title { margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; }
            .section-description { margin: 8px 0 0; color: #475569; line-height: 1.65; font-size: 13px; }
            .axis-bar { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
            .axis-fill { height: 100%; border-radius: 999px; }
            .tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
            .tag { border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.18); color: white; }
            .list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
            .list-item { border: 1px solid #dbe4f0; border-radius: 16px; padding: 12px 14px; background: #f8fafc; color: #475569; font-size: 13px; line-height: 1.6; }
            @page { size: A4; margin: 12mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-shell { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="print-shell">${reportHtml}</div>
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
      setMsg("A avaliacao comportamental nao esta liberada para voce neste momento. Solicite ao RH.");
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

  const showReport = !!latestAssessment;
  const showAssessmentArea = !latestAssessment || showAssessmentForm;

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Relatorio comportamental</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Mapa comportamental</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Uma leitura mais executiva, inspiradora e aplicÃ¡vel do seu estilo de trabalho, da forma como o contexto atual te demanda e dos pontos que mais podem acelerar seu desenvolvimento em equipe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showReport ? (
              <button
                type="button"
                onClick={() => void exportReportAsPdf()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                <Download size={16} />
                Exportar em PDF
              </button>
            ) : null}
            {showReport ? (
              <button
                type="button"
                onClick={() => setShowAssessmentForm((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <RefreshCcw size={16} />
                {showAssessmentForm ? "Fechar atualizacao" : "Atualizar avaliacao"}
              </button>
            ) : null}
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
      </div>

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
                A avaliacao comportamental ainda nao foi liberada pelo RH para o periodo atual.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Assim que o RH liberar a avaliacao dentro de uma janela ativa, o relatorio sera exibido aqui.
              </div>
            </>
          )}

          {showReport ? (
            <section ref={reportRef} className="report-page space-y-6">
              <section id="perfil-predominante" className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="px-8 py-10">
                  <p className="text-center text-xl text-violet-700">Neste momento, {personName} está:</p>
                  <h1 className="mt-2 text-center text-5xl font-semibold tracking-tight text-violet-800">
                    {summarizePredominance(reportPredominantSelf)}
                  </h1>
                  <p className="mt-1 text-center text-lg text-violet-600">
                    em {new Date(latestAssessment.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="mt-8">
                    <PredominanceSpectrum results={reportSelfResults} />
                  </div>
                  <p className="mx-auto mt-8 max-w-5xl text-center text-lg leading-8 text-violet-800/90">
                    {openingSummary}
                  </p>
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-4">
                <ExecutiveSummaryTile
                  title="Confiança do perfil natural"
                  value={selfConfidence.label}
                  description={`${reportSelfSelectedIds.length} adjetivos considerados nesta leitura.`}
                />
                <ExecutiveSummaryTile
                  title="Confiança da exigência do meio"
                  value={othersConfidence.label}
                  description={`${reportOthersSelectedIds.length} adjetivos considerados na leitura do ambiente.`}
                />
                <ExecutiveSummaryTile
                  title="Competência mais favorecida"
                  value={mainCompetencies[0]?.label ?? "Sem leitura"}
                  description="Ponto com maior potencial de entrega e consistencia neste momento."
                />
                <ExecutiveSummaryTile
                  title="Maior ponto de atenção"
                  value={dominantGaps[0]?.label ?? "Sem alerta forte"}
                  description="Eixo que merece observacao para reduzir atrito e desgaste."
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-[28px] border border-amber-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4 text-sm text-violet-800 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>
                      <strong>Leitura principal:</strong> {summarizePredominance(reportPredominantSelf)}. Ambiente atual:{" "}
                      {summarizePredominance(reportPredominantOthers)}.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ProfileTag icon={<Sparkles size={14} />} label={`Confiança do perfil: ${selfConfidence.label}`} />
                      <ProfileTag icon={<TrendingUp size={14} />} label={`Leitura em ${new Date(latestAssessment.created_at).toLocaleDateString("pt-BR")}`} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Atalhos</p>
                  <div className="mt-4 space-y-2">
                    <a href="#perfil-predominante" className="block rounded-2xl bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-800">Perfil predominante</a>
                    <a href="#subcaracteristicas" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Subcaracterísticas</a>
                    <a href="#perfil-natural-x-meio" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Habilidades básicas</a>
                    <a href="#indicadores-situacionais" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Indicadores situacionais</a>
                    <a href="#perfil-isolado" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Perfil isolado</a>
                    <a href="#lideranca" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Liderança atual</a>
                    <a href="#competencias" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Competências</a>
                    <a href="#recomendacoes" className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">Área de talentos</a>
                  </div>
                </div>
              </div>

              <section id="subcaracteristicas" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/30 p-6 shadow-sm">
                <SectionHeader
                  title="Leitura executiva do comportamento"
                  description="Síntese mais próxima de um relatório corporativo, com leitura editorial para entendimento rápido e aplicação prática."
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

              <section id="perfil-natural-x-meio" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
                <SectionHeader
                  title="Perfil natural e exigência do meio"
                  description="Comparativo visual entre como voce tende a atuar e o que o ambiente atual mais exige, com leitura mais corporativa e direta."
                />
                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <ResultCard
                    title="Perfil natural"
                    icon={<User2 size={16} />}
                    personName={personName}
                    results={reportSelfResults}
                    predominant={reportPredominantSelf}
                    accentClass="from-amber-50 via-white to-rose-50"
                  />
                  <ResultCard
                    title="Exigência do meio"
                    icon={<Users size={16} />}
                    personName={personName}
                    results={reportOthersResults}
                    predominant={reportPredominantOthers}
                    accentClass="from-blue-50 via-white to-sky-50"
                  />
                </div>
              </section>

              <section id="perfil-isolado" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/20 p-6 shadow-sm">
                <SectionHeader
                  title="Adaptação ao contexto"
                  description="O quanto cada eixo esta sendo puxado ou comprimido pelo ambiente atual. Isso ajuda a perceber onde existe energia natural e onde existe ajuste mais intenso."
                />
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {isolatedProfile.map((item) => (
                    <AdaptationCard key={item.key} point={item} />
                  ))}
                </div>
              </section>

              <section id="indicadores-situacionais" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-amber-50/30 p-6 shadow-sm">
                <SectionHeader
                  title="Indicadores situacionais"
                  description="Leitura resumida de energia, flexibilidade, confiança e pressão do contexto, em uma linguagem mais gerencial."
                />
                <div className="mt-6 space-y-5">
                  {situationalIndicators.map((item) => (
                    <SituationalIndicatorRow key={item.title} title={item.title} status={item.status} description={item.description} />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/20 p-6 shadow-sm">
                <SectionHeader
                  title="Leitura comparativa por eixo"
                  description="Visual comparativo entre o perfil natural e a exigencia percebida do ambiente, para facilitar conversas de calibragem e encaixe no time."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {reportSelfResults.map((item) => {
                    const environment = reportOthersResults.find((entry) => entry.key === item.key);
                    return <AxisComparisonCard key={item.key} current={item} environment={environment} />;
                  })}
                </div>
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <TrendLineChart
                    title="Perfil isolado"
                    items={isolatedProfile}
                    lineAColor="#7c3aed"
                    lineBColor="#ef4444"
                    lineCColor="#334155"
                  />
                  <LeadershipLineChart items={leadershipProfile} />
                </div>
              </section>

              <section id="competencias" className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-sky-50/20 p-6 shadow-sm">
                <SectionHeader
                  title="Competências comportamentais"
                  description="Potenciais mais favorecidos a partir da combinação entre perfil natural, exigência do meio e estilo de condução."
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
                  title="Pontos de atenção"
                  description="Sinais de observacao para apoiar conversas com liderança, distribuicao de demandas e calibragem da forma de trabalho."
                />
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <AttentionPanel
                    title="Principais desvios de adaptacao"
                    items={dominantGaps.map((item) => `${item.label}: diferenca de ${Math.abs(item.environmentDemand - item.profileCurrent).toFixed(2)} pontos entre perfil atual e demanda do meio.`)}
                  />
                  <AttentionPanel
                    title="Fatores de observação"
                    items={buildFactorAttention(selfFactors, othersFactors)}
                  />
                </div>
              </section>

              <section id="lideranca" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  title="Estilo de liderança"
                  description="Leitura sintética da forma mais provável de conduzir, comunicar expectativa e influenciar o time a partir do momento atual."
                />
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {leadershipProfile.map((item) => (
                    <LeadershipCard key={item.key} point={item} />
                  ))}
                </div>
              </section>

              <section id="recomendacoes" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  title="Recomendações práticas"
                  description="Uma leitura mais motivadora e aplicável para apoiar desenvolvimento individual, combinação com o time e alinhamento com a liderança."
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
            </section>
          ) : null}

          {showAssessmentArea ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {step === 2
                    ? "Marque os adjetivos que melhor te representam"
                    : "Agora marque como os outros pensam que voce deveria ser"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Nao existem respostas certas. O objetivo e identificar predominância relativa entre os perfis.
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
              O relatorio completo sera exibido apos a conclusao do envio, com os graficos e analises finais.
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
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Relatorio</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</div>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function PredominanceSpectrum({ results }: { results: BehaviorAxisResult[] }) {
  const palette: Record<string, { segment: string; text: string }> = {
    executor: { segment: "#E36A2E", text: "text-orange-600" },
    communicator: { segment: "#0EA5A3", text: "text-teal-600" },
    planner: { segment: "#6D5BD0", text: "text-violet-600" },
    analyst: { segment: "#2563EB", text: "text-blue-600" },
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
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/30 p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">{title}</div>
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
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/30 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">{title}</p>
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
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/20 p-5 shadow-sm">
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
        <p className="text-[28px] font-semibold tracking-tight text-violet-800">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-700">{status}</div>
        <div className="mt-2 h-2 rounded-full bg-violet-100">
          <div className="h-2 rounded-full bg-violet-700" style={{ width: `${width}%` }} />
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
      <div className="text-xl font-semibold text-violet-800">{index + 1}</div>
      <div className="text-[30px] font-semibold tracking-tight text-violet-800">{point.label}</div>
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-violet-700">{level}</div>
        <div className="mt-2 h-2 rounded-full bg-violet-100">
          <div
            className={cx(
              "h-2 rounded-full bg-violet-700",
              highlight && "bg-violet-800"
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
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/20 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-950">{point.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Forca de adaptacao</p>
        </div>
        <span className="text-lg font-semibold text-slate-950">{signedValue(point.adaptationStrength)}</span>
      </div>
      <div className="mt-4 h-2.5 rounded-full bg-slate-200">
        <div className="h-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-blue-700" style={{ width: `${intensity}%` }} />
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <MetricRow label="Perfil atual" value={signedValue(point.profileCurrent)} />
        <MetricRow label="Exigencia do meio" value={signedValue(point.environmentDemand)} />
      </div>
    </div>
  );
}

function LeadershipCard({ point }: { point: BehaviorLeadershipPoint }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-violet-50/20 p-4 shadow-sm">
      <p className="text-lg font-semibold text-slate-950">{point.label}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <MetricRow label="Natural" value={signedValue(point.profileCurrent)} />
        <MetricRow label="Ambiente" value={signedValue(point.environmentDemand)} />
        <MetricRow label="Forca de adaptacao" value={signedValue(point.adaptationStrength)} strong />
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
            <span>Exigencia do meio</span>
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
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: lineBColor }} /> Exigencia do meio</span>
        <span className="inline-flex items-center gap-2"><span className="h-0 w-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent" style={{ borderBottomColor: lineCColor }} /> Forca de adaptacao</span>
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
      title="Estilo de lideranÃ§a x contexto atual"
      items={adapted}
        lineAColor="#6d28d9"
        lineBColor="#fb7185"
        lineCColor="#334155"
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
      <p className="text-center text-4xl font-semibold uppercase tracking-[0.1em] text-violet-800">Competências</p>
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
          <polygon points={polygon} fill="rgba(124,58,237,0.32)" stroke="#7c3aed" strokeWidth="3" />
          {points.map((point, index) => {
            const { x, y } = pointFor(point.score, index);
            return <circle key={point.label} cx={x} cy={y} r="4" fill="#7c3aed" />;
          })}
        </svg>
        <div className="space-y-3">
          {points.map((point, index) => (
            <div key={point.label} className="rounded-[18px] border border-slate-200 bg-gradient-to-r from-white to-violet-50/40 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">{index + 1}. {point.label}</span>
                <span className="text-sm font-semibold text-violet-700">{point.score.toFixed(2)}</span>
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

