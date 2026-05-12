"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users, BadgeCheck, AlertTriangle, Upload, Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import EmployeeForm, { ColaboradorPayload } from "@/components/rh/EmployeeForm";
import EmployeesImport from "@/components/rh/EmployeesImport";
import { StatCard, Card, CardBody } from "@/components/ui/PageShell";

function normalizeError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;

  const err = error as Record<string, unknown>;
  const message = err.message ? String(err.message) : "";
  const code = err.code ? ` | code: ${String(err.code)}` : "";
  const details = err.details ? ` | details: ${String(err.details)}` : "";
  const hint = err.hint ? ` | hint: ${String(err.hint)}` : "";
  const status = err.status ? ` | status: ${String(err.status)}` : "";

  const full = `${message}${code}${status}${details}${hint}`.trim();
  return full || fallback;
}

function toDb(payload: ColaboradorPayload) {
  const n = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
    return "";
  };
  const num = (v: unknown) => {
    const s = n(v).replace(",", ".");
    if (!s) return null;
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
  };
  const dateOnly = (v: unknown) => {
    const s = n(v);
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  };

  const base: Record<string, unknown> = { ...payload };

  base.company_id = n(payload.company_id) || null;
  base.department_id = n(payload.department_id) || null;
  base.empresa = n(payload.empresa) || null;
  base.setor = n(payload.setor) || null;
  base.nome = n(payload.nome) || null;
  base.cpf = n(payload.cpf) || null;
  base.email = n(payload.email) || null;
  base.departamento = n(payload.departamento) || null;
  base.cargo = n(payload.cargo) || null;
  base.pne =
    payload.pne === "" || payload.pne === null || payload.pne === undefined
      ? null
      : payload.pne === true || String(payload.pne).toLowerCase() === "sim";

  base.data_nascimento = dateOnly(payload.data_nascimento);
  base.data_admissao = dateOnly(payload.data_admissao);
  base.data_demissao = dateOnly(payload.data_demissao);
  base.data_contrato = dateOnly(payload.data_contrato);
  base.vencimento_contrato = dateOnly(payload.vencimento_contrato);

  base.celular = n(payload.celular) || null;
  base.salario = num(payload.salario);
  base.valor_rescisao = num(payload.valor_rescisao);

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || (typeof value === "string" && value.trim() === "")) {
      base[key] = null;
    }
  }

  return base;
}

async function saveCollaboratorRows(rows: Record<string, unknown>[]) {
  const withCpf = rows.filter((row) => Boolean(row.cpf));
  const withoutCpf = rows.filter((row) => !row.cpf);

  if (withCpf.length) {
    const { error } = await supabase.from("colaboradores").upsert(withCpf, { onConflict: "cpf" });
    if (error) {
      const message = normalizeError(error, "");
      const missingCpfConstraint =
        message.toLowerCase().includes("no unique") ||
        message.toLowerCase().includes("matching the on conflict") ||
        message.toLowerCase().includes("42p10");

      if (!missingCpfConstraint) throw error;

      const insertRes = await supabase.from("colaboradores").insert(withCpf);
      if (insertRes.error) throw insertRes.error;
    }
  }

  if (withoutCpf.length) {
    const { error } = await supabase.from("colaboradores").insert(withoutCpf);
    if (error) throw error;
  }
}

export default function Page() {
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0 });

  function goToMassImport() {
    const el = document.getElementById("importacao-massa");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadStats() {
    try {
      const totalRes = await supabase.from("colaboradores").select("id", { count: "exact", head: true });
      const ativosRes = await supabase
        .from("colaboradores")
        .select("id", { count: "exact", head: true })
        .is("data_demissao", null);
      const inativosRes = await supabase
        .from("colaboradores")
        .select("id", { count: "exact", head: true })
        .not("data_demissao", "is", null);

      setStats({
        total: totalRes.count ?? 0,
        ativos: ativosRes.count ?? 0,
        inativos: inativosRes.count ?? 0,
      });
    } catch {
      setStats({ total: 0, ativos: 0, inativos: 0 });
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function createOne(payload: ColaboradorPayload) {
    setMsg("");
    setSaving(true);

    try {
      if (!payload.nome || !payload.email || !payload.departamento || !payload.cargo) {
        throw new Error("Preencha: Nome, E-mail, Departamento e Cargo.");
      }

      const row = toDb(payload);
      await saveCollaboratorRows([row]);

      setMsg("Colaborador salvo com sucesso.");
      await loadStats();
    } catch (e: unknown) {
      setMsg(`Erro ao salvar colaborador: ${normalizeError(e, "Falha desconhecida.")}`);
    } finally {
      setSaving(false);
    }
  }

  async function importMany(rows: ColaboradorPayload[]) {
    setMsg("");
    setSaving(true);

    try {
      const normalized = rows.map(toDb);
      const invalidRows = normalized
        .map((row, index) => ({
          index,
          missing: [
            !row.nome ? "Nome" : "",
            !row.email ? "E-mail" : "",
          ].filter(Boolean),
        }))
        .filter((row) => row.missing.length);
      const mapped = normalized.filter((r) => Boolean(r.email) && Boolean(r.nome));

      if (!mapped.length) {
        throw new Error("Nenhum colaborador valido encontrado. Verifique se o CSV possui Nome e E-mail preenchidos.");
      }

      if (invalidRows.length) {
        const firstRows = invalidRows
          .slice(0, 5)
          .map((row) => `linha ${row.index + 2}: ${row.missing.join(", ")}`)
          .join("; ");
        throw new Error(`Existem colaboradores sem dados obrigatorios (${firstRows}). Corrija o arquivo e tente novamente.`);
      }

      await saveCollaboratorRows(mapped as Record<string, unknown>[]);

      setMsg(`Importacao concluida: ${mapped.length} colaborador(es).`);
      await loadStats();
    } catch (e: unknown) {
      setMsg(`Erro ao importar colaboradores: ${normalizeError(e, "Falha desconhecida.")}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <UserPlus size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">Adicionar Colaborador</div>
                <div className="mt-1 text-sm text-slate-600">
                  Cadastre manualmente ou adicione em massa via planilha (CSV).
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={goToMassImport}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:opacity-95"
              >
                <Upload size={16} />
                Adicionar colaboradores em massa
              </button>

              <a
                href="/modelo-colaboradores-referencia.csv"
                download
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Download size={16} />
                Baixar CSV de referencia
              </a>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard icon={<Users size={18} />} label="Total" value={stats.total} helper="Colaboradores cadastrados" />
            <StatCard icon={<BadgeCheck size={18} />} label="Ativos" value={stats.ativos} helper="Sem data de demissao" />
            <StatCard icon={<AlertTriangle size={18} />} label="Inativos" value={stats.inativos} helper="Com data de demissao" />
          </div>
        </CardBody>
      </Card>

      {msg ? (
        <Card>
          <CardBody>
            <div className="text-sm text-slate-800">{msg}</div>
          </CardBody>
        </Card>
      ) : null}

      <div id="importacao-massa">
        <EmployeesImport onImport={importMany} />
      </div>

      <Card>
        <CardBody>
          <div className="text-lg font-bold text-slate-900">Cadastro manual</div>
          <div className="mt-1 text-sm text-slate-600">Preencha os dados abaixo para inserir o colaborador.</div>

          <div className="mt-5">
            <EmployeeForm submitting={saving} onSubmit={createOne} submitLabel="Salvar colaborador" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
