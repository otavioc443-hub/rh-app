"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users, BadgeCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import EmployeeForm, { ColaboradorPayload } from "@/components/rh/EmployeeForm";
import EmployeesImport from "@/components/rh/EmployeesImport";
import { PageHeader, StatCard, Card, CardBody } from "@/components/ui/PageShell";

function toDb(payload: ColaboradorPayload) {
  const n = (v?: string | null) => (v ?? "").trim();
  const num = (v?: string | null) => {
    const s = n(v).replace(",", ".");
    if (!s) return null;
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
  };

  // ✅ primeiro espalha tudo (mantém campos extras)
  const base: any = { ...payload };

  // ✅ depois normaliza os principais (evita "" virar valor no banco)
  base.empresa = n(payload.empresa) || null;
  base.setor = n(payload.setor) || null;
  base.nome = n(payload.nome) || null;
  base.cpf = n(payload.cpf) || null;
  base.email = n(payload.email) || null;
  base.departamento = n(payload.departamento) || null;
  base.cargo = n(payload.cargo) || null;

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
      const { error } = await supabase.from("colaboradores").upsert(row as any, { onConflict: "cpf" });
      if (error) throw error;

      setMsg("✅ Colaborador salvo com sucesso!");
      await loadStats();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Erro ao salvar."}`);
    } finally {
      setSaving(false);
    }
  }

  async function importMany(rows: ColaboradorPayload[]) {
    setMsg("");
    setSaving(true);

    try {
      const mapped = rows.map(toDb).filter((r: any) => r?.cpf && r?.email && r?.nome);
      const { error } = await supabase.from("colaboradores").upsert(mapped as any, { onConflict: "cpf" });
      if (error) throw error;

      setMsg(`✅ Importação concluída: ${mapped.length} colaborador(es).`);
      await loadStats();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Erro ao importar."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader
        icon={<UserPlus size={22} />}
        title="Adicionar Colaborador"
        subtitle="Cadastre manualmente ou adicione em massa via planilha (CSV)."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={<Users size={18} />} label="Total" value={stats.total} helper="Colaboradores cadastrados" />
        <StatCard icon={<BadgeCheck size={18} />} label="Ativos" value={stats.ativos} helper="Sem data de demissão" />
        <StatCard icon={<AlertTriangle size={18} />} label="Inativos" value={stats.inativos} helper="Com data de demissão" />
      </div>

      {msg ? (
        <Card>
          <CardBody>
            <div className="text-sm text-slate-800">{msg}</div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EmployeesImport onImport={importMany} />

        <Card>
          <CardBody>
            <div className="text-lg font-bold text-slate-900">Cadastro manual</div>
            <div className="mt-1 text-sm text-slate-600">Preencha os campos principais e salve.</div>

            <div className="mt-5">
              <EmployeeForm submitting={saving} onSubmit={createOne} submitLabel="Salvar colaborador" />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
