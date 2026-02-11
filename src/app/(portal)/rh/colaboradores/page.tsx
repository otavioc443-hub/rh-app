"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Pencil, Send } from "lucide-react";
import CollaboratorEditWizard from "@/components/rh/CollaboratorEditWizard";

type Row = {
  id: string;
  nome: string | null;
  cargo_id: string | null;
  department_id: string | null;
  is_active: boolean;
  cargo_nome?: string | null;
  dep_nome?: string | null;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function CardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editing, setEditing] = useState<Row | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("colaboradores")
      .select(
        `
        id,
        nome,
        cargo_id,
        department_id,
        is_active,
        cargos:cargo_id ( id, name ),
        departments:department_id ( id, name )
      `
      )
      .order("nome", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: Row[] =
      (data ?? []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        cargo_id: r.cargo_id,
        department_id: r.department_id,
        is_active: !!r.is_active,
        cargo_nome: r?.cargos?.name ?? null,
        dep_nome: r?.departments?.name ?? null,
      })) ?? [];

    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const total = rows.length;
    const ativos = rows.filter((r) => r.is_active).length;
    const inativos = total - ativos;
    return { total, ativos, inativos };
  }, [rows]);

  async function sendAccess(collaboratorId: string) {
    setSendingId(collaboratorId);
    setToast(null);

    try {
      const res = await fetch("/api/rh/colaboradores/enviar-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaboratorId }),
      });

      // ✅ evita “Unexpected token <”
      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(text || "Resposta inválida do servidor.");
      }

      if (!res.ok) throw new Error(payload?.error || "Falha ao enviar acesso.");
      setToast(payload?.message ?? "Convite enviado com sucesso.");
    } catch (e: any) {
      setToast(e?.message ?? "Erro ao enviar acesso.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Colaboradores</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visualize e edite os colaboradores cadastrados.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardStat label="Total" value={totals.total} />
        <CardStat label="Ativos" value={totals.ativos} />
        <CardStat label="Inativos" value={totals.inativos} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Lista</h2>
            <p className="text-xs text-slate-500">
              Campos: Nome, Cargo, Departamento, Status e Ações.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>

        {toast && (
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
            {toast}
          </div>
        )}

        {err && <div className="p-4 text-sm text-red-600">{err}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="text-sm text-slate-800">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-medium">{r.nome ?? "-"}</td>
                    <td className="px-4 py-4">{r.cargo_nome ?? "-"}</td>
                    <td className="px-4 py-4">{r.dep_nome ?? "-"}</td>
                    <td className="px-4 py-4">
                      <span
                        className={cx(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          r.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        )}
                      >
                        {r.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => sendAccess(r.id)}
                          disabled={!r.is_active || sendingId === r.id}
                          className={cx(
                            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                            !r.is_active
                              ? "border border-slate-200 text-slate-400"
                              : "bg-slate-900 text-white hover:opacity-95",
                            sendingId === r.id && "opacity-70"
                          )}
                        >
                          <Send size={16} />
                          {sendingId === r.id ? "Enviando..." : "Enviar acesso"}
                        </button>

                        <button
                          onClick={() => setEditing(r)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Pencil size={16} />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-slate-500">
          Status baseado em <b>is_active</b>.
        </div>
      </section>

      {editing && (
        <CollaboratorEditWizard
          collaboratorId={editing.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            setToast("Alterações salvas com sucesso.");
          }}
        />
      )}
    </div>
  );
}
