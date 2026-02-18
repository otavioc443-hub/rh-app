"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import { PORTAL_FEATURE_CATALOG } from "@/lib/portalFeatureCatalog";
import { normalizeRoutePath } from "@/lib/featureVisibility";

type FeatureRow = {
  feature_key: string;
  label: string;
  area: string;
  route_path: string;
  hidden: boolean;
  updated_at: string | null;
};

type FeatureAuditRow = {
  id: string;
  feature_key: string;
  route_path: string;
  action: "insert" | "update" | "delete";
  hidden_before: boolean | null;
  hidden_after: boolean | null;
  actor_user_id: string | null;
  changed_at: string;
};

type ProfileLiteRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const NON_HIDABLE_ROUTES = new Set<string>(["/admin/funcionalidades"]);

export default function FuncionalidadesClient() {
  const { loading: roleLoading, role: viewerRole } = useUserRole();
  const canManage = viewerRole === "admin";

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rows, setRows] = useState<FeatureRow[]>([]);
  const [auditRows, setAuditRows] = useState<FeatureAuditRow[]>([]);
  const [auditActorNames, setAuditActorNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [pendingToggle, setPendingToggle] = useState<FeatureRow | null>(null);

  async function syncCatalog() {
    setSyncing(true);
    try {
      const { data: existing, error } = await supabase.from("portal_feature_visibility").select("feature_key");
      if (error) throw error;

      const existingKeys = new Set((existing ?? []).map((r) => String(r.feature_key)));
      const missing = PORTAL_FEATURE_CATALOG.filter((item) => !existingKeys.has(item.feature_key));

      if (missing.length > 0) {
        const { error: insertError } = await supabase.from("portal_feature_visibility").insert(missing);
        if (insertError) throw insertError;
      }
    } finally {
      setSyncing(false);
    }
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      await syncCatalog();
      const { data, error } = await supabase
        .from("portal_feature_visibility")
        .select("feature_key,label,area,route_path,hidden,updated_at")
        .order("area", { ascending: true })
        .order("label", { ascending: true });

      if (error) throw error;
      setRows((data ?? []) as FeatureRow[]);

      const { data: auditData, error: auditError } = await supabase
        .from("portal_feature_visibility_audit")
        .select("id,feature_key,route_path,action,hidden_before,hidden_after,actor_user_id,changed_at")
        .order("changed_at", { ascending: false })
        .limit(50);
      if (auditError) throw auditError;
      const audits = (auditData ?? []) as FeatureAuditRow[];
      setAuditRows(audits);

      const actorIds = Array.from(new Set(audits.map((r) => r.actor_user_id).filter((v): v is string => !!v)));
      if (actorIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", actorIds);
        if (profilesError) throw profilesError;

        const map: Record<string, string> = {};
        for (const p of (profilesData ?? []) as ProfileLiteRow[]) {
          map[p.id] = p.full_name?.trim() || p.email?.trim() || p.id;
        }
        setAuditActorNames(map);
      } else {
        setAuditActorNames({});
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar funcionalidades.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManage) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      return (
        r.label.toLowerCase().includes(term) ||
        r.area.toLowerCase().includes(term) ||
        r.route_path.toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  const hiddenCount = rows.filter((r) => r.hidden).length;

  function prettyAction(action: FeatureAuditRow["action"]) {
    if (action === "insert") return "Cadastro";
    if (action === "update") return "Atualizacao";
    return "Exclusao";
  }

  function prettyChange(before: boolean | null, after: boolean | null) {
    const from = before === null ? "nulo" : before ? "oculta" : "visivel";
    const to = after === null ? "nulo" : after ? "oculta" : "visivel";
    return `${from} -> ${to}`;
  }

  function getImpactedRoutes(routePath: string) {
    const base = normalizeRoutePath(routePath);
    return PORTAL_FEATURE_CATALOG.filter((item) => {
      const path = normalizeRoutePath(item.route_path);
      return path === base || path.startsWith(`${base}/`);
    }).sort((a, b) => a.route_path.localeCompare(b.route_path));
  }

  async function toggleHidden(row: FeatureRow) {
    if (NON_HIDABLE_ROUTES.has(row.route_path)) return;
    setSavingKey(row.feature_key);
    setMsg("");
    try {
      const { error } = await supabase
        .from("portal_feature_visibility")
        .update({ hidden: !row.hidden })
        .eq("feature_key", row.feature_key);
      if (error) throw error;

      setRows((prev) =>
        prev.map((item) => (item.feature_key === row.feature_key ? { ...item, hidden: !item.hidden } : item))
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("portal-feature-visibility-updated"));
      }
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao atualizar visibilidade.");
    } finally {
      setSavingKey(null);
    }
  }

  if (roleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Carregando permissoes...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Visibilidade de funcionalidades</h1>
        <p className="mt-2 text-sm text-slate-700">Voce nao tem permissao para acessar esta pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Visibilidade de funcionalidades</h1>
            <p className="mt-1 text-sm text-slate-600">
              Oculte ou exiba telas no menu lateral para os usuarios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            disabled={loading || syncing}
          >
            <RefreshCcw size={16} className={loading || syncing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total de funcionalidades</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Ocultas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{hiddenCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Visiveis</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{rows.length - hiddenCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <label className="block text-xs font-semibold text-slate-700">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, area ou rota"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {msg ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{msg}</div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Funcionalidade</th>
                <th className="px-4 py-3 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">Rota</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-slate-600">
                    Carregando...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-slate-600">
                    Nenhuma funcionalidade encontrada.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const saving = savingKey === row.feature_key;
                  const locked = NON_HIDABLE_ROUTES.has(row.route_path);
                  return (
                    <tr key={row.feature_key}>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                      <td className="px-4 py-3 text-slate-700">{row.area}</td>
                      <td className="px-4 py-3 text-slate-700">{row.route_path}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                            row.hidden ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {row.hidden ? "Oculta" : "Visivel"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={saving || locked}
                          onClick={() => setPendingToggle(row)}
                          className={cx(
                            "rounded-xl px-3 py-1.5 text-xs font-semibold",
                            locked
                              ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                              : "",
                            row.hidden
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-slate-900 text-white hover:opacity-95",
                            saving && "cursor-not-allowed opacity-60"
                          )}
                        >
                          {locked ? "Fixa" : saving ? "Salvando..." : row.hidden ? "Exibir" : "Ocultar"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Historico de alteracoes</h2>
          <span className="text-xs text-slate-500">Ultimos 50 eventos</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          {auditRows.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">Nenhum evento registrado.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {auditRows.map((row) => {
                const actorName = row.actor_user_id ? auditActorNames[row.actor_user_id] ?? row.actor_user_id : "Sistema";
                return (
                  <details key={row.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.feature_key}</p>
                        <p className="truncate text-xs text-slate-500">{row.route_path}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-600">{new Date(row.changed_at).toLocaleString("pt-BR")}</p>
                        <p className="text-xs font-semibold text-slate-800">{prettyAction(row.action)}</p>
                      </div>
                    </summary>
                    <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:grid-cols-2">
                      <p>
                        <span className="font-semibold text-slate-900">Mudanca:</span> {prettyChange(row.hidden_before, row.hidden_after)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Usuario:</span> {actorName}
                      </p>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {pendingToggle ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Confirmar alteracao</h2>
              <p className="mt-1 text-sm text-slate-600">
                {pendingToggle.hidden ? "Exibir" : "Ocultar"} <b>{pendingToggle.label}</b>?
              </p>
            </div>

            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-700">
                Esta alteracao impacta a rota principal e subrotas relacionadas:
              </p>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                {getImpactedRoutes(pendingToggle.route_path).map((item) => (
                  <div key={item.feature_key} className="py-1">
                    <span className="font-medium">{item.label}</span> - {item.route_path}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-5">
              <button
                type="button"
                onClick={() => setPendingToggle(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = pendingToggle;
                  setPendingToggle(null);
                  if (row) void toggleHidden(row);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
