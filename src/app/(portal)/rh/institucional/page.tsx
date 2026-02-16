
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  History,
  Landmark,
  Leaf,
  Link as LinkIcon,
  Plus,
  RefreshCcw,
  Save,
  Target,
  Trash2,
  Upload,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type Scope = "company" | "global";

type InstitutionalItem = {
  title: string;
  description: string;
  year?: string;
  image_url?: string;
  focus_x?: number;
  focus_y?: number;
};

type Row = {
  id: string;
  company_id: string | null;
  status: "draft" | "published" | null;
  title: string;
  subtitle: string | null;
  hero_image_url: string | null;
  hero_focus_x: number | null;
  hero_focus_y: number | null;
  about: string | null;
  history: unknown;
  values: unknown;
  culture: unknown;
};

type CompanyOpt = { id: string; name: string };

type Mode = "edit" | "preview";

type Editing =
  | null
  | "hero"
  | "mission"
  | "vision"
  | "business"
  | { kind: "history" | "values" | "culture"; idx: number };

type VersionRow = {
  id: string;
  company_id: string | null;
  status: "draft" | "published";
  action: string;
  created_at: string;
  created_by: string | null;
  snapshot: unknown;
};

type ProfileLite = { id: string; full_name: string | null; email: string | null };

const SOLIDA_GREEN = "#005a46";
const SOLIDA_ORANGE = "#f08a1c";
const SOLIDA_GOLD = "#9a8b00";

function norm(v: string) {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function coerceItems(v: unknown, kind: "history" | "plain"): InstitutionalItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const description = typeof o.description === "string" ? o.description.trim() : "";
      const year = typeof o.year === "string" ? o.year.trim() : undefined;
      const image_url = typeof o.image_url === "string" ? o.image_url.trim() : undefined;
      const focus_x = typeof o.focus_x === "number" && Number.isFinite(o.focus_x) ? o.focus_x : undefined;
      const focus_y = typeof o.focus_y === "number" && Number.isFinite(o.focus_y) ? o.focus_y : undefined;
      if (!title) return null;
      if (kind === "history") return { title, description, year, image_url, focus_x, focus_y };
      return { title, description, image_url, focus_x, focus_y };
    })
    .filter(Boolean) as InstitutionalItem[];
}

function cleanItems(items: InstitutionalItem[], kind: "history" | "plain") {
  return items
    .map((it) => {
      const title = (it.title ?? "").trim();
      const description = (it.description ?? "").trim();
      const year = (it.year ?? "").trim();
      const image_url = (it.image_url ?? "").trim();
      const focus_x = typeof it.focus_x === "number" && Number.isFinite(it.focus_x) ? it.focus_x : undefined;
      const focus_y = typeof it.focus_y === "number" && Number.isFinite(it.focus_y) ? it.focus_y : undefined;
      if (!title) return null;
      if (kind === "history") {
        return {
          year: year || undefined,
          title,
          description: description || undefined,
          image_url: image_url || undefined,
          focus_x,
          focus_y,
        };
      }
      return { title, description: description || undefined, image_url: image_url || undefined, focus_x, focus_y };
    })
    .filter(Boolean);
}

// bucket e tratado no servidor via /api/rh/institucional/upload

const FALLBACK_SOLIDA: {
  title: string;
  subtitle: string;
  hero_image_url: string;
  about: string;
  history: InstitutionalItem[];
  values: InstitutionalItem[];
  culture: InstitutionalItem[];
} = {
  title: "Sólida do Brasil Energias Renováveis",
  subtitle: "História, valores e cultura",
  hero_image_url: "/institucional/pdf/page-07.jpg",
  about:
    "Fundada no território brasileiro pelo Engenheiro Civil Raul Dantas, em parceria com a Sólida Energias Renováveis (Espanha), a Sólida do Brasil Energias Renováveis iniciou suas operações na cidade de São Paulo/SP em 2007.\n\nEm 2020, testemunhamos um crescimento expressivo, passando de uma equipe inicial de 10 colaboradores e parceiros para os atuais 60.\n\nAtuamos nos principais projetos de energias renováveis da América Latina, com especialistas em consultoria e engenharia de energias renováveis.",
  history: [
    { year: "2007", title: "Início em São Paulo/SP", description: "Abertura das operações no Brasil." },
    { year: "2020", title: "Crescimento expressivo", description: "Evolução do time e da capacidade de entrega." },
    { year: "Hoje", title: "América Latina", description: "Atuação nos principais projetos e apoio à transição energética." },
  ],
  values: [
    { title: "Excelência Duradoura", description: "Qualidade e consistência em tudo o que entregamos." },
    { title: "Ética Responsável", description: "Integridade e respeito nas relações." },
    { title: "Vanguarda Tecnológica", description: "Inovação aplicada com eficiência e segurança." },
    { title: "Compromisso Verde", description: "Sustentabilidade como critério real de decisão e execução." },
    { title: "Forja do Futuro", description: "Planejamento e responsabilidade no longo prazo." },
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
        "Engenharia de energia renovável com consultoria, digitalização e desenvolvimento de conhecimento multidisciplinar, adaptando soluções a cada mercado.",
    },
  ],
};

function pickByTitle(items: InstitutionalItem[], includes: string[]) {
  const wanted = includes.map(norm);
  return (
    items.find((it) => {
      const t = norm(it.title ?? "");
      return wanted.some((w) => t.includes(w));
    }) ?? null
  );
}

function buttonClass(variant: "solid" | "outline" | "ghost") {
  if (variant === "solid") return "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white";
  if (variant === "outline")
    return "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50";
  return "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50";
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function uploadToInstitutionalBucket(file: File, prefix: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token ?? null;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("prefix", prefix);

  const res = await fetch("/api/rh/institucional/upload", {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  const json = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string };
  if (!res.ok || !json.publicUrl) {
    throw new Error(json.error || `Erro no upload (status ${res.status})`);
  }

  return json.publicUrl;
}

function ClickToUploadImage({
  src,
  alt,
  heightClass,
  prefix,
  label,
  focusX,
  focusY,
  onFocusChange,
  onUploaded,
  onError,
}: {
  src: string | null;
  alt?: string;
  heightClass: string; // ex: "h-44"
  prefix: string;
  label: string;
  focusX?: number;
  focusY?: number;
  onFocusChange?: (x: number, y: number) => void;
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = React.useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displaySrc = previewUrl ?? src;
  const fx = typeof focusX === "number" && Number.isFinite(focusX) ? focusX : 50;
  const fy = typeof focusY === "number" && Number.isFinite(focusY) ? focusY : 50;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={alt ?? ""}
          className={`${heightClass} w-full select-none object-cover`}
          draggable={false}
          style={{ objectPosition: `${fx}% ${fy}%` }}
          onPointerDown={(e) => {
            if (!onFocusChange) return;
            if (!displaySrc) return;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            setDragging(true);
            startRef.current = { x: e.clientX, y: e.clientY, fx, fy };
          }}
          onPointerMove={(e) => {
            if (!dragging || !onFocusChange) return;
            const s = startRef.current;
            if (!s) return;
            const el = e.currentTarget as HTMLImageElement;
            const rect = el.getBoundingClientRect();
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            const nextX = Math.max(0, Math.min(100, s.fx + (dx / Math.max(1, rect.width)) * 100));
            const nextY = Math.max(0, Math.min(100, s.fy + (dy / Math.max(1, rect.height)) * 100));
            onFocusChange(Number(nextX.toFixed(2)), Number(nextY.toFixed(2)));
          }}
          onPointerUp={() => {
            setDragging(false);
            startRef.current = null;
          }}
          onPointerCancel={() => {
            setDragging(false);
            startRef.current = null;
          }}
        />
      ) : (
        <div className={`${heightClass} flex w-full items-center justify-center px-3 text-center text-xs font-semibold text-slate-500`}>
          {label}
        </div>
      )}

      {/* Scrim para garantir contraste dos controles (principalmente em imagens claras) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />

      {/* Dica */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-xl bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
        Arraste para ajustar
      </div>

      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-white/40 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-900 shadow-lg backdrop-blur hover:bg-white"
          onClick={() => inputRef.current?.click()}
        >
          Alterar imagem
        </button>
        {onFocusChange ? (
          <button
            type="button"
            className="rounded-xl border border-white/40 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-900 shadow-lg backdrop-blur hover:bg-white"
            onClick={() => onFocusChange(50, 50)}
            title="Centralizar foco"
          >
            Centralizar
          </button>
        ) : null}
      </div>

      {busy ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/15">
          <div className="rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900">Enviando imagem...</div>
        </div>
      ) : null}

      {localErr ? (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[90%] rounded-xl bg-rose-600/95 px-2 py-1 text-[11px] font-semibold text-white">
          {localErr}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (!f) return;
          void (async () => {
            setLocalErr(null);
            setBusy(true);

            const nextPreview = URL.createObjectURL(f);
            setPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return nextPreview;
            });

            try {
              const url = await uploadToInstitutionalBucket(f, prefix);
              if (onFocusChange) onFocusChange(50, 50);
              onUploaded(url);
            } catch (err: unknown) {
              const m = err instanceof Error ? err.message : "Erro ao fazer upload.";
              setLocalErr(m);
              onError(m);
            } finally {
              setBusy(false);
              // permite re-enviar o mesmo arquivo
              e.target.value = "";
            }
          })();
        }}
      />
    </div>
  );
}

export default function RHInstitucionalPage() {
  const { loading: roleLoading, isRH, error: roleErr } = useUserRole();

  const [mode, setMode] = useState<Mode>("edit");
  const [editing, setEditing] = useState<Editing>(null);

  const [scope, setScope] = useState<Scope>("company");
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [companyId, setCompanyId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [rowId, setRowId] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [title, setTitle] = useState<string>(FALLBACK_SOLIDA.title);
  const [subtitle, setSubtitle] = useState<string>(FALLBACK_SOLIDA.subtitle);
  const [heroImageUrl, setHeroImageUrl] = useState<string>(FALLBACK_SOLIDA.hero_image_url);
  const [heroFocusX, setHeroFocusX] = useState<number>(50);
  const [heroFocusY, setHeroFocusY] = useState<number>(50);
  const [about, setAbout] = useState<string>(FALLBACK_SOLIDA.about);

  const [history, setHistory] = useState<InstitutionalItem[]>(FALLBACK_SOLIDA.history);
  const [values, setValues] = useState<InstitutionalItem[]>(FALLBACK_SOLIDA.values);
  const [culture, setCulture] = useState<InstitutionalItem[]>(FALLBACK_SOLIDA.culture);

  const canEdit = mode === "edit";

  const mission = useMemo(() => pickByTitle(culture, ["missao", "missão"])?.description ?? "", [culture]);
  const vision = useMemo(() => pickByTitle(culture, ["visao", "visão"])?.description ?? "", [culture]);
  const business = useMemo(() => pickByTitle(culture, ["negocio", "negócio"])?.description ?? "", [culture]);

  const topImages = useMemo(() => {
    const list = [
      { url: heroImageUrl || null, x: heroFocusX, y: heroFocusY },
      { url: history?.[0]?.image_url ?? null, x: history?.[0]?.focus_x ?? 50, y: history?.[0]?.focus_y ?? 50 },
      { url: history?.[1]?.image_url ?? null, x: history?.[1]?.focus_x ?? 50, y: history?.[1]?.focus_y ?? 50 },
    ].filter((x) => !!x.url) as Array<{ url: string; x: number; y: number }>;

    return list.length
      ? list.slice(0, 3)
      : [
          { url: "/bg-login.jpg", x: 50, y: 50 },
          { url: "/bg-login.jpg", x: 50, y: 50 },
          { url: "/bg-login.jpg", x: 50, y: 50 },
        ];
  }, [heroImageUrl, heroFocusX, heroFocusY, history]);

  const cultureItems = useMemo(() => {
    const items = culture ?? [];
    return items.filter((it) => {
      const t = norm(it.title ?? "");
      if (!t) return false;
      return !t.includes("missao") && !t.includes("visao") && !t.includes("negocio");
    });
  }, [culture]);

  async function loadCompanies(): Promise<CompanyOpt[]> {
    const r = await supabase.from("companies").select("id,name").order("created_at", { ascending: false });
    if (r.error) throw r.error;
    const list = ((r.data ?? []) as CompanyOpt[]).map((c) => ({ id: String(c.id), name: String(c.name) }));
    setCompanies(list);
    return list;
  }

  function applyRow(row: Row | null) {
    if (!row) {
      setRowId(null);
      setTitle(FALLBACK_SOLIDA.title);
      setSubtitle(FALLBACK_SOLIDA.subtitle);
      setHeroImageUrl(FALLBACK_SOLIDA.hero_image_url);
      setHeroFocusX(50);
      setHeroFocusY(50);
      setAbout(FALLBACK_SOLIDA.about);
      setHistory(FALLBACK_SOLIDA.history);
      setValues(FALLBACK_SOLIDA.values);
      setCulture(FALLBACK_SOLIDA.culture);
      return;
    }

    setRowId(String(row.id));
    setTitle(String(row.title ?? FALLBACK_SOLIDA.title));
    setSubtitle(typeof row.subtitle === "string" ? row.subtitle : FALLBACK_SOLIDA.subtitle);
    setHeroImageUrl(typeof row.hero_image_url === "string" ? row.hero_image_url : "");
    setHeroFocusX(typeof row.hero_focus_x === "number" ? Number(row.hero_focus_x) : 50);
    setHeroFocusY(typeof row.hero_focus_y === "number" ? Number(row.hero_focus_y) : 50);
    setAbout(typeof row.about === "string" ? row.about : FALLBACK_SOLIDA.about);

    const h = coerceItems(row.history, "history");
    const v = coerceItems(row.values, "plain");
    const c = coerceItems(row.culture, "plain");

    setHistory(h.length ? h : FALLBACK_SOLIDA.history);
    setValues(v.length ? v : FALLBACK_SOLIDA.values);
    setCulture(c.length ? c : FALLBACK_SOLIDA.culture);
  }

  async function loadContent() {
    setLoading(true);
    setMsg("");
    try {
      const companyScopeId = scope === "company" ? (companyId || null) : null;

      let q = supabase
        .from("institutional_content")
        .select("id,company_id,status,title,subtitle,hero_image_url,hero_focus_x,hero_focus_y,about,history,values,culture")
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (companyScopeId) q = q.eq("company_id", companyScopeId);
      else q = q.is("company_id", null);

      const r = await q.maybeSingle<Row>();
      if (r.error) throw r.error;
      applyRow(r.data ?? null);

      // Carrega ultima publicacao (row published) separadamente do draft.
      let pubQ = supabase
        .from("institutional_content")
        .select("published_at,updated_at")
        .eq("status", "published")
        .limit(1)
        .order("updated_at", { ascending: false });

      if (companyScopeId) pubQ = pubQ.eq("company_id", companyScopeId);
      else pubQ = pubQ.is("company_id", null);

      const pub = await pubQ.maybeSingle<{ published_at: string | null; updated_at: string | null }>();
      if (!pub.error && pub.data?.published_at) setPublishedAt(pub.data.published_at);
      else setPublishedAt(null);

      // Historico de alteracoes
      const histQ = supabase
        .from("institutional_content_versions")
        .select("id,company_id,status,action,created_at,created_by,snapshot")
        .order("created_at", { ascending: false })
        .limit(3);

      const hist = companyScopeId ? await histQ.eq("company_id", companyScopeId) : await histQ.is("company_id", null);
      if (hist.error) {
        // Se a tabela ainda nao foi criada no Supabase, nao bloqueia o editor.
        setVersions([]);
        setProfilesById({});
        return;
      }

      const list = (hist.data ?? []) as VersionRow[];
      setVersions(list);

      const userIds = Array.from(new Set(list.map((v) => v.created_by).filter(Boolean))) as string[];
      if (userIds.length) {
        const pr = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
        if (!pr.error) {
          const map: Record<string, ProfileLite> = {};
          for (const p of (pr.data ?? []) as ProfileLite[]) map[String(p.id)] = p;
          setProfilesById(map);
        } else {
          setProfilesById({});
        }
      } else {
        setProfilesById({});
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar conteúdo institucional.");
      applyRow(null);
      setPublishedAt(null);
      setVersions([]);
      setProfilesById({});
    } finally {
      setLoading(false);
    }
  }

  async function saveContent() {
    setSaving(true);
    setMsg("");

    try {
      const companyScopeId = scope === "company" ? (companyId || null) : null;
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      const payload = {
        company_id: companyScopeId,
        status: "draft",
        title: title.trim() || FALLBACK_SOLIDA.title,
        subtitle: subtitle.trim() || null,
        hero_image_url: heroImageUrl.trim() || null,
        hero_focus_x: heroFocusX,
        hero_focus_y: heroFocusY,
        about: about.trim() || null,
        history: cleanItems(history, "history"),
        values: cleanItems(values, "plain"),
        culture: cleanItems(culture, "plain"),
        updated_by: user?.id ?? null,
      };

      if (rowId) {
        const r = await supabase.from("institutional_content").update(payload).eq("id", rowId).select("id").maybeSingle();
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from("institutional_content").insert(payload).select("id").maybeSingle();
        if (r.error) throw r.error;
        setRowId(r.data?.id ? String(r.data.id) : null);
      }

      setMsg("Salvo com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar conteúdo institucional.");
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft() {
    setMsg("");
    try {
      const companyScopeId = scope === "company" ? (companyId || null) : null;
      const { error } = await supabase.rpc("publish_institutional_content", { p_company_id: companyScopeId });
      if (error) throw error;
      setMsg("Publicado com sucesso.");
      await loadContent();
      // publishedAt vem junto no draft quando existir (para mostrar ultima publicacao)
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao publicar.");
    }
  }

  async function restoreDraftFromVersion(versionId: string) {
    if (!confirm("Restaurar esta versão como rascunho atual? Você poderá revisar e publicar depois.")) return;
    setMsg("");
    setRestoringId(versionId);
    try {
      const { error } = await supabase.rpc("restore_institutional_draft", { p_version_id: versionId });
      if (error) throw error;
      setMode("edit");
      setEditing(null);
      setMsg("Rascunho restaurado. Revise e clique em Salvar/Publicar quando desejar.");
      await loadContent();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao restaurar versão.");
    } finally {
      setRestoringId(null);
    }
  }

  async function linkProfileToCompany() {
    if (!companyId) return;
    setMsg("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setMsg("Não autenticado.");
      return;
    }
    const r = await supabase.from("profiles").update({ company_id: companyId }).eq("id", user.id);
    if (r.error) setMsg(r.error.message);
    else setMsg("Empresa vinculada ao seu perfil.");
  }

  async function unlinkProfileCompany() {
    if (!confirm("Desvincular a empresa do seu perfil? Isso não afeta o cadastro da empresa.")) return;
    setMsg("");
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setMsg("Não autenticado.");
      return;
    }
    const r = await supabase.from("profiles").update({ company_id: null }).eq("id", user.id);
    if (r.error) setMsg(r.error.message);
    else setMsg("Empresa desvinculada do seu perfil.");
  }

  function useSolida() {
    const solida = companies.find((c) => norm(c.name).includes("solida")) ?? null;
    if (solida) {
      setScope("company");
      setCompanyId(solida.id);
      setMsg("");
    } else {
      setMsg("Empresa 'Sólida' não encontrada em companies.");
    }
  }

  useEffect(() => {
    let alive = true;
    async function boot() {
      try {
        const list = await loadCompanies();
        if (!alive) return;

        // Prefer: empresa vinculada ao perfil. Fallback: "Sólida" se existir.
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!alive) return;

        if (user) {
          const p = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle<{ company_id: string | null }>();
          if (!alive) return;
          const cid = p.data?.company_id ?? null;
          if (cid) {
            setScope("company");
            setCompanyId(cid);
            return;
          }
        }

        const solida = list.find((c) => norm(c.name).includes("solida")) ?? null;
        if (solida) {
          setScope("company");
          setCompanyId(solida.id);
        }
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Erro ao carregar empresas.");
      }
    }
    void boot();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!roleLoading && isRH) void loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, isRH, scope, companyId]);

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-6 w-[260px] animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-[420px] animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-6 h-56 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!isRH) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Acesso restrito ao RH/Admin. {roleErr ? `(${roleErr})` : ""}
      </div>
    );
  }

  return (
    <div className="space-y-6 scroll-smooth">
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900">
              <Landmark size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">RH • Institucional</p>
              <p className="truncate text-[11px] text-slate-600">Editor com pré-visualização e publicação</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href="/institucional" target="_blank" rel="noreferrer" className={buttonClass("outline")}>
              <ExternalLink size={16} /> Abrir institucional
            </a>

            {mode === "edit" ? (
              <button
                type="button"
                className={buttonClass("outline")}
                onClick={() => {
                  setEditing(null);
                  setMode("preview");
                }}
              >
                <LinkIcon size={16} /> Pré-visualização
              </button>
            ) : (
              <button type="button" className={buttonClass("outline")} onClick={() => setMode("edit")}>
                <LinkIcon size={16} /> Continuar editando
              </button>
            )}

            <button type="button" className={buttonClass("outline")} onClick={() => void loadContent()} disabled={loading || saving}>
              <RefreshCcw size={16} /> Atualizar
            </button>

            <button
              type="button"
              className={buttonClass("outline")}
              onClick={() => void publishDraft()}
              disabled={saving || loading}
              title="Copia o rascunho para a versao publicada"
            >
              <Send size={16} /> Publicar
            </button>

            <button
              type="button"
              className={buttonClass("solid")}
              style={{ backgroundColor: SOLIDA_GREEN }}
              onClick={() => void saveContent()}
              disabled={saving}
            >
              <Save size={16} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Editando: Rascunho</span>
          {publishedAt ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              Última publicação: {new Date(publishedAt).toLocaleString()}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">Ainda não publicado</span>
          )}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <label className="block text-xs font-semibold text-slate-700">Escopo</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={buttonClass("outline")}
                onClick={() => setScope("company")}
                style={scope === "company" ? { borderColor: `${SOLIDA_GREEN}55`, backgroundColor: "#f6faf8" } : undefined}
              >
                <Building2 size={16} /> Empresa
              </button>
              <button
                type="button"
                className={buttonClass("outline")}
                onClick={() => {
                  setScope("global");
                  setCompanyId("");
                }}
                style={scope === "global" ? { borderColor: `${SOLIDA_GREEN}55`, backgroundColor: "#f6faf8" } : undefined}
              >
                Visão global
              </button>
              <button type="button" className={buttonClass("outline")} onClick={useSolida}>
                Usar Sólida
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <label className="block text-xs font-semibold text-slate-700">Selecionar empresa</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="h-11 w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={scope !== "company"}
              >
                <option value="">Selecione...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={buttonClass("outline")}
                onClick={() => void linkProfileToCompany()}
                disabled={!companyId || scope !== "company"}
              >
                <Target size={16} /> Vincular ao meu perfil
              </button>

              <button type="button" className={buttonClass("outline")} onClick={() => void unlinkProfileCompany()}>
                <Trash2 size={16} /> Desvincular do meu perfil
              </button>
            </div>
          </div>
        </div>
      </div>

      <details className="rounded-3xl border border-slate-200 bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900">
              <History size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Histórico de alterações</p>
              <p className="truncate text-[11px] text-slate-600">
                {versions.length ? `Últimas ${versions.length} versões` : "Nenhuma versão encontrada ainda"}
              </p>
            </div>
          </div>

          <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            Mostrar
          </span>
        </summary>

        <div className="mt-3">
          <p className="text-[11px] text-slate-600">Últimas versões do rascunho e do publicado</p>
        </div>

        {versions.length ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
              <div className="col-span-4">Quando</div>
              <div className="col-span-4">Quem</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>
            <div className="divide-y divide-slate-100">
              {versions.map((v) => {
                const p = v.created_by ? profilesById[v.created_by] : undefined;
                const who = (p?.full_name ?? "").trim() || (p?.email ?? "").trim() || (v.created_by ? v.created_by.slice(0, 8) : "Sistema");
                const snap = (v.snapshot ?? null) as null | { title?: unknown };
                const snapTitle = typeof snap?.title === "string" ? snap.title : "";
                const chip =
                  v.status === "published"
                    ? "rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700"
                    : "rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700";

                return (
                  <div key={v.id} className="grid grid-cols-12 items-center gap-2 px-3 py-3 text-sm">
                    <div className="col-span-4 min-w-0">
                      <p className="truncate font-semibold text-slate-900">{new Date(v.created_at).toLocaleString()}</p>
                      <p className="truncate text-[11px] text-slate-600">
                        {v.action}
                        {snapTitle ? ` • ${snapTitle}` : ""}
                      </p>
                    </div>
                    <div className="col-span-4 min-w-0 truncate text-slate-700">{who}</div>
                    <div className="col-span-2">
                      <span className={chip}>{v.status === "published" ? "Publicado" : "Rascunho"}</span>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        type="button"
                        className={buttonClass("outline")}
                        onClick={() => void restoreDraftFromVersion(v.id)}
                        disabled={!!restoringId}
                        title="Restaura esta versao como rascunho (nao publica automaticamente)"
                      >
                        {restoringId === v.id ? "Restaurando..." : "Restaurar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Nenhuma versão encontrada ainda. Assim que você salvar/publicar, as versões aparecerão aqui.
          </div>
        )}
      </details>

      <nav className="sticky top-0 z-20 -mx-1 rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900">
              <Landmark size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{title}</p>
              <p className="truncate text-[11px] text-slate-600">Visão geral institucional</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-xs">
            {[
              { id: "historia", label: "História" },
              { id: "missao", label: "Missão & Visão" },
              { id: "valores", label: "Valores" },
              { id: "negocio", label: "Negócio" },
              { id: "cultura", label: "Cultura" },
            ].map((l) => (
              <a key={l.id} href={`#${l.id}`} className="rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <section
        id="topo"
        className="relative overflow-hidden rounded-3xl border border-slate-200 p-8"
        style={{
          backgroundImage: heroImageUrl
            ? `linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.70)), url('${heroImageUrl}')`
            : `radial-gradient(1200px 520px at 18% 10%, ${SOLIDA_GOLD}22, transparent 58%),
               radial-gradient(900px 520px at 92% 30%, ${SOLIDA_GREEN}18, transparent 60%),
               linear-gradient(180deg, #ffffff, #fbfbf8)`,
          backgroundSize: heroImageUrl ? "cover" : "auto",
          backgroundPosition: heroImageUrl ? `${heroFocusX}% ${heroFocusY}%` : "center",
        }}
      >
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-slate-800"
              style={{ borderColor: `${SOLIDA_GOLD}55`, backgroundColor: `${SOLIDA_GOLD}10` }}
            >
              <Building2 size={14} />
              <span style={{ color: SOLIDA_GOLD }}>Institucional</span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}

            {about ? (
              <p className="mt-5 max-w-[68ch] whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{about}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <a href="#historia" className={buttonClass("solid")} style={{ backgroundColor: SOLIDA_GREEN }}>
                Ver história <ArrowRight size={16} />
              </a>

              <a href="#missao" className={buttonClass("outline")}>
                Missão & Visão <ArrowRight size={16} />
              </a>

              {canEdit ? (
                <button type="button" className={buttonClass("outline")} onClick={() => setEditing("hero")}>
                  Editar <ArrowRight size={16} />
                </button>
              ) : null}
            </div>

            {canEdit && editing === "hero" ? (
              <div className="mt-5 rounded-3xl border border-slate-200 bg-white/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Editar topo</p>
                  <button type="button" className={buttonClass("ghost")} onClick={() => setEditing(null)}>
                    Fechar
                  </button>
                </div>

                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Título
                    <input
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Subtítulo
                    <input
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Texto (sobre)
                    <textarea
                      className="min-h-[120px] rounded-2xl border border-slate-200 bg-white p-3 text-sm"
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Imagem do topo (URL)
                    <input
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={heroImageUrl}
                      onChange={(e) => setHeroImageUrl(e.target.value)}
                    />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">Enquadramento (arraste a imagem)</p>
                    <p className="mt-1 text-xs text-slate-500">Use para evitar cortes indesejados no topo.</p>
                    <div className="mt-3">
                      <ClickToUploadImage
                        src={heroImageUrl || null}
                        heightClass="h-40"
                        prefix={`${scope === "company" && companyId ? companyId : "global"}/hero`}
                        label="Envie a imagem do topo"
                        focusX={heroFocusX}
                        focusY={heroFocusY}
                        onFocusChange={(x, y) => {
                          setHeroFocusX(x);
                          setHeroFocusY(y);
                        }}
                        onUploaded={(url) => {
                          setHeroImageUrl(url);
                          setMsg("Imagem do topo atualizada no rascunho.");
                        }}
                        onError={(m) => setMsg(m)}
                      />
                    </div>
                  </div>
                  <label className="grid gap-1 text-xs font-semibold text-slate-700">
                    Modificar imagem (upload)
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        if (!f) return;
                        void (async () => {
                          setMsg("");
                          try {
                            const prefix = `${scope === "company" && companyId ? companyId : "global"}/hero`;
                            const url = await uploadToInstitutionalBucket(f, prefix);
                            setHeroImageUrl(url);
                            setHeroFocusX(50);
                            setHeroFocusY(50);
                            setMsg("Imagem atualizada no rascunho.");
                          } catch (err: unknown) {
                            setMsg(err instanceof Error ? err.message : "Erro ao fazer upload.");
                          }
                        })();
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <div className="relative mx-auto grid max-w-[520px] grid-cols-12 gap-3">
              {[0, 1, 2].map((i) => {
                const rot = i === 0 ? "-2deg" : i === 1 ? "1.5deg" : "-1deg";
                const col = i === 0 ? "col-span-7" : i === 1 ? "col-span-5" : "col-span-12";
                const h = i === 2 ? "h-[160px]" : "h-[210px]";

                const src =
                  i === 0 ? heroImageUrl || null : i === 1 ? history?.[0]?.image_url ?? null : history?.[1]?.image_url ?? null;

                const prefixBase = `${scope === "company" && companyId ? companyId : "global"}/collage/${i}`;
                return (
                  <div
                    key={i}
                    className={`relative ${col} ${h} overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm`}
                    style={{ transform: `rotate(${rot})` }}
                  >
                    {canEdit ? (
                      <ClickToUploadImage
                        src={src}
                        heightClass="h-full"
                        prefix={prefixBase}
                        label="Clique para enviar imagem"
                        focusX={
                          i === 0 ? heroFocusX : i === 1 ? history?.[0]?.focus_x ?? 50 : history?.[1]?.focus_x ?? 50
                        }
                        focusY={
                          i === 0 ? heroFocusY : i === 1 ? history?.[0]?.focus_y ?? 50 : history?.[1]?.focus_y ?? 50
                        }
                        onFocusChange={(x, y) => {
                          if (i === 0) {
                            setHeroFocusX(x);
                            setHeroFocusY(y);
                            return;
                          }
                          if (i === 1) {
                            setHistory((prev) => prev.map((it, idx) => (idx === 0 ? { ...it, focus_x: x, focus_y: y } : it)));
                            return;
                          }
                          if (i === 2) {
                            setHistory((prev) => prev.map((it, idx) => (idx === 1 ? { ...it, focus_x: x, focus_y: y } : it)));
                          }
                        }}
                        onUploaded={(url) => {
                          setMsg("Imagem atualizada no rascunho.");
                          if (i === 0) {
                            setHeroImageUrl(url);
                            setHeroFocusX(50);
                            setHeroFocusY(50);
                            return;
                          }
                          if (i === 1) {
                            if (!history?.[0]) return;
                            setHistory((prev) =>
                              prev.map((it, idx) => (idx === 0 ? { ...it, image_url: url, focus_x: 50, focus_y: 50 } : it)),
                            );
                            return;
                          }
                          if (i === 2) {
                            if (!history?.[1]) return;
                            setHistory((prev) =>
                              prev.map((it, idx) => (idx === 1 ? { ...it, image_url: url, focus_x: 50, focus_y: 50 } : it)),
                            );
                          }
                        }}
                        onError={(m) => setMsg(m)}
                      />
                    ) : src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/bg-login.jpg" alt="" className="h-full w-full object-cover" />
                    )}
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
            <History size={14} /> {history.length} itens
          </div>
        </div>

        {canEdit ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass("outline")} onClick={() => setEditing("hero")}>
              Editar texto principal
            </button>
            <button
              type="button"
              className={buttonClass("outline")}
              onClick={() => {
                setHistory((prev) => [...prev, { year: "", title: "Novo marco", description: "", image_url: "" }]);
                setEditing({ kind: "history", idx: history.length });
              }}
            >
              <Plus size={16} /> Adicionar item
            </button>
          </div>
        ) : null}

        {about ? (
          <div
            className="mt-5 rounded-3xl border p-5 text-sm leading-relaxed text-slate-700"
            style={{ borderColor: `${SOLIDA_GOLD}55`, backgroundColor: `${SOLIDA_GOLD}08` }}
          >
            <p className="whitespace-pre-wrap">{about}</p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {history.map((h, idx) => {
            const isEditing =
              canEdit && !!editing && typeof editing === "object" && editing.kind === "history" && editing.idx === idx;
            return (
              <div
                key={`${h.year ?? "x"}-${idx}`}
                className="rounded-3xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{h.title}</p>
                  <div className="flex items-center gap-2">
                    {h.year ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{h.year}</span>
                    ) : null}
                    {canEdit ? (
                      <button type="button" className={buttonClass("ghost")} onClick={() => setEditing({ kind: "history", idx })}>
                        Editar
                      </button>
                    ) : null}
                  </div>
                </div>

                {h.description ? <p className="mt-2 text-sm text-slate-700">{h.description}</p> : null}
                {canEdit ? (
                  <div className="mt-3">
                    <ClickToUploadImage
                      src={h.image_url ?? null}
                      heightClass="h-44"
                      prefix={`${scope === "company" && companyId ? companyId : "global"}/history/${idx}-${newId()}`}
                      label="Clique para enviar imagem"
                      focusX={h.focus_x ?? 50}
                      focusY={h.focus_y ?? 50}
                      onFocusChange={(x, y) => {
                        setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, focus_x: x, focus_y: y } : it)));
                      }}
                      onUploaded={(url) => {
                        setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, image_url: url, focus_x: 50, focus_y: 50 } : it)));
                        setMsg("Imagem atualizada no rascunho.");
                      }}
                      onError={(m) => setMsg(m)}
                    />
                  </div>
                ) : h.image_url ? (
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

                {isEditing ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">Editar item</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={buttonClass("ghost")}
                          onClick={() => {
                            setHistory((prev) => prev.filter((_, i) => i !== idx));
                            setEditing(null);
                          }}
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                        <button type="button" className={buttonClass("ghost")} onClick={() => setEditing(null)}>
                          Fechar
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="grid gap-1 text-xs font-semibold text-slate-700">
                          Ano
                          <input
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            value={h.year ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, year: v } : it)));
                            }}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-700">
                          Título
                          <input
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            value={h.title}
                            onChange={(e) => {
                              const v = e.target.value;
                              setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, title: v } : it)));
                            }}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Descrição
                        <textarea
                          className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 text-sm"
                          value={h.description}
                          onChange={(e) => {
                            const v = e.target.value;
                            setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, description: v } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Imagem (URL)
                        <input
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={h.image_url ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, image_url: v } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Modificar imagem (upload)
                        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                          <Upload size={14} /> Envie uma nova imagem para este item
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (!f) return;
                            void (async () => {
                              setMsg("");
                              try {
                                const prefix = `${scope === "company" && companyId ? companyId : "global"}/history/${idx}-${newId()}`;
                                const url = await uploadToInstitutionalBucket(f, prefix);
                                setHistory((prev) => prev.map((it, i) => (i === idx ? { ...it, image_url: url } : it)));
                                setMsg("Imagem atualizada no rascunho.");
                              } catch (err: unknown) {
                                setMsg(err instanceof Error ? err.message : "Erro ao fazer upload.");
                              }
                            })();
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
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
          <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex">
            <Leaf size={14} style={{ color: SOLIDA_GREEN }} /> Energia renovável
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl p-6 text-white" style={{ backgroundColor: SOLIDA_GREEN }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                <Target size={14} /> MISSÃO
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                  onClick={() => setEditing("mission")}
                >
                  Editar
                </button>
              ) : null}
            </div>
            <p className="mt-4 text-lg font-semibold leading-snug">{mission || FALLBACK_SOLIDA.culture[0].description}</p>

            {canEdit && editing === "mission" ? (
              <div className="mt-4 rounded-2xl bg-white/10 p-3">
                <label className="grid gap-1 text-xs font-semibold text-white/90">
                  Texto da missão
                  <textarea
                    className="min-h-[110px] rounded-xl bg-white/90 p-3 text-sm text-slate-900"
                    value={mission}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCulture((prev) => {
                        const next = [...prev];
                        const idx = next.findIndex((it) => norm(it.title).includes("missao"));
                        if (idx >= 0) next[idx] = { ...next[idx], description: v };
                        else next.push({ title: "Missão", description: v });
                        return next;
                      });
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl p-6 text-white" style={{ backgroundColor: SOLIDA_ORANGE }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                <ArrowRight size={14} /> VISÃO
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                  onClick={() => setEditing("vision")}
                >
                  Editar
                </button>
              ) : null}
            </div>
            <p className="mt-4 text-lg font-semibold leading-snug">{vision || FALLBACK_SOLIDA.culture[1].description}</p>

            {canEdit && editing === "vision" ? (
              <div className="mt-4 rounded-2xl bg-white/10 p-3">
                <label className="grid gap-1 text-xs font-semibold text-white/90">
                  Texto da visão
                  <textarea
                    className="min-h-[110px] rounded-xl bg-white/90 p-3 text-sm text-slate-900"
                    value={vision}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCulture((prev) => {
                        const next = [...prev];
                        const idx = next.findIndex((it) => norm(it.title).includes("visao"));
                        if (idx >= 0) next[idx] = { ...next[idx], description: v };
                        else next.push({ title: "Visão", description: v });
                        return next;
                      });
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border p-6" style={{ borderColor: `${SOLIDA_GOLD}55` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold" style={{ color: SOLIDA_GOLD }}>
                VALORES
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className={buttonClass("ghost")}
                  onClick={() => (document.getElementById("valores") as HTMLElement | null)?.scrollIntoView({ behavior: "smooth" })}
                >
                  Editar lista
                </button>
              ) : null}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-800">
              {(values.length ? values : FALLBACK_SOLIDA.values).slice(0, 5).map((v) => (
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
              Valores e princípios
            </h2>
            <p className="mt-1 text-sm text-slate-600">Excelência, ética e inovação como padrão.</p>
          </div>

          {canEdit ? (
            <button
              type="button"
              className={buttonClass("outline")}
              onClick={() => {
                setValues((prev) => [...prev, { title: "Novo valor", description: "", image_url: "" }]);
                setEditing({ kind: "values", idx: values.length });
              }}
            >
              <Plus size={16} /> Adicionar valor
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(values.length ? values : FALLBACK_SOLIDA.values).map((v, idx) => {
            const isEditing =
              canEdit && !!editing && typeof editing === "object" && editing.kind === "values" && editing.idx === idx;
            return (
              <div
                key={`${v.title}-${idx}`}
                className="group rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-[#fbfbf8] p-5 transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{v.title}</p>
                    <p className="mt-2 text-sm text-slate-700">{v.description ?? ""}</p>
                    {canEdit ? (
                      <div className="mt-3">
                        <ClickToUploadImage
                          src={v.image_url ?? null}
                          heightClass="h-40"
                          prefix={`${scope === "company" && companyId ? companyId : "global"}/values/${idx}-${newId()}`}
                          label="Clique para enviar imagem"
                          focusX={v.focus_x ?? 50}
                          focusY={v.focus_y ?? 50}
                          onFocusChange={(x, y) => {
                            setValues((prev) => prev.map((it, i) => (i === idx ? { ...it, focus_x: x, focus_y: y } : it)));
                          }}
                          onUploaded={(url) => {
                            setValues((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, image_url: url, focus_x: 50, focus_y: 50 } : it)),
                            );
                            setMsg("Imagem atualizada no rascunho.");
                          }}
                          onError={(m) => setMsg(m)}
                        />
                      </div>
                    ) : v.image_url ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.image_url}
                          alt=""
                          className="h-40 w-full object-cover"
                          style={{ objectPosition: `${v.focus_x ?? 50}% ${v.focus_y ?? 50}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <button type="button" className={buttonClass("ghost")} onClick={() => setEditing({ kind: "values", idx })}>
                      Editar
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 h-1 w-14 rounded-full" style={{ backgroundColor: `${SOLIDA_GOLD}55` }} />

                {isEditing ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">Editar valor</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={buttonClass("ghost")}
                          onClick={() => {
                            setValues((prev) => prev.filter((_, i) => i !== idx));
                            setEditing(null);
                          }}
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                        <button type="button" className={buttonClass("ghost")} onClick={() => setEditing(null)}>
                          Fechar
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Título
                        <input
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={v.title}
                          onChange={(e) => {
                            const nv = e.target.value;
                            setValues((prev) => prev.map((it, i) => (i === idx ? { ...it, title: nv } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Descrição
                        <textarea
                          className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 text-sm"
                          value={v.description ?? ""}
                          onChange={(e) => {
                            const nv = e.target.value;
                            setValues((prev) => prev.map((it, i) => (i === idx ? { ...it, description: nv } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Imagem (URL)
                        <input
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={v.image_url ?? ""}
                          onChange={(e) => {
                            const nv = e.target.value;
                            setValues((prev) => prev.map((it, i) => (i === idx ? { ...it, image_url: nv } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Modificar imagem (upload)
                        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                          <Upload size={14} /> Envie uma nova imagem para este valor
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (!f) return;
                            void (async () => {
                              setMsg("");
                              try {
                                const prefix = `${scope === "company" && companyId ? companyId : "global"}/values/${idx}-${newId()}`;
                                const url = await uploadToInstitutionalBucket(f, prefix);
                                setValues((prev) => prev.map((it, i) => (i === idx ? { ...it, image_url: url } : it)));
                                setMsg("Imagem atualizada no rascunho.");
                              } catch (err: unknown) {
                                setMsg(err instanceof Error ? err.message : "Erro ao fazer upload.");
                              }
                            })();
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
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
          {canEdit ? (
            <button type="button" className={buttonClass("outline")} onClick={() => setEditing("business")}>
              Editar
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {business || FALLBACK_SOLIDA.culture[2].description}
            </p>

            {canEdit && editing === "business" ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="grid gap-1 text-xs font-semibold text-slate-700">
                  Texto do negócio
                  <textarea
                    className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    value={business}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCulture((prev) => {
                        const next = [...prev];
                        const idx = next.findIndex((it) => norm(it.title).includes("negocio"));
                        if (idx >= 0) next[idx] = { ...next[idx], description: v };
                        else next.push({ title: "Nosso negócio", description: v });
                        return next;
                      });
                    }}
                  />
                </label>
              </div>
            ) : null}

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
                  <div
                    key={i}
                    className={`${col} ${h} overflow-hidden rounded-3xl border border-slate-200 bg-slate-50`}
                    style={{ transform: `skewX(${skew})` }}
                  >
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: SOLIDA_GOLD }}>
              Cultura na prática
            </h2>
            <p className="mt-1 text-sm text-slate-600">Como a cultura se manifesta no dia a dia.</p>
          </div>
          {canEdit ? (
            <button
              type="button"
              className={buttonClass("outline")}
              onClick={() => {
                setCulture((prev) => [...prev, { title: "Novo item", description: "", image_url: "" }]);
                setEditing({ kind: "culture", idx: culture.length });
              }}
            >
              <Plus size={16} /> Adicionar item
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {cultureItems.length ? (
            cultureItems.map((c, idx) => {
              const realIdx = culture.findIndex((it) => it === c);
              const isEditing =
                canEdit && !!editing && typeof editing === "object" && editing.kind === "culture" && editing.idx === realIdx;

              return (
                <details
                  key={`${c.title}-${idx}`}
                  open={canEdit ? isEditing : false}
                  className="rounded-3xl border border-slate-200 p-4 open:border-slate-300 open:bg-[#fbfbf8]"
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                    <span>{c.title}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        className={buttonClass("ghost")}
                        onClick={(e) => {
                          e.preventDefault();
                          setEditing({ kind: "culture", idx: realIdx });
                        }}
                      >
                        Editar
                      </button>
                    ) : null}
                  </summary>

                  {c.description ? <p className="mt-2 text-sm text-slate-700">{c.description}</p> : null}
                  {canEdit ? (
                    <div className="mt-3">
                      <ClickToUploadImage
                        src={c.image_url ?? null}
                        heightClass="h-44"
                        prefix={`${scope === "company" && companyId ? companyId : "global"}/culture/${realIdx}-${newId()}`}
                        label="Clique para enviar imagem"
                        focusX={c.focus_x ?? 50}
                        focusY={c.focus_y ?? 50}
                        onFocusChange={(x, y) => {
                          setCulture((prev) => prev.map((it, i) => (i === realIdx ? { ...it, focus_x: x, focus_y: y } : it)));
                        }}
                        onUploaded={(url) => {
                          setCulture((prev) =>
                            prev.map((it, i) => (i === realIdx ? { ...it, image_url: url, focus_x: 50, focus_y: 50 } : it)),
                          );
                          setMsg("Imagem atualizada no rascunho.");
                        }}
                        onError={(m) => setMsg(m)}
                      />
                    </div>
                  ) : c.image_url ? (
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

                  {canEdit && isEditing ? (
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Título
                        <input
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={c.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCulture((prev) => prev.map((it, i) => (i === realIdx ? { ...it, title: v } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Descrição
                        <textarea
                          className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 text-sm"
                          value={c.description ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCulture((prev) => prev.map((it, i) => (i === realIdx ? { ...it, description: v } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Imagem (URL)
                        <input
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                          value={c.image_url ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCulture((prev) => prev.map((it, i) => (i === realIdx ? { ...it, image_url: v } : it)));
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-700">
                        Modificar imagem (upload)
                        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                          <Upload size={14} /> Envie uma nova imagem para este item
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (!f) return;
                            void (async () => {
                              setMsg("");
                              try {
                                const prefix = `${scope === "company" && companyId ? companyId : "global"}/culture/${realIdx}-${newId()}`;
                                const url = await uploadToInstitutionalBucket(f, prefix);
                                setCulture((prev) => prev.map((it, i) => (i === realIdx ? { ...it, image_url: url } : it)));
                                setMsg("Imagem atualizada no rascunho.");
                              } catch (err: unknown) {
                                setMsg(err instanceof Error ? err.message : "Erro ao fazer upload.");
                              }
                            })();
                          }}
                        />
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={buttonClass("outline")}
                          onClick={() => {
                            setCulture((prev) => prev.filter((_, i) => i !== realIdx));
                            setEditing(null);
                          }}
                        >
                          <Trash2 size={16} /> Excluir
                        </button>
                        <button type="button" className={buttonClass("outline")} onClick={() => setEditing(null)}>
                          Fechar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </details>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">Sem itens de cultura adicionais cadastrados.</p>
          )}
        </div>
      </section>

      {msg ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{msg}</div>
      ) : null}

      {!msg && (loading || saving) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Carregando...</div>
      ) : null}

    </div>
  );
}
