"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type SlaRow = {
  config_key: string;
  sla_hours: number;
  description: string | null;
};

const CONTRACT_SLA_CONFIG_KEY = "project_contract_events_ceo_approval";
const CONTRACT_SLA_LEGACY_CONFIG_KEY = "project_contract_events_finance_approval";

export default function AdminSlaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [profileUpdateSlaHours, setProfileUpdateSlaHours] = useState(72);
  const [contractApprovalSlaHours, setContractApprovalSlaHours] = useState(48);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida.");
      setUserId(authData.user.id);

      const { data, error } = await supabase
        .from("request_sla_settings")
        .select("config_key,sla_hours,description")
        .in("config_key", ["profile_update_requests", CONTRACT_SLA_CONFIG_KEY, CONTRACT_SLA_LEGACY_CONFIG_KEY]);
      if (error) throw error;
      const rows = (data ?? []) as SlaRow[];
      const profileRow = rows.find((r) => r.config_key === "profile_update_requests");
      const contractRow =
        rows.find((r) => r.config_key === CONTRACT_SLA_CONFIG_KEY) ??
        rows.find((r) => r.config_key === CONTRACT_SLA_LEGACY_CONFIG_KEY);
      if (profileRow?.sla_hours) setProfileUpdateSlaHours(profileRow.sla_hours);
      if (contractRow?.sla_hours) setContractApprovalSlaHours(contractRow.sla_hours);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar configuracao de SLA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      if (!userId) throw new Error("Sessao invalida.");
      const normalizedProfile = Number.isFinite(profileUpdateSlaHours) ? Math.round(profileUpdateSlaHours) : 72;
      const normalizedContract = Number.isFinite(contractApprovalSlaHours) ? Math.round(contractApprovalSlaHours) : 48;
      if (normalizedProfile <= 0 || normalizedProfile > 720) throw new Error("SLA de solicitacoes: informe entre 1 e 720 horas.");
      if (normalizedContract <= 0 || normalizedContract > 720) throw new Error("SLA de aditivos: informe entre 1 e 720 horas.");

      const { error } = await supabase.from("request_sla_settings").upsert(
        [
          {
            config_key: "profile_update_requests",
            sla_hours: normalizedProfile,
            description: "SLA em horas para solicitacoes de adequacao de dados (RH e Financeiro).",
            updated_by: userId,
          },
          {
            config_key: CONTRACT_SLA_CONFIG_KEY,
            sla_hours: normalizedContract,
            description: "SLA em horas para aprovacao do CEO em aditivos de valor de contratos de projetos.",
            updated_by: userId,
          },
        ],
        { onConflict: "config_key" }
      );
      if (error) throw error;
      setMsg("SLA atualizado com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar SLA.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Configuracao de SLA</h1>
            <p className="mt-1 text-sm text-slate-600">
              Defina o prazo maximo (em horas) para analise das solicitacoes de adequacao.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            SLA solicitacoes de adequacao (horas)
            <input
              type="number"
              min={1}
              max={720}
              value={profileUpdateSlaHours}
              onChange={(e) => setProfileUpdateSlaHours(Number(e.target.value))}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
            <span className="text-xs font-normal text-slate-500">
              Usado nas filas de solicitacoes RH e Financeiro.
            </span>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            SLA aprovacao do CEO para aditivos de valor (horas)
            <input
              type="number"
              min={1}
              max={720}
              value={contractApprovalSlaHours}
              onChange={(e) => setContractApprovalSlaHours(Number(e.target.value))}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
            <span className="text-xs font-normal text-slate-500">
              Usado na fila de aprovacao do CEO para aditivos contratuais.
            </span>
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar SLA"}
          </button>
        </div>
      </div>
    </div>
  );
}
