"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardBody } from "@/components/ui/PageShell";
import {
  Network,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Filter,
  Plus,
  Minus,
  X,
} from "lucide-react";

type Colab = {
  id?: string;
  user_id?: string | null;
  nome?: string | null;
  email?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  empresa?: string | null;
  data_demissao?: string | null;
  email_superior_direto?: string | null;
  superior_direto?: string | null;
  avatar_url?: string | null;
};

type Node = {
  key: string;
  c: Colab;
  children: Node[];
};

type CssVars = React.CSSProperties & Record<`--${string}`, string>;

function normEmail(v?: string | null) {
  return (v ?? "").trim().toLowerCase();
}
function normText(v?: string | null) {
  return (v ?? "").trim().toLowerCase();
}
function roleScore(cargo?: string | null) {
  const c = normText(cargo);
  if (!c) return 99;
  if (/\b(ceo|presidente|founder|fundador)\b/.test(c)) return 0;
  if (/\b(vice|vp)\b/.test(c)) return 1;
  if (/\b(diretor|diretora|c-level|cto|cfo|coo|cio|cmo|chro)\b/.test(c)) return 2;
  if (/\b(gerente|manager|head)\b/.test(c)) return 3;
  if (/\b(coordenador|coordenadora|supervisor|supervisora|lider|líder)\b/.test(c)) return 4;
  if (/\b(analista|especialista)\b/.test(c)) return 5;
  if (/\b(assistente|auxiliar|estagiario|estagiária|trainee)\b/.test(c)) return 6;
  return 7;
}
function compareNodeSeniority(a: Node, b: Node) {
  const byRole = roleScore(a.c.cargo) - roleScore(b.c.cargo);
  if (byRole !== 0) return byRole;
  return (a.c.nome ?? "").localeCompare(b.c.nome ?? "");
}

function initials(nome?: string | null) {
  const parts = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function buildTree(colabs: Colab[]) {
  const nodes: Node[] = [];
  const byKey = new Map<string, Node>();
  const byEmail = new Map<string, Node>();
  const byName = new Map<string, Node>();

  for (let i = 0; i < colabs.length; i += 1) {
    const c = colabs[i];
    const email = normEmail(c.email);
    const name = normText(c.nome);
    const key = email || (c.id ? `id:${c.id}` : name ? `name:${name}:${i}` : `row:${i}`);

    const node: Node = { key, c, children: [] };
    nodes.push(node);
    byKey.set(key, node);

    if (email && !byEmail.has(email)) byEmail.set(email, node);
    if (name && !byName.has(name)) byName.set(name, node);
  }

  const parentByChild = new Map<string, string>();

  for (const child of nodes) {
    const bossEmail = normEmail(child.c.email_superior_direto);
    const bossName = normText(child.c.superior_direto);

    const parent = (bossEmail && byEmail.get(bossEmail)) || (bossName && byName.get(bossName)) || null;
    if (!parent || parent.key === child.key) continue;

    // Evita ciclo: n?o liga se o pai j? for descendente do filho.
    let p: string | undefined = parent.key;
    let hasCycle = false;
    while (p) {
      if (p === child.key) {
        hasCycle = true;
        break;
      }
      p = parentByChild.get(p);
    }
    if (hasCycle) continue;

    parentByChild.set(child.key, parent.key);
  }

  for (const child of nodes) {
    const parentKey = parentByChild.get(child.key);
    if (!parentKey) continue;
    const parent = byKey.get(parentKey);
    if (parent) parent.children.push(child);
  }

  const roots = nodes.filter((n) => !parentByChild.has(n.key));
  if (!roots.length) roots.push(...nodes);

  const sortRec = (n: Node) => {
    n.children.sort((a, b) => (a.c.nome ?? "").localeCompare(b.c.nome ?? ""));
    n.children.forEach(sortRec);
  };
  roots.sort(compareNodeSeniority);
  // Forca uma hierarquia unica: maior senioridade no topo, demais raizes abaixo.
  if (roots.length > 1) {
    const top = roots[0];
    for (let i = 1; i < roots.length; i += 1) {
      top.children.push(roots[i]);
    }
    roots.splice(1);
  }
  roots.forEach(sortRec);

  return { roots, byEmail };
}

function countNodes(nodes: Node[]): number {
  let total = 0;
  const walk = (n: Node) => {
    total += 1;
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return total;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={active ? "oc-pill oc-pill--active" : "oc-pill oc-pill--inactive"}>
      <span className={active ? "oc-dot oc-dot--active" : "oc-dot oc-dot--inactive"} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function PersonCard({
  node,
  isExpanded,
  hasChildren,
  onToggle,
}: {
  node: Node;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}) {
  const active = !node.c.data_demissao;
  const avatarUrl = (node.c.avatar_url ?? "").trim();

  return (
    <div className="oc-card">
      <div className="oc-avatar">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={node.c.nome ?? "Colaborador"} className="h-full w-full rounded-full object-cover" />
        ) : (
          initials(node.c.nome)
        )}
      </div>

      <div className="oc-name" title={node.c.nome ?? ""}>
        {node.c.nome ?? "—"}
      </div>

      <div className="oc-role" title={node.c.cargo ?? ""}>
        {node.c.cargo ?? "—"}
      </div>

      <div className="oc-meta">
        {node.c.departamento ? <span className="oc-tag">{node.c.departamento}</span> : null}
        <StatusPill active={active} />
      </div>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          className="oc-expand"
          title={isExpanded ? "Recolher" : "Expandir"}
        >
          {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
        </button>
      ) : null}
    </div>
  );
}

function OrgUL({
  nodes,
  expanded,
  onToggle,
}: {
  nodes: Node[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (!nodes?.length) return null;

  return (
    <ul className="org-tree">
      {nodes.map((n) => {
        const hasChildren = (n.children?.length ?? 0) > 0;
        const isExpanded = expanded.has(n.key);

        return (
          <li key={n.key}>
            <PersonCard node={n} hasChildren={hasChildren} isExpanded={isExpanded} onToggle={() => onToggle(n.key)} />
            {hasChildren && isExpanded ? (
              <div className="org-children-wrap">
                <OrgUL nodes={n.children} expanded={expanded} onToggle={onToggle} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function subtreeFromRoot(byEmail: Map<string, Node>, email: string) {
  const k = normEmail(email);
  const node = byEmail.get(k);
  return node ? [node] : [];
}

function prettyName(c: Colab) {
  const n = (c.nome ?? "").trim();
  const e = (c.email ?? "").trim();
  if (n && e) return `${n} — ${e}`;
  return n || e || "—";
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [colabs, setColabs] = useState<Colab[]>([]);

  const [scale, setScale] = useState(1);
  const [compact, setCompact] = useState(true);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"pessoa" | "gestor">("pessoa");
  const [filterEmail, setFilterEmail] = useState<string>("");

  // ✅ exporta só o bloco do organograma
  const exportOrgRef = useRef<HTMLDivElement | null>(null);
  // ✅ ref direto no stage (pra desligar scrollbar no download)
  const stageRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("colaboradores")
      .select("*")
      .is("data_demissao", null)
      .order("nome", { ascending: true });

    if (error) {
      setMsg(`❌ ${error.message}`);
      setColabs([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const normalized: Colab[] = rows.map((r) => ({
      id: typeof r.id === "string" ? r.id : undefined,
      user_id: typeof r.user_id === "string" ? r.user_id : null,
      nome: typeof r.nome === "string" ? r.nome : null,
      email: typeof r.email === "string" ? r.email : null,
      cargo: typeof r.cargo === "string" ? r.cargo : null,
      departamento: typeof r.departamento === "string" ? r.departamento : null,
      empresa: typeof r.empresa === "string" ? r.empresa : null,
      data_demissao: typeof r.data_demissao === "string" ? r.data_demissao : null,
      superior_direto: typeof r.superior_direto === "string" ? r.superior_direto : null,
      email_superior_direto:
        typeof r.email_superior_direto === "string" ? r.email_superior_direto : null,
      avatar_url: null,
    }));

    const userIds = Array.from(
      new Set(normalized.map((r) => (typeof r.user_id === "string" ? r.user_id : "")).filter(Boolean))
    );
    const emails = Array.from(new Set(normalized.map((r) => normEmail(r.email)).filter(Boolean)));

    const avatarByUserId = new Map<string, string>();
    const avatarByEmail = new Map<string, string>();

    if (userIds.length) {
      const profById = await supabase.from("profiles").select("id,avatar_url").in("id", userIds);
      if (!profById.error) {
        for (const p of (profById.data ?? []) as Array<{ id: string; avatar_url: string | null }>) {
          const url = (p.avatar_url ?? "").trim();
          if (url) avatarByUserId.set(String(p.id), url);
        }
      }
    }

    if (emails.length) {
      const profByEmail = await supabase.from("profiles").select("email,avatar_url").in("email", emails);
      if (!profByEmail.error) {
        for (const p of (profByEmail.data ?? []) as Array<{ email: string | null; avatar_url: string | null }>) {
          const email = normEmail(p.email);
          const url = (p.avatar_url ?? "").trim();
          if (email && url) avatarByEmail.set(email, url);
        }
      }
    }

    setColabs(
      normalized.map((r) => ({
        ...r,
        avatar_url:
          (r.user_id ? avatarByUserId.get(r.user_id) : undefined) ??
          avatarByEmail.get(normEmail(r.email)) ??
          null,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const { roots, byEmail } = useMemo(() => buildTree(colabs), [colabs]);

  const peopleList = useMemo(() => {
    return [...colabs]
      .filter((c) => !!normEmail(c.email))
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
  }, [colabs]);

  const view = useMemo(() => {
    if (!filterEmail) return roots;
    return subtreeFromRoot(byEmail, filterEmail);
  }, [roots, byEmail, filterEmail]);

  const totalShown = useMemo(() => countNodes(view), [view]);

  useEffect(() => {
    const next = new Set<string>();
    view.forEach((r) => next.add(r.key));
    setExpanded(next);
  }, [filterEmail, view]);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      const willExpand = !next.has(key);

      if (willExpand) next.add(key);
      else next.delete(key);

      if (willExpand) {
        setCompact(true);
        setScale((s) => Math.max(0.65, Number((s - 0.08).toFixed(2))));
      }

      return next;
    });
  }

  function zoomIn() {
    setScale((s) => Math.min(1.8, Number((s + 0.1).toFixed(2))));
  }
  function zoomOut() {
    setScale((s) => Math.max(0.55, Number((s - 0.1).toFixed(2))));
  }
  function resetView() {
    setScale(1);
    setCompact(true);
  }

  /**
   * ✅ DOWNLOAD sem scrollbar
   * - exporta só a área do organograma (exportOrgRef)
   * - antes do export: remove overflow do stage e coloca height auto (sem barra)
   * - depois: restaura tudo
   */
  async function downloadOnlyOrgArea() {
    try {
      setMsg("");

      const exportEl = exportOrgRef.current;
      const stageEl = stageRef.current;
      if (!exportEl || !stageEl) return;

      const { toPng } = await import("html-to-image");

      const docWithFonts = document as Document & {
        fonts?: { ready?: Promise<unknown> };
      };
      if (docWithFonts.fonts?.ready) {
        await docWithFonts.fonts.ready;
      }

      // salva styles originais do stage
      const prevOverflow = stageEl.style.overflow;
      const prevHeight = stageEl.style.height;

      // remove scrollbar e deixa a altura "crescer" só durante o export
      stageEl.style.overflow = "hidden";
      stageEl.style.height = "auto";

      // 2 frames pra garantir layout
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

      const dataUrl = await toPng(exportEl, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      // restaura
      stageEl.style.overflow = prevOverflow;
      stageEl.style.height = prevHeight;

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `organograma_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (e: unknown) {
      // tentativa de restaurar (caso erro aconteça antes)
      try {
        const stageEl = stageRef.current;
        if (stageEl) {
          stageEl.style.overflow = "auto";
          stageEl.style.height = "72vh";
        }
      } catch {}

      const errMsg = e instanceof Error ? e.message : "erro desconhecido";
      setMsg(`❌ Falha no download: ${errMsg}`);
    }
  }

  function applyFilter() {
    setFilterOpen(false);
  }

  const toolbarBtn =
    "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.98]";

  const toolbarBtnWide =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 active:scale-[0.98]";

  const toolbarBtnPrimary =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-[0.98]";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <style jsx global>{`
        .org-stage {
          overflow: auto;
          padding: 18px;
          height: 72vh;
          background: #ffffff;
        }

        .org-zoom-wrap {
          transform-origin: top center;
        }

        .org-tree,
        .org-tree ul {
          padding-top: var(--org-pt, 18px);
          position: relative;
          display: flex;
          justify-content: center;
          gap: var(--org-gap, 14px);
        }
        .org-tree ul {
          padding-top: var(--org-child-pt, 22px);
        }

        .org-tree li {
          list-style-type: none;
          text-align: center;
          position: relative;
          padding: var(--org-li-pad, 16px 8px 0 8px);
          min-width: var(--org-minw, 200px);
        }

        .org-tree li::before,
        .org-tree li::after {
          content: "";
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid #e2e8f0;
          width: 50%;
          height: var(--org-line-h, 18px);
        }
        .org-tree li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid #e2e8f0;
        }

        .org-tree li:only-child::before,
        .org-tree li:only-child::after {
          display: none;
        }
        .org-tree li:only-child {
          padding-top: 0;
        }
        .org-tree li:first-child::before,
        .org-tree li:last-child::after {
          border: 0 none;
        }
        .org-tree li:last-child::before {
          border-right: 2px solid #e2e8f0;
          border-top-right-radius: 14px;
        }
        .org-tree li:first-child::after {
          border-top-left-radius: 14px;
        }
        .org-children-wrap > ul::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid #e2e8f0;
          width: 0;
          height: var(--org-child-pt, 22px);
        }

        .oc-card {
          width: var(--card-w, 210px);
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: var(--card-pad, 14px 12px 12px 12px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
          margin: 0 auto;
          position: relative;
        }
        .oc-avatar {
          width: var(--avatar, 66px);
          height: var(--avatar, 66px);
          border-radius: 999px;
          margin: 0 auto 10px auto;
          background: radial-gradient(circle at 30% 30%, #0f172a 0%, #111827 60%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: var(--avatar-fs, 16px);
          border: 5px solid #f8fafc;
          box-shadow: 0 10px 20px rgba(2, 6, 23, 0.25);
        }
        .oc-name {
          font-weight: 800;
          color: #0f172a;
          font-size: var(--name-fs, 13px);
          margin-bottom: 6px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .oc-role {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: var(--role-pad, 7px 10px);
          border-radius: 999px;
          background: #0f172a;
          color: white;
          font-weight: 800;
          font-size: var(--role-fs, 11px);
          margin-bottom: 10px;
          max-width: 100%;
        }
        .oc-meta {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .oc-tag {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          font-size: var(--tag-fs, 10px);
          padding: var(--tag-pad, 6px 9px);
          border-radius: 999px;
        }
        .oc-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 800;
          font-size: var(--pill-fs, 10px);
        }
        .oc-pill--active {
          background: #ecfdf5;
          color: #047857;
        }
        .oc-pill--inactive {
          background: #fff1f2;
          color: #be123c;
        }
        .oc-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
        }
        .oc-dot--active {
          background: #10b981;
        }
        .oc-dot--inactive {
          background: #f43f5e;
        }
        .oc-expand {
          position: absolute;
          right: 10px;
          top: 10px;
          width: 32px;
          height: 32px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
        }
      `}</style>

      {/* TOP BAR */}
      <div className="flex items-start justify-between gap-4">
        <div className={toolbarBtnWide} style={{ width: 210 }}>
          <Network size={18} />
          <span className="truncate">Organograma</span>
        </div>

        <div className="flex items-center gap-2">
          <button className={toolbarBtn} onClick={zoomOut} title="Diminuir zoom">
            <ZoomOut size={18} />
          </button>
          <button className={toolbarBtn} onClick={zoomIn} title="Aumentar zoom">
            <ZoomIn size={18} />
          </button>
          <button className={toolbarBtn} onClick={resetView} title="Resetar zoom">
            <RotateCcw size={18} />
          </button>

          <button className={toolbarBtn} onClick={() => setFilterOpen(true)} title="Filtrar">
            <Filter size={18} />
          </button>

          <button className={toolbarBtnWide} onClick={downloadOnlyOrgArea} title="Baixar sem barra de rolagem">
            <Download size={18} />
            Download
          </button>

          <button className={toolbarBtnPrimary} onClick={load} title="Atualizar dados">
            <RefreshCcw size={18} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? (
        <Card>
          <CardBody>
            <div className="text-sm text-slate-800">{msg}</div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <div className="text-sm text-slate-700">
            {loading ? (
              "Carregando..."
            ) : (
              <>
                Exibindo <b>{totalShown}</b> colaborador(es).
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ✅ SOMENTE ESTE BLOCO É EXPORTADO */}
      <div ref={exportOrgRef}>
        <Card>
          <CardBody>
            {loading ? (
              <div className="text-sm text-slate-600">Carregando organograma…</div>
            ) : view.length ? (
              <div
                ref={stageRef}
                className="org-stage"
                style={
                  compact
                    ? ({
                        "--card-w": "200px",
                        "--card-pad": "12px 10px 10px 10px",
                        "--avatar": "62px",
                        "--avatar-fs": "15px",
                        "--name-fs": "12.5px",
                        "--role-fs": "10.5px",
                        "--role-pad": "6px 9px",
                        "--tag-fs": "10px",
                        "--tag-pad": "6px 9px",
                        "--pill-fs": "10px",
                        "--org-gap": "12px",
                        "--org-pt": "16px",
                        "--org-child-pt": "20px",
                        "--org-minw": "190px",
                        "--org-line-h": "16px",
                        "--org-li-pad": "14px 8px 0 8px",
                      } as CssVars)
                    : undefined
                }
              >
                <div
                  className="org-zoom-wrap"
                  style={{
                    width: "fit-content",
                    margin: "0 auto",
                    transform: `scale(${scale})`,
                  }}
                >
                  <OrgUL nodes={view} expanded={expanded} onToggle={toggleExpand} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                Nenhum colaborador encontrado (ou vínculos de superior direto não preenchidos).
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {filterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="text-base font-extrabold text-slate-900">Filtrar</div>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setFilterOpen(false)}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFilterMode("pessoa")}
                  className={
                    filterMode === "pessoa"
                      ? "h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white"
                      : "h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900"
                  }
                >
                  Por pessoa
                </button>
                <button
                  onClick={() => setFilterMode("gestor")}
                  className={
                    filterMode === "gestor"
                      ? "h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white"
                      : "h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900"
                  }
                >
                  Por gestor
                </button>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {filterMode === "pessoa" ? "Selecione a pessoa" : "Selecione o gestor"}
                </div>

                <select
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">— Sem filtro (mostrar todos) —</option>
                  {peopleList.map((p) => (
                    <option key={normEmail(p.email)} value={normEmail(p.email)}>
                      {prettyName(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t px-5 py-4">
              <button
                onClick={() => {
                  setFilterEmail("");
                  setFilterMode("pessoa");
                  setFilterOpen(false);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Limpar
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterOpen(false)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyFilter}
                  className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
