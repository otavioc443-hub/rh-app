"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users, BadgeCheck, AlertTriangle, Upload, Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import EmployeeForm, { ColaboradorPayload } from "@/components/rh/EmployeeForm";
import EmployeesImport from "@/components/rh/EmployeesImport";
import { StatCard, Card, CardBody } from "@/components/ui/PageShell";

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

  const base: Record<string, unknown> = { ...payload };

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

  base.data_admissao = n(payload.data_admissao) || null;
  base.data_demissao = n(payload.data_demissao) || null;

  base.celular = n(payload.celular) || null;
  base.salario = num(payload.salario);
  base.valor_rescisao = num(payload.valor_rescisao);

  return base;
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
      if (!payload.nome || !payload.cpf || !payload.email || !payload.departamento || !payload.cargo) {
        throw new Error("Preencha: Nome, CPF, E-mail, Departamento e Cargo.");
      }

      const row = toDb(payload);
      const { error } = await supabase
        .from("colaboradores")
        .upsert(row as Record<string, unknown>, { onConflict: "cpf" });
      if (error) throw error;

      setMsg("Colaborador salvo com sucesso.");
      await loadStats();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function importMany(rows: ColaboradorPayload[]) {
    setMsg("");
    setSaving(true);

    try {
      const mapped = rows.map(toDb).filter((r) => Boolean(r.cpf) && Boolean(r.email) && Boolean(r.nome));
      const { error } = await supabase
        .from("colaboradores")
        .upsert(mapped as Record<string, unknown>[], { onConflict: "cpf" });
      if (error) throw error;

      setMsg(`Importacao concluida: ${mapped.length} colaborador(es).`);
      await loadStats();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar.");
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
