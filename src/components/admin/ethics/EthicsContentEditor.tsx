"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, FileText, Loader2, Plus, Save, Settings2, Trash2, Upload } from "lucide-react";
import type { EthicsManagedContent, EthicsFaqItem } from "@/lib/ethicsChannelDefaults";

type CompanyOption = {
  id: string;
  name: string;
  slug?: string;
};

type EditorTab = "home" | "report" | "follow-up" | "data" | "code";

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

function tabLabel(tab: EditorTab) {
  if (tab === "home") return "Página Inicial";
  if (tab === "report") return "Realizar relato";
  if (tab === "follow-up") return "Acompanhar relato";
  if (tab === "data") return "Proteção de Dados";
  return "Código de Ética";
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400"
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
  const [activeTab, setActiveTab] = useState<EditorTab>("home");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? companies[0] ?? null,
    [companies, selectedCompanyId],
  );

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

  async function handlePdfUpload(file: File) {
    setUploadingPdf(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/ethics-content/upload", { method: "POST", body: formData });
      const json = (await response.json()) as { storageRef?: string; error?: string };
      if (!response.ok || !json.storageRef) throw new Error(json.error ?? "Falha ao enviar o PDF.");
      setContent((current) => (current ? { ...current, codeOfEthicsUrl: json.storageRef ?? null } : current));
      setFeedback("PDF do Código de Ética enviado. Salve o conteúdo para publicar a alteração.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar o PDF.");
    } finally {
      setUploadingPdf(false);
    }
  }

  function updateFaqItem(index: number, patch: Partial<EthicsFaqItem>) {
    setContent((current) => {
      if (!current) return current;
      return {
        ...current,
        faqItems: current.faqItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
      };
    });
  }

  const companyHref = selectedCompany?.slug ? `/canal-de-etica/${selectedCompany.slug}` : null;

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-slate-950 text-white">
              <Settings2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Conteúdo do Canal de Ética</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Navegue pelas mesmas páginas do canal público, revise a prévia e ajuste os textos de cada etapa em um único fluxo administrativo.
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
            {companyHref ? (
              <Link
                href={companyHref}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
              >
                Ver link público
                <ArrowRight size={15} />
              </Link>
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
        <>
          <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_55%,#ffffff_100%)] shadow-[0_22px_60px_-42px_rgba(15,23,42,0.55)]">
            <div className="border-b border-slate-200 bg-white px-6 py-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-3">
                {(["home", "report", "follow-up", "data", "code"] as EditorTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeTab === tab ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {tabLabel(tab)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.15fr,0.85fr] lg:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{tabLabel(activeTab)}</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                  {activeTab === "home" && content.heroTitle}
                  {activeTab === "report" && content.pageTexts.reportHeroTitle}
                  {activeTab === "follow-up" && content.pageTexts.followUpHeroTitle}
                  {activeTab === "data" && "Proteção de Dados"}
                  {activeTab === "code" && (content.pageTexts.codeHeroTitle ?? "Código de Ética")}
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
                  {activeTab === "home" && content.heroSubtitle}
                  {activeTab === "report" && content.pageTexts.reportHeroBody}
                  {activeTab === "follow-up" && content.pageTexts.followUpHeroBody}
                  {activeTab === "data" && content.dataProtectionSummary}
                  {activeTab === "code" && (content.pageTexts.codeHeroBody ?? content.codeSummary)}
                </p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Prévia rápida</p>
                {activeTab === "home" ? (
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                    <p className="font-semibold text-slate-950">{content.pageTexts.homeGuidanceTitle}</p>
                    {content.pageTexts.homeGuidanceParagraphs.slice(0, 2).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
                {activeTab === "report" ? (
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                    <p className="font-semibold text-slate-950">{content.pageTexts.reportIntroTitle}</p>
                    {content.pageTexts.reportIntroParagraphs.slice(0, 3).map((paragraph, index) => (
                      <p key={`${paragraph}-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}
                {activeTab === "follow-up" ? (
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                    <p className="font-semibold text-slate-950">{content.pageTexts.followUpTitle}</p>
                    <p>{content.pageTexts.followUpDescription}</p>
                  </div>
                ) : null}
                {activeTab === "data" ? (
                  <div className="mt-4 space-y-3">
                    {content.faqItems.slice(0, 3).map((item, index) => (
                      <div key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                          className="flex w-full items-center gap-3 px-4 py-4 text-left"
                        >
                          <span className="flex-1 text-sm font-semibold text-slate-950">{item.question}</span>
                          <ChevronDown size={16} className={`text-slate-500 transition ${openFaqIndex === index ? "rotate-180" : ""}`} />
                        </button>
                        {openFaqIndex === index ? (
                          <div className="border-t border-slate-200 px-4 py-4 text-sm leading-7 text-slate-600">{item.answer}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {activeTab === "code" ? (
                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Documento oficial</p>
                    <p className="mt-3 text-lg font-semibold">Consulte o código completo da empresa.</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {content.codeOfEthicsUrl ? "O botão ficará habilitado no canal público." : "Envie um PDF ou informe uma URL para habilitar o botão no canal público."}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {activeTab === "home" ? (
            <Section title="Página Inicial" description="Conteúdo exibido no link inicial do canal.">
              <Field label="Título principal" value={content.heroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, heroTitle: value } : current))} />
              <Field label="Subtítulo principal" value={content.heroSubtitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, heroSubtitle: value } : current))} multiline rows={4} />
              <Field label="Bloco de compromisso" value={content.pageTexts.homeGuidanceTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, homeGuidanceTitle: value } } : current))} />
              <Field label="Parágrafos de orientações do canal" value={toLines(content.pageTexts.homeGuidanceParagraphs)} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, homeGuidanceParagraphs: fromLines(value) } } : current))} multiline rows={7} />
              <Field label="Imagem hero" value={content.heroImageUrl ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, heroImageUrl: value } : current))} />
            </Section>
          ) : null}

          {activeTab === "report" ? (
            <Section title="Realizar relato" description="Textos das etapas do fluxo público de manifestação.">
              <Field label="Hero título" value={content.pageTexts.reportHeroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportHeroTitle: value } } : current))} />
              <Field label="Hero descrição" value={content.pageTexts.reportHeroBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportHeroBody: value } } : current))} multiline rows={4} />
              <Field label="Destaque lateral" value={content.pageTexts.reportHeroAsideBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportHeroAsideBody: value } } : current))} multiline rows={3} />
              <Field label="Texto da etapa inicial" value={toLines(content.pageTexts.reportIntroParagraphs)} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIntroParagraphs: fromLines(value) } } : current))} multiline rows={12} />
              <Field label="Texto do aceite" value={content.pageTexts.reportConsentLabel ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportConsentLabel: value } } : current))} multiline rows={3} />
              <Field label="Textos da etapa de identificação" value={toLines(content.pageTexts.reportIdentityParagraphs)} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIdentityParagraphs: fromLines(value) } } : current))} multiline rows={6} />
              <Field label="Pergunta de identificação" value={content.pageTexts.reportIdentityQuestion ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIdentityQuestion: value } } : current))} />
              <Field label="Textos da etapa do incidente" value={toLines(content.pageTexts.reportIncidentParagraphs)} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, reportIncidentParagraphs: fromLines(value) } } : current))} multiline rows={11} />
            </Section>
          ) : null}

          {activeTab === "follow-up" ? (
            <Section title="Acompanhar relato" description="Textos e orientações da consulta por protocolo.">
              <Field label="Hero título" value={content.pageTexts.followUpHeroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpHeroTitle: value } } : current))} />
              <Field label="Hero descrição" value={content.pageTexts.followUpHeroBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpHeroBody: value } } : current))} multiline rows={4} />
              <Field label="Título da tela" value={content.pageTexts.followUpTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpTitle: value } } : current))} />
              <Field label="Descrição da consulta" value={content.pageTexts.followUpDescription ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpDescription: value } } : current))} multiline rows={4} />
              <Field label="Placeholder do protocolo" value={content.pageTexts.followUpPlaceholder ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, followUpPlaceholder: value } } : current))} />
            </Section>
          ) : null}

          {activeTab === "data" ? (
            <Section title="Proteção de Dados e FAQ" description="Perguntas frequentes do canal em formato de acordeão.">
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
          ) : null}

          {activeTab === "code" ? (
            <Section title="Código de Ética" description="Documento oficial, descrição pública e anexos do código.">
              <Field label="Resumo do código" value={content.codeSummary ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, codeSummary: value } : current))} multiline rows={4} />
              <Field label="Título da página de código" value={content.pageTexts.codeHeroTitle ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, codeHeroTitle: value } } : current))} />
              <Field label="Descrição da página de código" value={content.pageTexts.codeHeroBody ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, pageTexts: { ...current.pageTexts, codeHeroBody: value } } : current))} multiline rows={4} />
              <div className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-end">
                <Field label="URL ou referência do Código de Ética" value={content.codeOfEthicsUrl ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, codeOfEthicsUrl: value } : current))} />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                  {uploadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Enviar PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handlePdfUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">Botão público do Código de Ética</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {content.codeOfEthicsUrl
                        ? "O botão ficará habilitado no link público e abrirá o PDF ou URL configurada."
                        : "Envie um PDF ou informe uma URL para habilitar o botão de Código de Ética no canal público."}
                    </p>
                  </div>
                </div>
              </div>
              <Field label="URL de proteção de dados" value={content.dataProtectionUrl ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, dataProtectionUrl: value } : current))} />
              <Field label="E-mail de contato" value={content.contactEmail ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, contactEmail: value } : current))} />
              <Field label="Telefone de contato" value={content.contactPhone ?? ""} onChange={(value) => setContent((current) => (current ? { ...current, contactPhone: value } : current))} />
            </Section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
