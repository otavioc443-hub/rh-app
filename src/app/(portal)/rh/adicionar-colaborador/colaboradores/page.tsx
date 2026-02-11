"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, BadgeCheck, AlertTriangle, Search, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import EmployeeForm, { ColaboradorPayload } from "@/components/rh/EmployeeForm";
import { PageHeader, StatCard, Card, CardBody, TableShell, TableWrap } from "@/components/ui/PageShell";

type Row = ColaboradorPayload & { id: string; created_at: string; data_demissao?: string | null };

function cleanNumber(v?: string) {
  const s = (v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const ativos = rows.filter((r) => !r.data_demissao).length;
    return { total, ativos, inativos: total - ativos };
  }, [rows]);

  async function load() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("colaboradores")
      .select("id,created_at,nome,cpf,email,departamento,cargo,empresa,setor,data_demissao")
      .order("created_at", { ascending: false });

    if (error) setMsg(`❌ ${error.message}`);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.nome, r.cpf, r.email, r.departamento, r.cargo, r.empresa, r.setor]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

  async function openEdit(id: string) {
    setMsg("");
    const { data, error } = await supabase.from("colaboradores").select("*").eq("id", id).single();
    if (error) return setMsg(`❌ ${error.message}`);
    setEditing(data as any);
  }

  async function saveEdit(payload: ColaboradorPayload) {
    if (!editing) return;
    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("colaboradores")
      .update({
        ...payload,
        salario: cleanNumber(payload.salario),
        valor_rescisao: cleanNumber(payload.valor_rescisao),
      })
      .eq("id", editing.id);

    if (error) {
      setMsg(`❌ ${error.message}`);
      setSaving(false);
      return;
    }

    setMsg("✅ Colaborador atualizado!");
    setEditing(null);
    setSaving(false);
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader
        icon={<Users size={22} />}
        title="Colaboradores"
        subtitle="Visualize, pesquise e edite todos os colaboradores cadastrados."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={<Users size={18} />} label="Total" value={stats.total} helper="Colaboradores em registros" />
        <StatCard icon={<BadgeCheck size={18} />} label="Ativos" value={stats.ativos} helper="Sem data de demissão" />
        <StatCard icon={<AlertTriangle size={18} />} label="Inativos" value={stats.inativos} helper="Com data de demissão" />
      </div>

      <Card>
        <CardBody>
          {/* ✅ topo alinhado e lupa 100% estável (sem absolute) */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">Usuários ({filtered.length})</div>
              <div className="mt-1 text-sm text-slate-600">
                Dica: pesquise por nome, CPF, e-mail, cargo ou departamento.
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              {/* ✅ Campo de busca em FLEX (ícone não sobrepõe mais o texto) */}
              <div className="flex h-12 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200 sm:w-[420px]">
                <Search size={18} className="shrink-0 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                />
              </div>

              <button
                onClick={load}
                className="h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Atualizar
              </button>
            </div>
          </div>

          {msg ? (
            <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm text-slate-800">{msg}</div>
          ) : null}

          <div className="mt-4">
            <TableShell>
              <TableWrap>
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="p-4">E-mail</th>
                      <th className="p-4">Nome</th>
                      <th className="p-4">Cargo</th>
                      <th className="p-4">Departamento</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan={6}>
                          Carregando...
                        </td>
                      </tr>
                    ) : filtered.length ? (
                      filtered.map((r) => {
                        const ativo = !r.data_demissao;
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="p-4">
                              <div className="font-medium text-slate-900">{r.email ?? "-"}</div>
                              <div className="text-xs text-slate-500">{r.cpf ?? ""}</div>
                            </td>
                            <td className="p-4">{r.nome ?? "-"}</td>
                            <td className="p-4">{r.cargo ?? "-"}</td>
                            <td className="p-4">{r.departamento ?? "-"}</td>
                            <td className="p-4">
                              <span
                                className={[
                                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                                  ativo ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                                ].join(" ")}
                              >
                                <span className={`h-2 w-2 rounded-full ${ativo ? "bg-emerald-500" : "bg-rose-500"}`} />
                                {ativo ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => openEdit(r.id)}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white"
                              >
                                <Pencil size={14} />
                                Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan={6}>
                          Nenhum colaborador encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableWrap>

              <div className="border-t bg-white px-6 py-4 text-sm text-slate-500">
                O status aqui está baseado em <b>data_demissao</b> (sem data = ativo).
              </div>
            </TableShell>
          </div>
        </CardBody>
      </Card>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Editar colaborador</h2>
                <p className="text-sm text-slate-600">
                  {editing.nome ?? "-"} — {editing.cpf ?? "-"}
                </p>
              </div>

              <button
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                Fechar
              </button>
            </div>

            <EmployeeForm initial={editing} submitting={saving} submitLabel="Salvar alterações" onSubmit={saveEdit} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
