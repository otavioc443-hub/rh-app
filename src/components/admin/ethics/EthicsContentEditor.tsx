"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Plus, Save, Settings2, Trash2 } from "lucide-react";
import type { EthicsManagedContent, EthicsFaqItem } from "@/lib/ethicsChannelDefaults";

type CompanyOption = {
  id: string;
  name: string;
};

function toLines(values: string[]) {
  return values.join("\n");
}

function fromLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cloneContent(content: EthicsManagedContent): EthicsManagedContent {
  return {
    ...content,
    principles: [...content.principles],
    foundationPillars: content.foundationPillars.map((item) => ({ ...item })),
    faqItems: content.faqItems.map((item) => ({ ...item })),
    pageTexts: {
      ...content.pageTexts,
      homeGuidanceParagraphs: [...content.pageTexts.homeGuidanceParagraphs],
      reportIntroParagraphs: [...content.pageTexts.reportIntroParagraphs],
      reportIdentityParagraphs: [...content.pageTexts.reportIdentityParagraphs],
      reportIncidentParagraphs: [...content.pageTexts.reportIncidentParagraphs],
    },
  };
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:bg-slate-50"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:bg-slate-50"
        />
      )}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)]">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

export function EthicsContentEditor({
  companies,
  initialCompanyId,
  initialContent,
  canEdit,
}: {
  companies: CompanyOption[];
  initialCompanyId: string | null;
  initialContent: EthicsManagedContent | null;
  canEdit: boolean;
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId ?? companies[0]?.id ?? "");
  const [content, setContent] = useState<EthicsManagedContent | null>(initialContent ? cloneContent(initialContent) : null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompanyId) return;
    if (selectedCompanyId === initialCompanyId && initialContent) {
      setContent(cloneContent(initialContent));
      return;
    }

    let active = true;
    setLoading(true);
    setFeedback(null);
    void fetch(`/api/admin/ethics-content?companyId=${selectedCompanyId}`)
      .then(async (response) => {
        const json = (await response.json()) as { content?: EthicsManagedContent; error?: string };
        if (!response.ok || !json.content) throw new Error(json.error ?? "Falha ao carregar o conteúdo.");
        if (active) setContent(cloneContent(json.content));
      })
      .catch((error) => {
        if (active) setFeedback(error instanceof Error ? error.message : "Falha ao carregar o conteúdo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialCompanyId, initialContent, selectedCompanyId]);

  function updateFaqItem(index: number, patch: Partial<EthicsFaqItem>) {
    setContent((current) => {
      if (!current) return current;
      const nextFaq = current.faqItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
      return { ...current, faqItems: nextFaq };
    });
  }

  async function handleSave() {
    if (!selectedCompanyId || !content || !canEdit) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/ethics-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, content }),
      });
      const json = (await response.json()) as { content?: EthicsManagedContent; error?: string };
      if (!response.ok || !json.content) throw new Error(json.error ?? "Falha ao salvar o conteúdo.");
      setContent(cloneContent(json.content));
      setFeedback("Conteúdo salvo com sucesso.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao salvar o conteúdo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-950 text-white">
              <Settings2 size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Conteúdo do Canal de Ética</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Ajuste os textos visíveis da página inicial, realizar relato, acompanhar relato, proteção de dados e código de ética sem editar código.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {companies.length > 1 ? (
              <select
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
                className="h-11 min-w-60 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canEdit || !content || saving || loading}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar textos
            </button>
          </div>
        </div>
        {feedback ? <p className="mt-4 text-sm font-medium text-slate-600">{feedback}</p> : null}
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">Carregando conteúdo...</div>
      ) : null}

      {!loading && content ? (
        <div className="grid gap-6">
          <Section title="Página inicial" description="Textos principais da entrada pública do canal de ética.">
            <Field label="Título principal" value={content.heroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, heroTitle: value } : current))} />
            <Field label="Subtítulo principal" value={content.heroSubtitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, heroSubtitle: value } : current))} multiline rows={4} />
            <Field label="Bloco de compromisso" value={content.pageTexts.homeGuidanceTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, homeGuidanceTitle: value } } : current))} />
            <Field
              label="Parágrafos de orientações do canal"
              value={toLines(content.pageTexts.homeGuidanceParagraphs)}
              onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, homeGuidanceParagraphs: fromLines(value) } } : current))}
              multiline
              rows={6}
            />
          </Section>

          <Section title="Realizar relato" description="Textos exibidos nas três etapas do fluxo público de registro.">
            <Field label="Hero título" value={content.pageTexts.reportHeroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportHeroTitle: value } } : current))} />
            <Field label="Hero descrição" value={content.pageTexts.reportHeroBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportHeroBody: value } } : current))} multiline rows={4} />
            <Field label="Hero destaque lateral" value={content.pageTexts.reportHeroAsideBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportHeroAsideBody: value } } : current))} multiline rows={3} />
            <Field label="Título da etapa inicial" value={content.pageTexts.reportIntroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIntroTitle: value } } : current))} />
            <Field
              label="Texto da etapa inicial"
              value={toLines(content.pageTexts.reportIntroParagraphs)}
              onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIntroParagraphs: fromLines(value) } } : current))}
              multiline
              rows={10}
            />
            <Field label="Texto do aceite" value={content.pageTexts.reportConsentLabel ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportConsentLabel: value } } : current))} multiline rows={3} />
            <Field
              label="Textos da etapa de identificação"
              value={toLines(content.pageTexts.reportIdentityParagraphs)}
              onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIdentityParagraphs: fromLines(value) } } : current))}
              multiline
              rows={6}
            />
            <Field label="Pergunta de identificação" value={content.pageTexts.reportIdentityQuestion ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIdentityQuestion: value } } : current))} />
            <Field
              label="Textos da etapa do incidente"
              value={toLines(content.pageTexts.reportIncidentParagraphs)}
              onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIncidentParagraphs: fromLines(value) } } : current))}
              multiline
              rows={10}
            />
          </Section>

          <Section title="Acompanhar relato" description="Textos do formulário de consulta por protocolo.">
            <Field label="Hero título" value={content.pageTexts.followUpHeroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpHeroTitle: value } } : current))} />
            <Field label="Hero descrição" value={content.pageTexts.followUpHeroBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpHeroBody: value } } : current))} multiline rows={3} />
            <Field label="Título da tela" value={content.pageTexts.followUpTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpTitle: value } } : current))} />
            <Field label="Descrição da consulta" value={content.pageTexts.followUpDescription ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpDescription: value } } : current))} multiline rows={4} />
            <Field label="Placeholder do protocolo" value={content.pageTexts.followUpPlaceholder ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpPlaceholder: value } } : current))} />
          </Section>

          <Section title="Proteção de dados e FAQ" description="Título da seção e perguntas frequentes em acordeão.">
            <Field label="Kicker da FAQ" value={content.pageTexts.dataFaqSubtitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, dataFaqSubtitle: value } } : current))} />
            <Field label="Título da FAQ" value={content.pageTexts.dataFaqTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, dataFaqTitle: value } } : current))} />
            <Field label="Resumo de proteção de dados" value={content.dataProtectionSummary ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, dataProtectionSummary: value } : current))} multiline rows={4} />
            <div className="space-y-4">
              {content.faqItems.map((item, index) => (
                <div key={`${index}-${item.question}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Pergunta {index + 1}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setContent((current) =>
                          current ? { ...current, faqItems: current.faqItems.filter((_, faqIndex) => faqIndex !== index) } : current,
                        )
                      }
                      className="inline-flex items-center gap-1 text-sm font-medium text-rose-600"
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Pergunta" value={item.question} onChange={(value) => updateFaqItem(index, { question: value })} />
                    <Field label="Resposta" value={item.answer} onChange={(value) => updateFaqItem(index, { answer: value })} multiline rows={4} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setContent((current) =>
                    current ? { ...current, faqItems: [...current.faqItems, { question: "", answer: "" }] } : current,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              >
                <Plus size={16} />
                Adicionar pergunta
              </button>
            </div>
          </Section>

          <Section title="Código de ética e contatos" description="Blocos complementares do canal e links institucionais.">
            <Field label="Resumo do código" value={content.codeSummary ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, codeSummary: value } : current))} multiline rows={4} />
            <Field label="Título da página de código" value={content.pageTexts.codeHeroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, codeHeroTitle: value } } : current))} />
            <Field label="Descrição da página de código" value={content.pageTexts.codeHeroBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, codeHeroBody: value } } : current))} multiline rows={4} />
            <Field label="E-mail de contato" value={content.contactEmail ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, contactEmail: value } : current))} />
            <Field label="Telefone de contato" value={content.contactPhone ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, contactPhone: value } : current))} />
            <Field label="URL do código de ética" value={content.codeOfEthicsUrl ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, codeOfEthicsUrl: value } : current))} />
            <Field label="URL de proteção de dados" value={content.dataProtectionUrl ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, dataProtectionUrl: value } : current))} />
          </Section>
        </div>
      ) : null}
    </section>
  );
}
