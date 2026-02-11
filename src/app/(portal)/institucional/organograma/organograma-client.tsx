"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader, Card, CardBody } from "@/components/ui/PageShell";
import { Network, Search, RefreshCcw, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";
import * as htmlToImage from "html-to-image";

type Colab = {
  id?: string;
  nome?: string | null;
  email?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  empresa?: string | null;
  data_demissao?: string | null;
  email_superior_direto?: string | null;
  superior_direto?: string | null;
};

type Node = {
  key: string; // email normalizado
  c: Colab;
  children: Node[];
};

function normEmail(v?: string | null) {
  return (v ?? "").trim().toLowerCase();
}

function initials(nome?: string | null) {
  const parts = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function buildTree(colabs: Colab[]) {
  const byEmail = new Map<string, Node>();

  for (const c of colabs) {
    const email = normEmail(c.email);
    if (!email) continue;
    byEmail.set(email, { key: email, c, children: [] });
  }

  const roots: Node[] = [];

  for (const node of byEmail.values()) {
    const bossEmail = normEmail(node.c.email_superior_direto);
    if (bossEmail && byEmail.has(bossEmail) && bossEmail !== node.key) {
      byEmail.get(bossEmail)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (n: Node) => {
    n.children.sort((a, b) => (a.c.nome ?? "").localeCompare(b.c.nome ?? ""));
    n.children.forEach(sortRec);
  };

  roots.sort((a, b) => (a.c.nome ?? "").localeCompare(b.c.nome ?? ""));
  roots.forEach(sortRec);

  return roots;
}

function matchesQuery(n: Node, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const txt = [
    n.c.nome,
    n.c.email,
    n.c.cargo,
    n.c.departamento,
    n.c.empresa,
    n.c.superior_direto,
    n.c.email_superior_direto,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return txt.includes(s);
}

function filterTreeByQuery(roots: Node[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return roots;

  const keepIfMatchOrChild = (node: Node): Node | null => {
    const kids = node.children
      .map((k) => keepIfMatchOrChild(k))
      .filter(Boolean) as Node[];

    if (matchesQuery(node, s) || kids.length) {
      return { ...node, children: kids };
    }
    return null;
  };

  return roots.map((r) => keepIfMatchOrChild(r)).filter(Boolean) as Node[];
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

function PersonCard({ node }: { node: Node }) {
  const active = !node.c.data_demissao;

  return (
    <div className="oc-card">
      <div className="oc-avatar">{initials(node.c.nome)}</div>

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
    </div>
  );
}

function OrgUL({ nodes }: { nodes: Node[] }) {
  if (!nodes?.length) return null;

  return (
    <ul className="org-tree">
      {nodes.map((n) => (
        <li key={n.key}>
          <PersonCard node={n} />
          {n.children?.length ? (
            <div className="org-children-wrap">
              <OrgUL nodes={n.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [q, setQ] = useState("");

  // ✅ Zoom
  const [zoom, setZoom] = useState(1);
  const Z_MIN = 0.5;
  const Z_MAX = 1.6;
  const Z_STEP = 0.1;

  const exportRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("colaboradores")
      .select("id,nome,email,cargo,departamento,empresa,data_demissao,superior_direto,email_superior_direto")
      .order("nome", { ascending: true });

    if (error) {
      setMsg(`❌ ${error.message}`);
      setColabs([]);
      setLoading(false);
      return;
    }

    setColabs((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const roots = useMemo(() => buildTree(colabs), [colabs]);

  const view = useMemo(() => {
    return filterTreeByQuery(roots, q);
  }, [roots, q]);

  const totalShown = useMemo(() => countNodes(view), [view]);

  function zoomIn() {
    setZoom((z) => Math.min(Z_MAX, Number((z + Z_STEP).toFixed(2))));
  }
  function zoomOut() {
    setZoom((z) => Math.max(Z_MIN, Number((z - Z_STEP).toFixed(2))));
  }
  function zoomReset() {
    setZoom(1);
  }

  async function downloadPNG() {
    try {
      if (!exportRef.current) return;

      const node = exportRef.current;

      // garante fundo e qualidade
      const dataUrl = await htmlToImage.toPng(node, {
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
        cacheBust: true,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "organograma.png";
      a.click();
    } catch (e: any) {
      setMsg(`❌ Falha ao gerar download: ${e?.message ?? "erro desconhecido"}`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <style jsx global>{`
        /* ===== ORGANOGRAM (ul/li) ===== */
        .org-stage {
          overflow: auto; /* ✅ permite scroll horizontal/vertical quando der zoom */
          padding: 20px;
        }

        .org-zoom {
          transform-origin: top center;
          will-change: transform;
        }

        .org-tree,
        .org-tree ul {
          padding-top: 20px;
          position: relative;
          transition: all 0.2s;
          display: flex;
          justify-content: center;
          gap: 16px;
        }
        .org-tree ul {
          padding-top: 28px;
        }
        .org-tree li {
          list-style-type: none;
          text-align: center;
          position: relative;
          padding: 20px 10px 0 10px;
          min-width: 220px;
        }

        /* linhas horizontais no nível */
        .org-tree li::before,
        .org-tree li::after {
          content: "";
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid #e2e8f0;
          width: 50%;
          height: 20px;
        }
        .org-tree li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid #e2e8f0;
        }

        /* remove linhas quando único filho */
        .org-tree li:only-child::before,
        .org-tree li:only-child::after {
          display: none;
        }
        .org-tree li:only-child {
          padding-top: 0;
        }

        /* remove linha esquerda/direita nas pontas */
        .org-tree li:first-child::before,
        .org-tree li:last-child::after {
          border: 0 none;
        }
        /* arredonda cantos */
        .org-tree li:last-child::before {
          border-right: 2px solid #e2e8f0;
          border-top-right-radius: 14px;
        }
        .org-tree li:first-child::after {
          border-top-left-radius: 14px;
        }

        /* linha vertical do pai para os filhos */
        .org-children-wrap > ul::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid #e2e8f0;
          width: 0;
          height: 28px;
        }

        /* ===== CARD ===== */
        .oc-card {
          width: 230px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px 14px 14px 14px;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
          transition: 0.15s;
          margin: 0 auto;
        }
        .oc-card:hover {
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.10);
          transform: translateY(-1px);
          border-color: #cbd5e1;
        }
        .oc-avatar {
          width: 76px;
          height: 76px;
          border-radius: 999px;
          margin: 0 auto 10px auto;
          background: radial-gradient(circle at 30% 30%, #0f172a 0%, #111827 60%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 18px;
          border: 5px solid #f8fafc;
          box-shadow: 0 10px 20px rgba(2, 6, 23, 0.25);
        }
        .oc-name {
          font-weight: 800;
          color: #0f172a;
          font-size: 14px;
          line-height: 1.2;
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
          padding: 8px 12px;
          border-radius: 999px;
          background: #0f172a;
          color: white;
          font-weight: 800;
          font-size: 12px;
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
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 999px;
        }
        .oc-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 11px;
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

        @media (max-width: 768px) {
          .org-tree,
          .org-tree ul {
            gap: 10px;
          }
          .org-tree li {
            min-width: 205px;
            padding: 18px 6px 0 6px;
          }
          .oc-card {
            width: 210px;
          }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={<Network size={22} />}
          title="Organograma"
          subtitle="Estrutura gerada automaticamente por colaboradores (email_superior_direto → gestor)."
        />

        {/* ✅ Controles no topo (zoom + download + atualizar) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={zoomOut}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title="Diminuir zoom"
          >
            <ZoomOut size={16} />
          </button>

          <div className="hidden h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 sm:inline-flex">
            {Math.round(zoom * 100)}%
          </div>

          <button
            onClick={zoomIn}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title="Aumentar zoom"
          >
            <ZoomIn size={16} />
          </button>

          <button
            onClick={zoomReset}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title="Resetar zoom"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={downloadPNG}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            title="Baixar organograma (PNG)"
          >
            <Download size={16} />
            Download
          </button>

          <button
            onClick={load}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      <Card>
        <CardBody>
          {/* ✅ Profundidade removida */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="text-sm font-semibold text-slate-800">Buscar</div>
              <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
                <Search size={18} className="shrink-0 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nome, e-mail, cargo ou área"
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-600">
            {loading ? (
              "Carregando..."
            ) : (
              <>
                Exibindo <b>{totalShown}</b> colaborador(es).
              </>
            )}
          </div>

          {msg ? (
            <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm text-slate-800">{msg}</div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading ? (
            <div className="text-sm text-slate-600">Carregando organograma…</div>
          ) : view.length ? (
            <div className="org-stage">
              {/* ✅ Wrapper do organograma (zoom + download) */}
              <div
                ref={exportRef}
                className="org-zoom"
                style={{ transform: `scale(${zoom})` }}
              >
                <OrgUL nodes={view} />
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
  );
}
