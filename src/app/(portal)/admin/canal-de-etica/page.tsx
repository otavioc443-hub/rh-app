"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink, RefreshCcw, Save, Search, ShieldCheck, Upload } from "lucide-react";
import EthicsChannelLanding from "@/components/public/EthicsChannelLanding";
import { useUserRole } from "@/hooks/useUserRole";
import { buildEthicsChannelSlug, type EthicsChannelConfig } from "@/lib/ethicsChannel";
import {
  getDefaultEthicsManagedContent,
  type EthicsFoundationPillar,
  type EthicsManagedContent,
} from "@/lib/ethicsChannelDefaults";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  cidade: string | null;
  estado: string | null;
};

type ContentRow = {
  id: string;
  company_id: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  heading: string | null;
  intro: string | null;
  hero_image_url: string | null;
  report_url: string | null;
  follow_up_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  code_of_ethics_url: string | null;
  data_protection_url: string | null;
  code_summary: string | null;
  data_protection_summary: string | null;
  principles: unknown;
  foundation_title: string | null;
  foundation_subtitle: string | null;
  foundation_pillars: unknown;
  steer_title: string | null;
  steer_body: string | null;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function coerceStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function coercePillars(value: unknown): EthicsFoundationPillar[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      const text = String(row.text ?? "").trim();
      if (!label && !text) return null;
      return { label, text };
    })
    .filter(Boolean) as EthicsFoundationPillar[];
}

function mapRowToContent(row: ContentRow | null, companyName: string) {
  const base = getDefaultEthicsManagedContent(companyName, companyName);
  if (!row) return base;
  return {
    ...base,
    heroTitle: clean(row.hero_title) || base.heroTitle,
    heroSubtitle: clean(row.hero_subtitle) || base.heroSubtitle,
    heading: clean(row.heading) || base.heading,
    intro: clean(row.intro) || base.intro,
    heroImageUrl: clean(row.hero_image_url) || base.heroImageUrl,
    reportUrl: clean(row.report_url) || base.reportUrl,
    followUpUrl: clean(row.follow_up_url) || base.followUpUrl,
    contactEmail: clean(row.contact_email) || base.contactEmail,
    contactPhone: clean(row.contact_phone) || base.contactPhone,
    codeOfEthicsUrl: clean(row.code_of_ethics_url) || base.codeOfEthicsUrl,
    dataProtectionUrl: clean(row.data_protection_url) || base.dataProtectionUrl,
    codeSummary: clean(row.code_summary) || base.codeSummary,
    dataProtectionSummary: clean(row.data_protection_summary) || base.dataProtectionSummary,
    principles: coerceStringArray(row.principles).length ? coerceStringArray(row.principles) : base.principles,
    foundationTitle: clean(row.foundation_title) || base.foundationTitle,
    foundationSubtitle: clean(row.foundation_subtitle) || base.foundationSubtitle,
    foundationPillars: coercePillars(row.foundation_pillars).length ? coercePillars(row.foundation_pillars) : base.foundationPillars,
    steerTitle: clean(row.steer_title) || base.steerTitle,
    steerBody: clean(row.steer_body) || base.steerBody,
  } satisfies EthicsManagedContent;
}

async function uploadEthicsAsset(file: File, companyId: string, folder: "hero" | "pdf") {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? null;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("prefix", `ethics-channel/${companyId}/${folder}`);

  const res = await fetch("/api/rh/institucional/upload", {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  const json = (await res.json()) as { publicUrl?: string; error?: string };
  if (!res.ok || !json.publicUrl) throw new Error(json.error || `Erro de upload (${res.status})`);
  return json.publicUrl;
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
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="min-h-[110px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-slate-300"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-slate-300"
        />
      )}
    </label>
  );
}

export default function AdminCanalDeEticaPage() {
  const router = useRouter();
  const { loading: roleLoading, isAdmin, error: roleError } = useUserRole();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
  const [contentId, setContentId] = useState<string | null>(null);
  const [form, setForm] = useState<EthicsManagedContent>(getDefaultEthicsManagedContent("Empresa"));
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!roleLoading && !isAdmin) router.replace("/unauthorized");
  }, [isAdmin, roleLoading, router]);

  async function loadCompanies() {
    const { data, error } = await supabase.from("companies").select("id,name,logo_url,cidade,estado").order("name", { ascending: true });
    if (error) throw error;
    const list = (data ?? []) as Company[];
    setCompanies(list);
    if (!selectedCompanyId && list[0]) {
      setSelectedCompanyId(list[0].id);
      setSelectedCompanyName(list[0].name);
    }
    return list;
  }

  async function loadContent(companyId: string, companyName: string) {
    setLoading(true);
    setMsg("");
    try {
      const { data, error } = await supabase
        .from("ethics_channel_content")
        .select(
          "id,company_id,hero_title,hero_subtitle,heading,intro,hero_image_url,report_url,follow_up_url,contact_email,contact_phone,code_of_ethics_url,data_protection_url,code_summary,data_protection_summary,principles,foundation_title,foundation_subtitle,foundation_pillars,steer_title,steer_body",
        )
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;

      setContentId(data?.id ?? null);
      setSelectedCompanyName(companyName);
      setForm(mapRowToContent((data ?? null) as ContentRow | null, companyName));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar o canal de ética.");
      setContentId(null);
      setForm(getDefaultEthicsManagedContent(companyName, companyName));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      try {
        const list = await loadCompanies();
        if (list[0]) {
          await loadContent(list[0].id, list[0].name);
        } else {
          setLoading(false);
        }
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao carregar empresas.");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filteredCompanies = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((company) => {
      const city = String(company.cidade ?? "").toLowerCase();
      const state = String(company.estado ?? "").toLowerCase();
      return company.name.toLowerCase().includes(term) || city.includes(term) || state.includes(term);
    });
  }, [companies, q]);

  const previewConfig = useMemo<EthicsChannelConfig>(
    () => ({
      key: buildEthicsChannelSlug(selectedCompanyName || "empresa") || "empresa",
      companyName: selectedCompanyName || "Empresa",
      reportUrl: clean(form.reportUrl) || null,
      followUpUrl: clean(form.followUpUrl) || null,
      contactEmail: clean(form.contactEmail) || null,
      contactPhone: clean(form.contactPhone) || null,
      heroImageUrl: clean(form.heroImageUrl) || null,
      codeOfEthicsUrl: clean(form.codeOfEthicsUrl) || null,
      dataProtectionUrl: clean(form.dataProtectionUrl) || null,
    }),
    [form.codeOfEthicsUrl, form.contactEmail, form.contactPhone, form.dataProtectionUrl, form.followUpUrl, form.heroImageUrl, form.reportUrl, selectedCompanyName],
  );

  function setField<K extends keyof EthicsManagedContent>(key: K, value: EthicsManagedContent[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!selectedCompanyId) {
      setMsg("Selecione uma empresa.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        company_id: selectedCompanyId,
        hero_title: clean(form.heroTitle) || null,
        hero_subtitle: clean(form.heroSubtitle) || null,
        heading: clean(form.heading) || null,
        intro: clean(form.intro) || null,
        hero_image_url: clean(form.heroImageUrl) || null,
        report_url: clean(form.reportUrl) || null,
        follow_up_url: clean(form.followUpUrl) || null,
        contact_email: clean(form.contactEmail) || null,
        contact_phone: clean(form.contactPhone) || null,
        code_of_ethics_url: clean(form.codeOfEthicsUrl) || null,
        data_protection_url: clean(form.dataProtectionUrl) || null,
        code_summary: clean(form.codeSummary) || null,
        data_protection_summary: clean(form.dataProtectionSummary) || null,
        principles: form.principles.filter(Boolean),
        foundation_title: clean(form.foundationTitle) || null,
        foundation_subtitle: clean(form.foundationSubtitle) || null,
        foundation_pillars: form.foundationPillars.filter((item) => item.label || item.text),
        steer_title: clean(form.steerTitle) || null,
        steer_body: clean(form.steerBody) || null,
      };

      const { data, error } = await supabase
        .from("ethics_channel_content")
        .upsert(payload, { onConflict: "company_id" })
        .select("id")
        .maybeSingle();

      if (error) throw error;
      setContentId(data?.id ?? contentId);
      setMsg("Canal de ética salvo com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar o canal de ética.");
    } finally {
      setSaving(false);
    }
  }

  if (roleLoading || loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando editor do canal de ética...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Canal de ética</h1>
              <p className="mt-1 text-sm text-slate-600">
                Edite o conteúdo público do canal por empresa e reflita as particularidades institucionais de cada operação.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectedCompanyId && loadContent(selectedCompanyId, selectedCompanyName)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <RefreshCcw size={16} />
              Recarregar
            </button>
            <a
              href={selectedCompanyName ? `/canal-de-etica/${buildEthicsChannelSlug(selectedCompanyName)}` : "/canal-de-etica"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ExternalLink size={16} />
              Abrir página pública
            </a>
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {msg ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{msg}</div> : null}
        {roleError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{roleError}</div> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px,1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div className="mt-4 space-y-2">
            {filteredCompanies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => {
                  setSelectedCompanyId(company.id);
                  void loadContent(company.id, company.name);
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  company.id === selectedCompanyId
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {company.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-xl border border-slate-200 bg-white object-contain" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                      <Building2 size={16} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{company.name}</p>
                    <p className={`truncate text-xs ${company.id === selectedCompanyId ? "text-white/70" : "text-slate-500"}`}>
                      {[company.cidade, company.estado].filter(Boolean).join(" - ") || "Sem localidade"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Título da hero" value={clean(form.heroTitle)} onChange={(value) => setField("heroTitle", value)} />
              <Field label="Heading do card da imagem" value={clean(form.heading)} onChange={(value) => setField("heading", value)} />
              <div className="lg:col-span-2">
                <Field label="Subtítulo da hero" value={clean(form.heroSubtitle)} onChange={(value) => setField("heroSubtitle", value)} multiline rows={4} />
              </div>
              <div className="lg:col-span-2">
                <Field label="Texto institucional do card da imagem" value={clean(form.intro)} onChange={(value) => setField("intro", value)} multiline rows={5} />
              </div>
              <Field label="Imagem principal (URL)" value={clean(form.heroImageUrl)} onChange={(value) => setField("heroImageUrl", value)} />
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Upload da imagem principal</span>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file || !selectedCompanyId) return;
                    void (async () => {
                      setUploading(true);
                      setMsg("");
                      try {
                        const url = await uploadEthicsAsset(file, selectedCompanyId, "hero");
                        setField("heroImageUrl", url);
                        setMsg("Imagem enviada. Salve para publicar no canal.");
                      } catch (error: unknown) {
                        setMsg(error instanceof Error ? error.message : "Erro ao enviar imagem.");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    })();
                  }}
                />
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Upload size={14} />
                  Use o bucket institucional já existente para a imagem da hero.
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="Link para realizar relato" value={clean(form.reportUrl)} onChange={(value) => setField("reportUrl", value)} />
              <Field label="Link para acompanhar relato" value={clean(form.followUpUrl)} onChange={(value) => setField("followUpUrl", value)} />
              <Field label="E-mail do canal" value={clean(form.contactEmail)} onChange={(value) => setField("contactEmail", value)} />
              <Field label="Telefone do canal" value={clean(form.contactPhone)} onChange={(value) => setField("contactPhone", value)} />
              <div className="grid gap-2">
                <Field label="Link do código de ética" value={clean(form.codeOfEthicsUrl)} onChange={(value) => setField("codeOfEthicsUrl", value)} />
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Upload do PDF do código de ética</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file || !selectedCompanyId) return;
                      void (async () => {
                        setUploading(true);
                        setMsg("");
                        try {
                          const url = await uploadEthicsAsset(file, selectedCompanyId, "pdf");
                          setField("codeOfEthicsUrl", url);
                          setMsg("PDF enviado. Salve para publicar o código de ética.");
                        } catch (error: unknown) {
                          setMsg(error instanceof Error ? error.message : "Erro ao enviar PDF.");
                        } finally {
                          setUploading(false);
                          e.target.value = "";
                        }
                      })();
                    }}
                  />
                  <span className="text-xs text-slate-500">
                    Quando preenchido, o menu Código de Ética abre diretamente este PDF.
                  </span>
                </label>
              </div>
              <Field label="Link de proteção de dados" value={clean(form.dataProtectionUrl)} onChange={(value) => setField("dataProtectionUrl", value)} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="grid gap-5">
              <Field label="Resumo do código de ética" value={clean(form.codeSummary)} onChange={(value) => setField("codeSummary", value)} multiline rows={5} />
              <Field
                label="Resumo de proteção de dados"
                value={clean(form.dataProtectionSummary)}
                onChange={(value) => setField("dataProtectionSummary", value)}
                multiline
                rows={5}
              />
              <Field
                label="Princípios destacados"
                value={form.principles.join("\n")}
                onChange={(value) => setField("principles", value.split("\n").map((item) => item.trim()).filter(Boolean))}
                multiline
                rows={6}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="grid gap-5">
              <Field label="Título da base institucional" value={clean(form.foundationTitle)} onChange={(value) => setField("foundationTitle", value)} />
              <Field
                label="Subtítulo da base institucional"
                value={clean(form.foundationSubtitle)}
                onChange={(value) => setField("foundationSubtitle", value)}
                multiline
                rows={4}
              />

              <div className="grid gap-4 lg:grid-cols-3">
                {form.foundationPillars.map((pillar, index) => (
                  <div key={`${pillar.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Field
                      label={`Pilar ${index + 1}`}
                      value={pillar.label}
                      onChange={(value) =>
                        setField(
                          "foundationPillars",
                          form.foundationPillars.map((item, itemIndex) => (itemIndex === index ? { ...item, label: value } : item)),
                        )
                      }
                    />
                    <div className="mt-4">
                      <Field
                        label="Texto"
                        value={pillar.text}
                        onChange={(value) =>
                          setField(
                            "foundationPillars",
                            form.foundationPillars.map((item, itemIndex) => (itemIndex === index ? { ...item, text: value } : item)),
                          )
                        }
                        multiline
                        rows={5}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Título do bloco STEER" value={clean(form.steerTitle)} onChange={(value) => setField("steerTitle", value)} />
                <Field label="Texto do bloco STEER" value={clean(form.steerBody)} onChange={(value) => setField("steerBody", value)} multiline rows={4} />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Preview</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Visualização da página pública</h2>
              <p className="mt-1 text-sm text-slate-600">
                O preview já reflete as seções ocultas por menu. O conteúdo de cada bloco só aparece quando o usuário seleciona o item correspondente.
              </p>
            </div>
            <div className="max-h-[920px] overflow-auto bg-slate-100 p-3">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <EthicsChannelLanding config={previewConfig} companies={[previewConfig]} content={form} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Registro</p>
            <p className="mt-3 text-sm text-slate-300">
              {contentId
                ? `Conteúdo vinculado ao registro ${contentId}.`
                : "Esta empresa ainda não tem registro salvo; o formulário usa o fallback padrão até a primeira gravação."}
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}


