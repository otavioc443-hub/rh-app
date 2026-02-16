"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";

type CollaboratorOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CycleInfo = {
  id: string;
  name: string;
  collect_start: string;
  collect_end: string;
  release_start: string;
  release_end: string;
  active: boolean;
};

type TechnicalKey = "entrega" | "qualidade" | "autonomia" | "organizacao" | "responsabilidade";
type BehaviorKey =
  | "comunicacao"
  | "trabalho_equipe"
  | "postura"
  | "proatividade"
  | "adaptabilidade"
  | "inteligencia_emocional";

const TECHNICAL: Array<{ key: TechnicalKey; label: string }> = [
  { key: "entrega", label: "Entrega" },
  { key: "qualidade", label: "Qualidade" },
  { key: "autonomia", label: "Autonomia" },
  { key: "organizacao", label: "Organizacao" },
  { key: "responsabilidade", label: "Responsabilidade" },
];

const BEHAVIORAL: Array<{ key: BehaviorKey; label: string }> = [
  { key: "comunicacao", label: "Comunicacao clara e objetiva" },
  { key: "trabalho_equipe", label: "Trabalho em equipe" },
  { key: "postura", label: "Postura profissional" },
  { key: "proatividade", label: "Proatividade" },
  { key: "adaptabilidade", label: "Adaptabilidade a mudancas" },
  { key: "inteligencia_emocional", label: "Inteligencia emocional" },
];

const IMPACT_OPTIONS = [
  "Muito acima do esperado",
  "Acima do esperado",
  "Dentro do esperado",
  "Abaixo do esperado",
  "Critico",
] as const;

const EVOLUTION_OPTIONS = [
  "Evoluiu significativamente",
  "Evoluiu moderadamente",
  "Manteve desempenho",
  "Apresentou regressao",
] as const;

function classification(finalScore: number) {
  if (finalScore >= 9) return "Destaque";
  if (finalScore >= 7) return "Bom desempenho";
  if (finalScore >= 5) return "Atencao";
  return "Critico";
}

export default function CoordenadorFeedbackPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaboratorOption[]>([]);

  const [targetUserId, setTargetUserId] = useState("");

  const [technical, setTechnical] = useState<Record<TechnicalKey, number>>({
    entrega: 0,
    qualidade: 0,
    autonomia: 0,
    organizacao: 0,
    responsabilidade: 0,
  });

  const [behavioral, setBehavioral] = useState<Record<BehaviorKey, number>>({
    comunicacao: 0,
    trabalho_equipe: 0,
    postura: 0,
    proatividade: 0,
    adaptabilidade: 0,
    inteligencia_emocional: 0,
  });

  const [impactResult, setImpactResult] = useState<string>("Dentro do esperado");
  const [impactEvidence, setImpactEvidence] = useState("");

  const [evolutionResult, setEvolutionResult] = useState<string>("Manteve desempenho");
  const [evolutionChange, setEvolutionChange] = useState("");

  const [strengths, setStrengths] = useState("");
  const [developmentPoints, setDevelopmentPoints] = useState("");

  const [pdiGoal, setPdiGoal] = useState("");
  const [pdiAction, setPdiAction] = useState("");
  const [pdiDeadline, setPdiDeadline] = useState("");
  const [pdiResponsible, setPdiResponsible] = useState("");
  const [pdiIndicator, setPdiIndicator] = useState("");

  const [finalMessage, setFinalMessage] = useState("");
  const [confirmDiscussed, setConfirmDiscussed] = useState(false);
  const [confirmAwareGoals, setConfirmAwareGoals] = useState(false);
  const [confirmPlanValidated, setConfirmPlanValidated] = useState(false);

  const finalScore = useMemo(() => {
    const values = [...Object.values(technical), ...Object.values(behavioral)];
    return Number(((values.reduce((acc, n) => acc + n, 0) / values.length) * 2).toFixed(1));
  }, [technical, behavioral]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const [cycleRes, collabRes] = await Promise.all([
        fetch("/api/feedback/cycle", { method: "GET" }),
        fetch("/api/feedback/collaborators?targetRole=colaborador", { method: "GET" }),
      ]);

      const collabJson = await collabRes.json();
      if (!collabRes.ok) throw new Error(collabJson?.error ?? "Falha ao carregar colaboradores.");
      setCollaborators((collabJson.rows ?? []) as CollaboratorOption[]);

      if (cycleRes.ok) {
        const cycleJson = await cycleRes.json();
        setCycle(cycleJson.cycle ?? null);
        setCollectOpen(cycleJson.collectOpen === true);
      } else {
        setCycle(null);
        setCollectOpen(false);
        setMsg("Lista de colaboradores carregada. Ciclo de feedback nao configurado ou indisponivel.");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setTech(key: TechnicalKey, value: number) {
    setTechnical((prev) => ({ ...prev, [key]: value }));
  }

  function setBeh(key: BehaviorKey, value: number) {
    setBehavioral((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(status: "draft" | "sent") {
    setMsg("");
    if (!targetUserId) return setMsg("Selecione o colaborador.");

    if (status === "sent") {
      const hasUnscored = [...Object.values(technical), ...Object.values(behavioral)].some((n) => n < 1 || n > 5);
      if (hasUnscored) return setMsg("Preencha todas as notas (1 a 5) antes de enviar.");
      if (!finalMessage.trim()) return setMsg("Preencha o feedback final do coordenador.");
      if (!(confirmDiscussed && confirmAwareGoals && confirmPlanValidated)) {
        return setMsg("Confirme os 3 checkboxes de validacao antes de enviar.");
      }
    }

    setSubmitting(true);
    try {
      const details = {
        technical,
        behavioral,
        impact_result: impactResult,
        impact_evidence: impactEvidence.trim(),
        evolution_result: evolutionResult,
        evolution_change: evolutionChange.trim(),
        strengths: strengths.trim(),
        development_points: developmentPoints.trim(),
        pdi_goal: pdiGoal.trim(),
        pdi_action: pdiAction.trim(),
        pdi_deadline: pdiDeadline || null,
        pdi_responsible: pdiResponsible.trim(),
        pdi_indicator: pdiIndicator.trim(),
        final_message: finalMessage.trim(),
        confirmations: {
          discussed_with_collaborator: confirmDiscussed,
          collaborator_aware_goals: confirmAwareGoals,
          plan_validated: confirmPlanValidated,
        },
      };

      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          scores: { ...technical, ...behavioral },
          comment: finalMessage.trim() || developmentPoints.trim() || strengths.trim(),
          short_term_action: pdiAction.trim(),
          final_score: finalScore,
          details,
          status,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao registrar feedback.");

      setMsg(status === "draft" ? "Rascunho salvo com sucesso." : "Feedback enviado com sucesso e PDI gerado.");
      if (status === "sent") {
        setFinalMessage("");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao enviar feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Feedback do Coordenador</h1>
            <p className="mt-1 text-sm text-slate-600">
              Avaliacao estruturada por criterios, competencias e PDI de curto prazo.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading || submitting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Ciclo ativo</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{cycle?.name ?? "Nao configurado"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Coleta aberta</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{collectOpen ? "Sim" : "Nao"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Nota final (0-10)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{finalScore.toFixed(1)}</p>
          <p className="text-xs text-slate-500">{classification(finalScore)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <label className="text-sm font-semibold text-slate-900">Colaborador avaliado</label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">Selecione...</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.email ?? c.id}
              </option>
            ))}
          </select>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">1. Avaliacao tecnica (1-5)</h2>
          {TECHNICAL.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-slate-800">{item.label}</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTech(item.key, n)}
                    className={[
                      "h-9 w-9 rounded-lg border text-xs font-semibold transition-colors",
                      technical[item.key] === n
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-900 hover:text-white",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">2. Competencias comportamentais (1-5)</h2>
          {BEHAVIORAL.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-slate-800">{item.label}</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBeh(item.key, n)}
                    className={[
                      "h-9 w-9 rounded-lg border text-xs font-semibold transition-colors",
                      behavioral[item.key] === n
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-900 hover:bg-slate-900 hover:text-white",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-900">3. Resultados e impacto</label>
            <select value={impactResult} onChange={(e) => setImpactResult(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
              {IMPACT_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <textarea value={impactEvidence} onChange={(e) => setImpactEvidence(e.target.value)} placeholder="Cite exemplos que sustentem sua avaliacao" className="mt-2 min-h-[100px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-900">4. Evolucao no periodo</label>
            <select value={evolutionResult} onChange={(e) => setEvolutionResult(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
              {EVOLUTION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <textarea value={evolutionChange} onChange={(e) => setEvolutionChange(e.target.value)} placeholder="O que mudou em sua percepcao?" className="mt-2 min-h-[100px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="5. Pontos fortes" className="min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
          <textarea value={developmentPoints} onChange={(e) => setDevelopmentPoints(e.target.value)} placeholder="6. Pontos de desenvolvimento prioritarios" className="min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">7. PDI de curto prazo</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={pdiGoal} onChange={(e) => setPdiGoal(e.target.value)} placeholder="Meta de desenvolvimento" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={pdiAction} onChange={(e) => setPdiAction(e.target.value)} placeholder="Acao sugerida" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input type="date" value={pdiDeadline} onChange={(e) => setPdiDeadline(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={pdiResponsible} onChange={(e) => setPdiResponsible(e.target.value)} placeholder="Responsavel" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={pdiIndicator} onChange={(e) => setPdiIndicator(e.target.value)} placeholder="Indicador de sucesso" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
          </div>
        </section>

        <section>
          <label className="text-sm font-semibold text-slate-900">8. Feedback final do coordenador</label>
          <textarea value={finalMessage} onChange={(e) => setFinalMessage(e.target.value)} className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Orientacao, reconhecimento e direcionamento" />
        </section>

        <section className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmDiscussed} onChange={(e) => setConfirmDiscussed(e.target.checked)} /> Feedback discutido com colaborador</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmAwareGoals} onChange={(e) => setConfirmAwareGoals(e.target.checked)} /> Colaborador ciente das metas</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmPlanValidated} onChange={(e) => setConfirmPlanValidated(e.target.checked)} /> Plano de desenvolvimento validado</label>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void submit("draft")} disabled={loading || submitting || !collectOpen} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Salvar rascunho</button>
          <button type="button" onClick={() => void submit("sent")} disabled={loading || submitting || !collectOpen} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Enviar feedback</button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{msg}</div> : null}
    </div>
  );
}
