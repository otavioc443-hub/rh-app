"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";
import { Download, Pencil, Send, Trash2, TrendingUp, Upload } from "lucide-react";
import CollaboratorEditWizard from "@/components/rh/CollaboratorEditWizard";

type Row = {
  id: string;
  nome: string | null;
  email: string | null;
  user_id: string | null;
  cargo_id: string | null;
  department_id: string | null;
  is_active: boolean;
  cargo_nome?: string | null;
  dep_nome?: string | null;
};

type AnyColaborador = Record<string, unknown>;

const EXPORT_COLUMNS = [
  "id",
  "user_id",
  "nome",
  "email",
  "email_pessoal",
  "email_empresarial",
  "cpf",
  "matricula",
  "company_id",
  "empresa",
  "department_id",
  "departamento",
  "setor",
  "cargo_id",
  "cargo",
  "cbo",
  "data_nascimento",
  "sexo",
  "estado_civil",
  "saudacao",
  "nacionalidade",
  "naturalidade",
  "etnia",
  "pne",
  "data_admissao",
  "data_demissao",
  "motivo_demissao",
  "valor_rescisao",
  "salario",
  "turno",
  "moeda",
  "tipo_contrato",
  "data_contrato",
  "escolaridade",
  "superior_direto",
  "email_superior_direto",
  "grau_hierarquico",
  "duracao_contrato",
  "vencimento_contrato",
  "telefone",
  "celular",
  "telefone_emergencia",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "rg",
  "titulo_eleitor",
  "zona_eleitoral",
  "secao_eleitoral",
  "ctps_num",
  "ctps_serie",
  "reservista",
  "cnh",
  "pis",
  "banco",
  "agencia",
  "conta_corrente",
  "pix_key_type",
  "pix_key",
  "pix_bank",
  "sistema",
  "id_colaborador_externo",
  "id_departamento_externo",
  "id_cargo_externo",
  "unidade",
  "id_unidade_externo",
  "is_active",
] as const;

const READONLY_IMPORT_COLUMNS = new Set(["id", "user_id"]);
const IMPORT_BOOLEAN_COLUMNS = new Set(["is_active", "active", "pne"]);
const IMPORT_NUMERIC_COLUMNS = new Set(["salario", "valor_rescisao"]);
const IMPORT_DATE_COLUMNS = new Set([
  "data_nascimento",
  "data_admissao",
  "data_demissao",
  "data_contrato",
  "vencimento_contrato",
]);

type ImportRow = Record<string, string | undefined>;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeHeader(value: string) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactHeader(value: string) {
  return normalizeHeader(value).replace(/[^a-z0-9]/g, "");
}

function cell(row: ImportRow, ...headers: string[]) {
  const wanted = new Set(headers.flatMap((h) => [normalizeHeader(h), compactHeader(h)]));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizeHeader(key)) || wanted.has(compactHeader(key))) return String(value ?? "").trim();
  }
  return "";
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cleanCpf(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeBool(value: string) {
  const v = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (["sim", "true", "1", "ativo", "ativa"].includes(v)) return true;
  if (["nao", "false", "0", "inativo", "inativa"].includes(v)) return false;
  return undefined;
}

function normalizeNumber(value: string) {
  const normalized = value.replace(/[R$\s]/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return trimmed;
}

function getTodayForFilename() {
  return new Date().toISOString().slice(0, 10);
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
  const [rawRows, setRawRows] = useState<AnyColaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ row: Row; startWithPromotion: boolean } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data: rawRows, error } = await supabase
      .from("colaboradores")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      setErr(error.message);
      setRawRows([]);
      setRows([]);
      setLoading(false);
      return;
    }

    const sourceRows = (rawRows ?? []) as AnyColaborador[];
    setRawRows(sourceRows);
    const normalized = sourceRows.map((r) => {
      const id = String(r.id ?? "");
      const nome = typeof r.nome === "string" ? r.nome : null;
      const email = typeof r.email === "string" ? r.email : null;
      const userId = typeof r.user_id === "string" ? r.user_id : null;
      const cargoId = typeof r.cargo_id === "string" ? r.cargo_id : null;
      const departmentId = typeof r.department_id === "string" ? r.department_id : null;
      const cargoText = typeof r.cargo === "string" ? r.cargo : null;
      const depText =
        typeof r.departamento === "string"
          ? r.departamento
          : typeof r.setor === "string"
          ? r.setor
          : null;

      const isActiveRaw = r.is_active ?? r.active;
      const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : true;

      return {
        id,
        nome,
        email,
        user_id: userId,
        cargo_id: cargoId,
        department_id: departmentId,
        cargo_text: cargoText,
        dep_text: depText,
        is_active: isActive,
      };
    });

    const cargoIds = Array.from(new Set(normalized.map((r) => r.cargo_id).filter(Boolean))) as string[];
    const depIds = Array.from(new Set(normalized.map((r) => r.department_id).filter(Boolean))) as string[];

    const cargoNameById = new Map<string, string>();
    if (cargoIds.length > 0) {
      const { data: cargosData } = await supabase.from("cargos").select("id, name").in("id", cargoIds);
      for (const c of cargosData ?? []) cargoNameById.set(c.id as string, (c.name as string) ?? "-");
    }

    const depNameById = new Map<string, string>();
    if (depIds.length > 0) {
      const { data: depsData } = await supabase
        .from("departments")
        .select("id, name")
        .in("id", depIds);
      for (const d of depsData ?? []) depNameById.set(d.id as string, (d.name as string) ?? "-");
    }

    const mapped: Row[] = normalized.map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      user_id: r.user_id,
      cargo_id: r.cargo_id,
      department_id: r.department_id,
      is_active: !!r.is_active,
      cargo_nome: r.cargo_id ? (cargoNameById.get(r.cargo_id) ?? null) : r.cargo_text,
      dep_nome: r.department_id ? (depNameById.get(r.department_id) ?? null) : r.dep_text,
    }));

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

  function exportCollaboratorsCsv() {
    if (rawRows.length === 0) {
      setToast("Nenhum colaborador disponivel para exportar.");
      return;
    }

    const header = EXPORT_COLUMNS.join(";");
    const lines = rawRows.map((row) => EXPORT_COLUMNS.map((key) => csvCell(row[key])).join(";"));
    downloadTextFile(`colaboradores-${getTodayForFilename()}.csv`, [header, ...lines].join("\n"));
    setToast("Planilha de colaboradores baixada. Edite apenas os campos necessarios e importe novamente.");
  }

  function resolveImportTarget(row: ImportRow, byId: Map<string, AnyColaborador>, byUserId: Map<string, AnyColaborador>, byEmail: Map<string, AnyColaborador>, byCpf: Map<string, AnyColaborador>) {
    const id = cell(row, "id");
    if (id && byId.has(id)) return byId.get(id);

    const userId = cell(row, "user_id");
    if (userId && byUserId.has(userId)) return byUserId.get(userId);

    const email = cell(row, "email", "e-mail").toLowerCase();
    if (email && byEmail.has(email)) return byEmail.get(email);

    const cpf = cleanCpf(cell(row, "cpf"));
    if (cpf && byCpf.has(cpf)) return byCpf.get(cpf);

    return null;
  }

  function buildImportPayload(importRow: ImportRow, target: AnyColaborador) {
    const payload: AnyColaborador = {};
    const availableColumns = new Set(Object.keys(target));

    for (const key of EXPORT_COLUMNS) {
      if (READONLY_IMPORT_COLUMNS.has(key)) continue;
      if (!availableColumns.has(key)) continue;

      const value = cell(importRow, key);
      if (!value) continue;

      if (IMPORT_BOOLEAN_COLUMNS.has(key)) {
        const parsed = normalizeBool(value);
        if (typeof parsed === "boolean") payload[key] = parsed;
        continue;
      }

      if (IMPORT_NUMERIC_COLUMNS.has(key)) {
        const parsed = normalizeNumber(value);
        if (typeof parsed === "number") payload[key] = parsed;
        continue;
      }

      if (IMPORT_DATE_COLUMNS.has(key)) {
        const parsed = normalizeDate(value);
        if (parsed) payload[key] = parsed;
        continue;
      }

      payload[key] = key === "cpf" ? cleanCpf(value) : value;
    }

    if (availableColumns.has("updated_at")) payload.updated_at = new Date().toISOString();
    return payload;
  }

  async function importCollaboratorsCsv(file: File | null) {
    if (!file) return;

    setBulkUpdating(true);
    setToast(null);

    try {
      const parsed = await new Promise<Papa.ParseResult<ImportRow>>((resolve, reject) => {
        Papa.parse<ImportRow>(file, {
          header: true,
          skipEmptyLines: "greedy",
          delimiter: "",
          complete: resolve,
          error: reject,
        });
      });

      const importRows = parsed.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
      if (importRows.length === 0) {
        setToast("A planilha nao possui linhas para atualizar.");
        return;
      }

      const byId = new Map<string, AnyColaborador>(
        rawRows
          .map((row) => [String(row.id ?? ""), row] as const)
          .filter(([id]) => id)
      );
      const byUserId = new Map<string, AnyColaborador>(
        rawRows
          .map((row) => [String(row.user_id ?? ""), row] as const)
          .filter(([id]) => id)
      );
      const byEmail = new Map(
        rawRows
          .map((row) => [String(row.email ?? "").trim().toLowerCase(), row] as const)
          .filter(([email]) => email)
      );
      const byCpf = new Map(
        rawRows
          .map((row) => [cleanCpf(String(row.cpf ?? "")), row] as const)
          .filter(([cpf]) => cpf)
      );

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const importRow of importRows) {
        const target = resolveImportTarget(importRow, byId, byUserId, byEmail, byCpf);
        if (!target?.id) {
          skipped += 1;
          continue;
        }

        const payload = buildImportPayload(importRow, target);
        if (Object.keys(payload).length === 0) {
          skipped += 1;
          continue;
        }

        const { error } = await supabase.from("colaboradores").update(payload).eq("id", target.id);
        if (error) {
          failed += 1;
          errors.push(error.message);
        } else {
          updated += 1;
        }
      }

      await load();
      const detail = errors.length > 0 ? ` Erros: ${Array.from(new Set(errors)).slice(0, 2).join(" | ")}` : "";
      setToast(`Atualizacao em massa concluida: ${updated} atualizado(s), ${skipped} ignorado(s), ${failed} erro(s).${detail}`);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Erro ao importar planilha.");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function sendAccess(row: Row) {
    setSendingId(row.id);
    setToast(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/rh/enviar-acesso", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ collaboratorId: row.id }),
      });

      // ✅ evita “Unexpected token <”
      const text = await res.text();
      let payload: { error?: string; message?: string } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(text || "Resposta inválida do servidor.");
      }

      if (!res.ok) throw new Error(payload?.error || "Falha ao enviar acesso.");
      setToast(payload?.message ?? (row.user_id ? "Convite reenviado com sucesso." : "Convite enviado com sucesso."));
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Erro ao enviar acesso.");
    } finally {
      setSendingId(null);
    }
  }

  async function deleteCollaborator(row: Row) {
    setDeletingId(row.id);
    setToast(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/rh/colaboradores/${row.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });

      const text = await res.text();
      let payload: { error?: string; message?: string } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(text || "Resposta invalida do servidor.");
      }

      if (!res.ok) throw new Error(payload?.error || "Falha ao excluir colaborador.");

      setRows((current) => current.filter((item) => item.id !== row.id));
      setDeleting(null);
      setToast(payload?.message ?? "Colaborador excluido com sucesso.");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Erro ao excluir colaborador.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Colaboradores</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visualize e edite os colaboradores cadastrados.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Para atualizacao em massa, baixe a planilha, altere somente os campos necessarios e envie o arquivo de volta.
          Celulas vazias sao ignoradas para preservar dados ja cadastrados.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardStat label="Total" value={totals.total} />
        <CardStat label="Ativos" value={totals.ativos} />
        <CardStat label="Inativos" value={totals.inativos} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Lista</h2>
            <p className="text-xs text-slate-500">
              Campos: Nome, Cargo, Departamento, Status e Ações.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCollaboratorsCsv}
              disabled={loading || rawRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              <Download size={16} />
              Baixar planilha
            </button>

            <label
              className={cx(
                "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100",
                bulkUpdating && "pointer-events-none opacity-60"
              )}
            >
              <Upload size={16} />
              {bulkUpdating ? "Atualizando..." : "Atualizar em massa"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={bulkUpdating}
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  await importCollaboratorsCsv(file);
                }}
              />
            </label>

            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Atualizar
            </button>
          </div>
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
                          onClick={() => sendAccess(r)}
                          disabled={!r.is_active || !r.email || sendingId === r.id}
                          title={r.email ? undefined : "Colaborador sem e-mail cadastrado"}
                          className={cx(
                            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                            !r.is_active || !r.email
                              ? "border border-slate-200 text-slate-400"
                              : "bg-slate-900 text-white hover:opacity-95",
                            sendingId === r.id && "opacity-70"
                          )}
                        >
                          <Send size={16} />
                          {sendingId === r.id ? "Enviando..." : r.user_id ? "Reenviar convite" : "Enviar convite"}
                        </button>

                        <button
                          onClick={() => setEditing({ row: r, startWithPromotion: true })}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <TrendingUp size={16} />
                          Promover
                        </button>

                        <button
                          onClick={() => setEditing({ row: r, startWithPromotion: false })}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Pencil size={16} />
                          Editar
                        </button>

                        <button
                          onClick={() => setDeleting(r)}
                          disabled={deletingId === r.id}
                          className={cx(
                            "inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100",
                            deletingId === r.id && "opacity-70"
                          )}
                        >
                          <Trash2 size={16} />
                          {deletingId === r.id ? "Excluindo..." : "Excluir"}
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
          collaboratorId={editing.row.id}
          startWithPromotion={editing.startWithPromotion}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            setToast("Alterações salvas com sucesso.");
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Excluir colaborador</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Esta acao removera <b>{deleting.nome ?? "este colaborador"}</b> da lista de colaboradores. Se houver
                  usuario vinculado, o perfil tambem sera desativado.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                disabled={deletingId === deleting.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteCollaborator(deleting)}
                disabled={deletingId === deleting.id}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-70"
              >
                {deletingId === deleting.id ? "Excluindo..." : "Confirmar exclusao"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
