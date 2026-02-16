"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  History,
  Landmark,
  Leaf,
  Target,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type InstitutionalItem = { title: string; description?: string; year?: string; image_url?: string; focus_x?: number; focus_y?: number };

type InstitutionalContent = {
  id: string;
  company_id: string | null;
  status?: "draft" | "published";
  title: string;
  subtitle: string | null;
  hero_image_url: string | null;
  hero_focus_x?: number | null;
  hero_focus_y?: number | null;
  about: string | null;
  history: InstitutionalItem[];
  values: InstitutionalItem[];
  culture: InstitutionalItem[];
  updated_at: string;
};

type CompanyBrand = { name: string; primary_color: string | null; logo_url: string | null };

type Slide = {
  key: string;
  kicker: string;
  title: string;
  subtitle?: string;
  body?: string;
  imageUrl?: string | null;
  ctaHref?: string;
  ctaLabel?: string;
};

type ActiveSection = "topo" | "historia" | "missao" | "valores" | "negocio" | "cultura";

const SOLIDA_GREEN = "#005a46";
const SOLIDA_ORANGE = "#f08a1c";
const SOLIDA_GOLD = "#9a8b00";

const FALLBACK_SOLIDA: Omit<InstitutionalContent, "id" | "updated_at"> = {
  company_id: null,
  title: "Sólida do Brasil Energias Renováveis",
  subtitle: "História, valores e cultura",
  hero_image_url: "/institucional/pdf/page-07.jpg",
  about:
    "Fundada no território brasileiro pelo Engenheiro Civil Raul Dantas, em parceria com a Sólida Energias Renováveis (Espanha), a Sólida do Brasil Energias Renováveis iniciou suas operações na cidade de São Paulo/SP em 2007.\n\nNossa organização carrega uma herança de experiência e expertise adquiridas ao longo dos anos. Em 2020, testemunhamos um crescimento expressivo, passando de uma equipe inicial de 10 colaboradores e parceiros para os atuais 60.\n\nAtuamos nos principais projetos de energias renováveis da América Latina, com especialistas em consultoria e engenharia de energias renováveis.",
  history: [
    {
      year: "2007",
      title: "Início em São Paulo/SP",
      description: "Abertura das operações no Brasil com foco em energia renovável.",
      image_url: "/institucional/pdf/page-05.jpg",
    },
    {
      year: "2020",
      title: "Crescimento expressivo",
      description: "Evolução do time, processos e capacidade de entrega.",
      image_url: "/institucional/pdf/page-06.jpg",
    },
    {
      year: "Hoje",
      title: "Atuação na América Latina",
      description: "Participação nos principais projetos e apoio a clientes na transição energética.",
    },
  ],
  values: [
    { title: "Excelência Duradoura", description: "Qualidade e consistência em tudo o que entregamos." },
    { title: "Ética Responsável", description: "Fazemos o certo, com integridade e respeito." },
    { title: "Vanguarda Tecnológica", description: "Inovação aplicada para liderar com eficiência e segurança." },
    { title: "Compromisso Verde", description: "Sustentabilidade como critério real de decisão e execução." },
    { title: "Forja do Futuro", description: "Planejamento e responsabilidade para construir o longo prazo." },
  ],
  culture: [
    {
      title: "Missão",
      description:
        "Conduzir a transição rumo a um futuro energético sustentável, seguro e acessível por meio de soluções inovadoras de energia renovável.",
    },
    {
      title: "Visão",
      description:
        "Ser a referência global em soluções de energia renovável, liderando o mercado com excelência tecnológica e compromisso com a sustentabilidade.",
    },
    {
      title: "Nosso negócio",
      description:
        "Somos uma empresa líder global em engenharia de energia renovável, especialista em consultoria, digitalização e desenvolvimento de conhecimento multidisciplinar, adaptando soluções inovadoras a cada mercado.",
    },
  ],
};

function asItems(v: unknown): InstitutionalItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) return null;
      const description = typeof o.description === "string" ? o.description.trim() : undefined;
      const year = typeof o.year === "string" ? o.year.trim() : undefined;
      const image_url = typeof o.image_url === "string" ? o.image_url.trim() : undefined;
      const focus_x = typeof o.focus_x === "number" && Number.isFinite(o.focus_x) ? o.focus_x : undefined;
      const focus_y = typeof o.focus_y === "number" && Number.isFinite(o.focus_y) ? o.focus_y : undefined;
      return { title, description, year, image_url, focus_x, focus_y } as InstitutionalItem;
    })
    .filter(Boolean) as InstitutionalItem[];
}

function clampIndex(i: number, len: number) {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

function norm(v: string) {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function pickByTitle(items: InstitutionalItem[], includes: string[]) {
  const wanted = includes.map(norm);
  return (
    items.find((it) => {
      const t = norm(it.title ?? "");
      return wanted.some((w) => t.includes(w));
    }) ?? null
  );
}

function useActiveSection(ids: readonly ActiveSection[]) {
  const [active, setActive] = useState<ActiveSection>("topo");
  const lastActive = useRef<ActiveSection>("topo");

  useEffect(() => {
    const sections = ids
      .map((id) => (id === "topo" ? null : document.getElementById(id)))
      .filter(Boolean) as HTMLElement[];

    if (sections.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        const top = visible[0]?.target as HTMLElement | undefined;
        if (!top?.id) return;
        const next = top.id as ActiveSection;
        lastActive.current = next;
        setActive(next);
      },
      { root: null, rootMargin: "-20% 0px -70% 0px", threshold: [0.1, 0.2, 0.35] },
    );

    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [ids]);

  useEffect(() => {
    function onScroll() {
      if (window.scrollY < 40) setActive("topo");
      else setActive(lastActive.current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return active;
}

export default function InstitucionalPage() {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<InstitutionalContent | null>(null);
  const [brand, setBrand] = useState<CompanyBrand | null>(null);
  const [msg, setMsg] = useState("");
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg("");
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) throw new Error("Não autenticado.");

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle<{ company_id: string | null }>();
        if (profileErr) throw new Error(profileErr.message);

        const companyId = profile?.company_id ?? null;

        if (companyId) {
          const br = await supabase
            .from("companies")
            .select("name,primary_color,logo_url")
            .eq("id", companyId)
            .maybeSingle<CompanyBrand>();
          if (!br.error && br.data) setBrand(br.data);
        }

        let row: Record<string, unknown> | null = null;
        if (companyId) {
          const r = await supabase
            .from("institutional_content")
            .select("id,company_id,status,title,subtitle,hero_image_url,hero_focus_x,hero_focus_y,about,history,values,culture,updated_at")
            .eq("company_id", companyId)
            .eq("status", "published")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!r.error) row = r.data ?? null;
        }

        if (!row) {
          const r = await supabase
            .from("institutional_content")
            .select("id,company_id,status,title,subtitle,hero_image_url,hero_focus_x,hero_focus_y,about,history,values,culture,updated_at")
            .is("company_id", null)
            .eq("status", "published")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!r.error) row = r.data ?? null;
        }

        if (!row) {
          setContent({ id: "fallback", updated_at: new Date().toISOString(), ...FALLBACK_SOLIDA });
          return;
        }

        const history = asItems(row.history);
        const values = asItems(row.values);
        const culture = asItems(row.culture);

        setContent({
          id: String(row.id),
          company_id: row.company_id ? String(row.company_id) : null,
          status: row.status === "published" ? "published" : row.status === "draft" ? "draft" : undefined,
          title: String(row.title ?? FALLBACK_SOLIDA.title),
          subtitle: typeof row.subtitle === "string" ? row.subtitle : FALLBACK_SOLIDA.subtitle,
          hero_image_url: typeof row.hero_image_url === "string" ? row.hero_image_url : null,
          hero_focus_x: typeof row.hero_focus_x === "number" ? Number(row.hero_focus_x) : null,
          hero_focus_y: typeof row.hero_focus_y === "number" ? Number(row.hero_focus_y) : null,
          about: typeof row.about === "string" ? row.about : FALLBACK_SOLIDA.about,
          history: history.length ? history : FALLBACK_SOLIDA.history,
          values: values.length ? values : FALLBACK_SOLIDA.values,
          culture: culture.length ? culture : FALLBACK_SOLIDA.culture,
          updated_at: String(row.updated_at ?? new Date().toISOString()),
        });
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao carregar conteúdo institucional.");
        setContent({ id: "fallback", updated_at: new Date().toISOString(), ...FALLBACK_SOLIDA });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const slides = useMemo<Slide[]>(() => {
    if (!content) return [];
    const base: Slide[] = [
      {
        key: "hero",
        kicker: "Institucional",
        title: content.title,
        subtitle: content.subtitle ?? "História, valores e cultura",
        body: content.about ?? FALLBACK_SOLIDA.about ?? "",
        imageUrl: content.hero_image_url,
        ctaHref: "#historia",
        ctaLabel: "Ver história",
      },
    ];

    const timeline: Slide[] = content.history.map((h, idx) => ({
      key: `hist-${idx}`,
      kicker: h.year ? `História • ${h.year}` : "História",
      title: h.title,
      subtitle: "Marcos e evolução",
      body: h.description ?? "",
      imageUrl: h.image_url ?? null,
      ctaHref: "#valores",
      ctaLabel: "Ir para valores",
    }));

    return [...base, ...timeline];
  }, [content]);

  useEffect(() => {
    setSlideIdx((prev) => clampIndex(prev, slides.length));
  }, [slides.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setSlideIdx((i) => clampIndex(i - 1, slides.length));
      if (e.key === "ArrowRight") setSlideIdx((i) => clampIndex(i + 1, slides.length));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length]);

  const current = slides[slideIdx] ?? null;

  const sectionIds = useMemo(
    () => ["topo", "historia", "missao", "valores", "negocio", "cultura"] as const,
    [],
  );
  const active = useActiveSection(sectionIds);

  const isHero = slideIdx === 0;
  const timelineItem = !isHero ? content?.history?.[slideIdx - 1] ?? null : null;
  const slideKicker = isHero ? "Institucional" : timelineItem?.year ? `História • ${timelineItem.year}` : "História";
  const slideTitle = isHero ? content?.title ?? "" : timelineItem?.title ?? current?.title ?? content?.title ?? "";
  const slideSubtitle = isHero ? (content?.subtitle ?? "") : "Marcos e evolução";
  const slideBody = isHero ? (content?.about ?? "") : timelineItem?.description ?? current?.body ?? "";
  const slideImageUrl = isHero
    ? content?.hero_image_url ?? null
    : timelineItem?.image_url ?? current?.imageUrl ?? null;
  const slideCtaHref = isHero ? "#historia" : current?.ctaHref;
  const slideCtaLabel = isHero ? "Ver história" : current?.ctaLabel;

  const slideStyle = useMemo(() => {
    const image = slideImageUrl ? `url('${slideImageUrl}')` : null;
    const bg = image
      ? `linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.70)), ${image}`
      : `radial-gradient(1200px 520px at 18% 10%, ${SOLIDA_GOLD}22, transparent 58%),
         radial-gradient(900px 520px at 92% 30%, ${SOLIDA_GREEN}18, transparent 60%),
         linear-gradient(180deg, #ffffff, #fbfbf8)`;

    return {
      backgroundImage: bg,
      backgroundSize: image ? "cover" : "auto",
      backgroundPosition:
        image && isHero
          ? `${content?.hero_focus_x ?? 50}% ${content?.hero_focus_y ?? 50}%`
          : image
          ? "center"
          : "center",
    } as React.CSSProperties;
  }, [slideImageUrl, isHero, content?.hero_focus_x, content?.hero_focus_y]);

  const topImages = useMemo(() => {
    const list = [
      { url: content?.hero_image_url ?? null, x: content?.hero_focus_x ?? 50, y: content?.hero_focus_y ?? 50 },
      { url: content?.history?.[0]?.image_url ?? null, x: content?.history?.[0]?.focus_x ?? 50, y: content?.history?.[0]?.focus_y ?? 50 },
      { url: content?.history?.[1]?.image_url ?? null, x: content?.history?.[1]?.focus_x ?? 50, y: content?.history?.[1]?.focus_y ?? 50 },
    ].filter((x) => !!x.url) as Array<{ url: string; x: number; y: number }>;

    return list.length
      ? list.slice(0, 3)
      : [
          { url: "/bg-login.jpg", x: 50, y: 50 },
          { url: "/bg-login.jpg", x: 50, y: 50 },
          { url: "/bg-login.jpg", x: 50, y: 50 },
        ];
  }, [content?.hero_image_url, content?.hero_focus_x, content?.hero_focus_y, content?.history]);

  const pillars = useMemo(
    () => ((content?.values?.length ? content.values : FALLBACK_SOLIDA.values) ?? []).slice(0, 5),
    [content?.values],
  );

  const mission = useMemo(
    () => pickByTitle(content?.culture ?? FALLBACK_SOLIDA.culture, ["missao", "missão"])?.description ?? "",
    [content?.culture],
  );
  const vision = useMemo(
    () => pickByTitle(content?.culture ?? FALLBACK_SOLIDA.culture, ["visao", "visão"])?.description ?? "",
    [content?.culture],
  );
  const business = useMemo(
    () => pickByTitle(content?.culture ?? FALLBACK_SOLIDA.culture, ["negocio", "negócio"])?.description ?? "",
    [content?.culture],
  );

  const cultureItems = useMemo(() => {
    const items = (content?.culture?.length ? content.culture : FALLBACK_SOLIDA.culture) ?? [];
    return items.filter((it) => {
      const t = norm(it.title ?? "");
      if (!t) return false;
      return !t.includes("missao") && !t.includes("visao") && !t.includes("negocio");
    });
  }, [content?.culture]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-6 w-[260px] animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-[420px] animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-6 h-56 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="space-y-6 scroll-smooth">
      <div id="topo" />
      <nav className="sticky top-0 z-20 -mx-1 rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900">
              <Landmark size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{brand?.name ?? content.title}</p>
              <p className="truncate text-[11px] text-slate-600">Visão geral institucional</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-xs">
            {[
              { id: "historia" as const, label: "História" },
              { id: "missao" as const, label: "Missão & Visão" },
              { id: "valores" as const, label: "Valores" },
              { id: "negocio" as const, label: "Negócio" },
              { id: "cultura" as const, label: "Cultura" },
            ].map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className="rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                style={
                  active === l.id
                    ? { color: SOLIDA_GREEN, backgroundColor: "#f6faf8", border: `1px solid ${SOLIDA_GREEN}22` }
                    : { border: "1px solid transparent" }
                }
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 p-8" style={slideStyle}>
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-slate-800"
              style={{ borderColor: `${SOLIDA_GOLD}55`, backgroundColor: `${SOLIDA_GOLD}10` }}
            >
              <Building2 size={14} />
              <span style={{ color: SOLIDA_GOLD }}>{slideKicker}</span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-900">{slideTitle}</h1>
            {slideSubtitle ? <p className="mt-2 text-sm text-slate-600">{slideSubtitle}</p> : null}

            {slideBody ? (
              <p className="mt-5 max-w-[68ch] whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{slideBody}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {slideCtaHref && slideCtaLabel ? (
                <a
                  href={slideCtaHref}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: SOLIDA_GREEN }}
                >
                  {slideCtaLabel} <ArrowRight size={16} />
                </a>
              ) : null}

              <a
                href="#missao"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Missão & Visão <ArrowRight size={16} />
              </a>

              {brand?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo_url}
                  alt={brand.name ?? "Empresa"}
                  className="ml-auto hidden h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-2 lg:block"
                />
              ) : null}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Fundação", value: "2007" },
                { label: "Crescimento", value: "2020" },
                { label: "Equipe", value: "60+" },
              ].map((k) => (
                <div key={k.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
                  <p className="text-[11px] font-semibold text-slate-600">{k.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{k.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative mx-auto grid max-w-[520px] grid-cols-12 gap-3">
              {[0, 1, 2].map((i) => {
                const src = topImages[i]?.url ?? "/bg-login.jpg";
                const pos = `${topImages[i]?.x ?? 50}% ${topImages[i]?.y ?? 50}%`;
                const rot = i === 0 ? "-2deg" : i === 1 ? "1.5deg" : "-1deg";
                const col = i === 0 ? "col-span-7" : i === 1 ? "col-span-5" : "col-span-12";
                const h = i === 2 ? "h-[160px]" : "h-[210px]";
                return (
                  <div
                    key={i}
                    className={`relative ${col} ${h} overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm`}
                    style={{ transform: `rotate(${rot})` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: pos }} />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.0), rgba(255,255,255,0.20))" }}
                    />
                  </div>
                );
              })}

              <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full" style={{ background: `${SOLIDA_GOLD}22` }} />
              <div className="pointer-events-none absolute -right-10 bottom-[-30px] h-44 w-44 rounded-full" style={{ background: `${SOLIDA_GREEN}18` }} />
            </div>
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSlideIdx((i) => clampIndex(i - 1, slides.length))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                aria-label="Slide anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setSlideIdx((i) => clampIndex(i + 1, slides.length))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                aria-label="Próximo slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {slides.map((s, idx) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSlideIdx(idx)}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: idx === slideIdx ? SOLIDA_GREEN : "rgba(2,6,23,0.16)",
                    outline: idx === slideIdx ? `2px solid ${SOLIDA_GREEN}22` : "none",
                    outlineOffset: 2,
                  }}
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full" style={{ background: `${SOLIDA_GOLD}18` }} />
        <div className="pointer-events-none absolute -right-12 bottom-[-70px] h-80 w-80 rounded-full" style={{ background: `${SOLIDA_GREEN}14` }} />
      </section>

      <section id="historia" className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
              1. Nossa história
            </h2>
            <p className="mt-1 text-sm text-slate-600">Marcos e conquistas.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <History size={14} /> {content.history.length} itens
          </div>
        </div>

        {content.about ? (
          <div className="mt-5 rounded-3xl border p-5 text-sm leading-relaxed text-slate-700" style={{ borderColor: `${SOLIDA_GOLD}55`, backgroundColor: `${SOLIDA_GOLD}08` }}>
            <p className="whitespace-pre-wrap">{content.about}</p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {content.history.map((h, idx) => (
            <div key={`${h.year ?? "x"}-${idx}`} className="rounded-3xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{h.title}</p>
                {h.year ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{h.year}</span>
                ) : null}
              </div>
              {h.description ? <p className="mt-2 text-sm text-slate-700">{h.description}</p> : null}
              {h.image_url ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={h.image_url}
                    alt=""
                    className="h-44 w-full object-cover"
                    style={{ objectPosition: `${h.focus_x ?? 50}% ${h.focus_y ?? 50}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section id="missao" className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
              2. Missão, visão e valores
            </h2>
            <p className="mt-1 text-sm text-slate-600">Direção clara e princípios inegociáveis.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
            <Leaf size={14} style={{ color: SOLIDA_GREEN }} /> Energia renovável
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl p-6 text-white" style={{ backgroundColor: SOLIDA_GREEN }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
              <Target size={14} /> MISSÃO
            </div>
            <p className="mt-4 text-lg font-semibold leading-snug">{mission || FALLBACK_SOLIDA.culture[0].description}</p>
          </div>

          <div className="rounded-3xl p-6 text-white" style={{ backgroundColor: SOLIDA_ORANGE }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
              <ArrowRight size={14} /> VISÃO
            </div>
            <p className="mt-4 text-lg font-semibold leading-snug">{vision || FALLBACK_SOLIDA.culture[1].description}</p>
          </div>

          <div className="rounded-3xl border p-6" style={{ borderColor: `${SOLIDA_GOLD}55` }}>
            <div className="text-xs font-semibold" style={{ color: SOLIDA_GOLD }}>
              VALORES
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-800">
              {pillars.map((v) => (
                <li key={v.title} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SOLIDA_GOLD }} />
                  <span className="font-semibold">{v.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="valores" className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
          Valores e princípios
        </h2>
        <p className="mt-1 text-sm text-slate-600">Excelência, ética e inovação como padrão.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(content.values.length ? content.values : FALLBACK_SOLIDA.values).map((v, idx) => (
            <div
              key={`${v.title}-${idx}`}
              className="group rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-[#fbfbf8] p-5 transition hover:-translate-y-0.5 hover:border-slate-300"
            >
              <p className="text-base font-semibold text-slate-900">{v.title}</p>
              <p className="mt-2 text-sm text-slate-700">{v.description ?? ""}</p>
              {v.image_url ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.image_url}
                    alt=""
                    className="h-44 w-full object-cover"
                    style={{ objectPosition: `${v.focus_x ?? 50}% ${v.focus_y ?? 50}%` }}
                  />
                </div>
              ) : null}
              <div className="mt-4 h-1 w-14 rounded-full" style={{ backgroundColor: `${SOLIDA_GOLD}55` }} />
            </div>
          ))}
        </div>
      </section>

      <section id="negocio" className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
              3. Nosso negócio
            </h2>
            <p className="mt-1 text-sm text-slate-600">Engenharia e consultoria para a transição energética.</p>
          </div>
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {business || FALLBACK_SOLIDA.culture[2].description}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { title: "Consultoria", desc: "Diagnóstico, viabilidade e suporte técnico." },
                { title: "Digitalização", desc: "Dados e processos para escala e eficiência." },
                { title: "Engenharia", desc: "Projeto e entrega com padrões de excelência." },
                { title: "Conhecimento", desc: "Capacitação e evolução contínua." },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-900">{c.title}</p>
                  <p className="mt-1 text-xs text-slate-700">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-12 gap-3">
              {[0, 1, 2].map((i) => {
                const src = topImages[i]?.url ?? "/bg-login.jpg";
                const pos = `${topImages[i]?.x ?? 50}% ${topImages[i]?.y ?? 50}%`;
                const col = i === 0 ? "col-span-6" : i === 1 ? "col-span-6" : "col-span-12";
                const h = i === 2 ? "h-[220px]" : "h-[170px]";
                const skew = i === 0 ? "-6deg" : i === 1 ? "6deg" : "0deg";
                const unskew = i === 0 ? "6deg" : i === 1 ? "-6deg" : "0deg";
                return (
                  <div key={i} className={`${col} ${h} overflow-hidden rounded-3xl border border-slate-200 bg-slate-50`} style={{ transform: `skewX(${skew})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ transform: `skewX(${unskew})`, objectPosition: pos }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="cultura" className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
          Cultura na prática
        </h2>
        <p className="mt-1 text-sm text-slate-600">Como a cultura se manifesta no dia a dia.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {cultureItems.length ? (
            cultureItems.map((c, idx) => (
              <details key={`${c.title}-${idx}`} className="rounded-3xl border border-slate-200 p-4 open:border-slate-300 open:bg-[#fbfbf8]">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">{c.title}</summary>
                {c.description ? <p className="mt-2 text-sm text-slate-700">{c.description}</p> : null}
                {c.image_url ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.image_url}
                      alt=""
                      className="h-44 w-full object-cover"
                      style={{ objectPosition: `${c.focus_x ?? 50}% ${c.focus_y ?? 50}%` }}
                    />
                  </div>
                ) : null}
              </details>
            ))
          ) : (
            <p className="text-sm text-slate-500">Sem itens de cultura adicionais cadastrados.</p>
          )}
        </div>
      </section>

      {msg ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{msg}</div> : null}
    </div>
  );
}
