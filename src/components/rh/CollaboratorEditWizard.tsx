"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, History } from "lucide-react";

type Cargo = { id: string; name: string };
type Dept = { id: string; name: string };

type FormState = {
  // básico
  nome: string;
  empresa: string;
  setor: string;
  cargo_id: string | "";
  department_id: string | "";
  is_active: boolean;

  // contato
  email: string;
  telefone: string;
  celular: string;

  // pagamento
  bank_name: string;
  agency: string;
  account: string;
  pix_key: string;
  pix_key_type: string; // CPF/EMAIL/TELEFONE/ALEATORIA
  pix_bank: string;
  frequency: string;
  work_period: string;
  tariff_value: string;

  // desligamento
  termination_date: string;
  termination_reason: string;
};

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string | null;
  details: unknown;
};

const steps = [
  { id: "basico", label: "Básico" },
  { id: "contato", label: "Contato" },
  { id: "pagamento", label: "Pagamento" },
  { id: "desligamento", label: "Desligamento" },
] as const;

type StepId = typeof steps[number]["id"];

export default function CollaboratorEditWizard({
  collaboratorId,
  onClose,
  onSaved,
}: {
  collaboratorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<StepId>("basico");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [lastInfo, setLastInfo] = useState<{ at: string | null; by: string | null }>({
    at: null,
    by: null,
  });

  const [form, setForm] = useState<FormState>({
    nome: "",
    empresa: "",
    setor: "",
    cargo_id: "",
    department_id: "",
    is_active: true,

    email: "",
    telefone: "",
    celular: "",

    bank_name: "",
    agency: "",
    account: "",
    pix_key: "",
    pix_key_type: "CPF",
    pix_bank: "",
    frequency: "",
    work_period: "",
    tariff_value: "",

    termination_date: "",
    termination_reason: "",
  });

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setMsg(null);

      // 1) cargas/depts
      const [cRes, dRes] = await Promise.all([
        supabase.from("cargos").select("id, name").order("name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);

      if (!alive) return;

      if (!cRes.error) setCargos((cRes.data ?? []) as Cargo[]);
      if (!dRes.error) setDepts((dRes.data ?? []) as Dept[]);

      // 2) colaborador
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("id", collaboratorId)
        .single();

      if (!alive) return;

      if (error || !data) {
        setMsg(error?.message ?? "Não foi possível carregar o colaborador.");
        setLoading(false);
        return;
      }

      // 3) auditoria rápida (última alteração)
      // (se você já tem `updated_at` e `updated_by_email`, usamos; se não, fica vazio)
      setLastInfo({
        at: data.updated_at ? new Date(data.updated_at).toLocaleString("pt-BR") : null,
        by: data.updated_by_email ?? null,
      });

      setForm((prev) => ({
        ...prev,
        nome: data.nome ?? "",
        empresa: data.empresa ?? "",
        setor: data.setor ?? "",
        cargo_id: data.cargo_id ?? "",
        department_id: data.department_id ?? "",
        is_active: !!data.is_active,

        email: data.email ?? "",
        telefone: data.telefone ?? "",
        celular: data.celular ?? "",

        bank_name: data.bank_name ?? "",
        agency: data.agency ?? "",
        account: data.account ?? "",
        pix_key: data.pix_key ?? "",
        pix_key_type: data.pix_key_type ?? "CPF",
        pix_bank: data.pix_bank ?? "",
        frequency: data.frequency ?? "",
        work_period: data.work_period ?? "",
        tariff_value: data.tariff_value ?? "",

        termination_date: data.termination_date ?? "",
        termination_reason: data.termination_reason ?? "",
      }));

      setLoading(false);
    }

    boot();

    return () => {
      alive = false;
    };
  }, [collaboratorId]);

  async function loadHistory() {
    setHistoryLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/rh/colaboradores/${collaboratorId}/logs`, { method: "GET" });
      const text = await res.text();
      const json = JSON.parse(text);

      if (!res.ok) throw new Error(json?.error ?? "Falha ao carregar histórico.");
      setHistory(json.logs ?? []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar histórico.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);

    try {
      // regra: se ativo, limpa desligamento
      const termination_date = form.is_active ? null : (form.termination_date || null);
      const termination_reason = form.is_active ? null : (form.termination_reason || null);

      const payload: Record<string, unknown> = {
        nome: form.nome,
        empresa: form.empresa,
        setor: form.setor,
        cargo_id: form.cargo_id || null,
        department_id: form.department_id || null,
        is_active: form.is_active,

        email: form.email || null,
        telefone: form.telefone || null,
        celular: form.celular || null,

        bank_name: form.bank_name || null,
        agency: form.agency || null,
        account: form.account || null,
        pix_key: form.pix_key || null,
        pix_key_type: form.pix_key_type || null,
        pix_bank: form.pix_bank || null,
        frequency: form.frequency || null,
        work_period: form.work_period || null,
        tariff_value: form.tariff_value || null,

        termination_date,
        termination_reason,
      };

      const { data: userRes } = await supabase.auth.getUser();
      const editorEmail = userRes?.user?.email ?? null;

      payload.updated_by_email = editorEmail;
      payload.updated_at = new Date().toISOString();

      const { error } = await supabase.from("colaboradores").update(payload).eq("id", collaboratorId);
      if (error) throw new Error(error.message);

      onSaved();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = useMemo(() => steps.findIndex((s) => s.id === step), [step]);

  function next() {
    const i = stepIndex;
    if (i < steps.length - 1) setStep(steps[i + 1].id);
  }
  function prev() {
    const i = stepIndex;
    if (i > 0) setStep(steps[i - 1].id);
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <div className="text-lg font-semibold text-slate-900">Editar colaborador</div>
              <div className="mt-1 text-xs text-slate-600">
                Última alteração:{" "}
                <b>{lastInfo.at ?? "-"}</b>
                {lastInfo.by ? <> • por <b>{lastInfo.by}</b></> : null}
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  step === s.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={async () => {
                  setShowHistory(true);
                  await loadHistory();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <History size={16} />
                Histórico
              </button>
            </div>
          </div>

          {msg && <div className="border-b border-slate-200 px-5 py-3 text-sm text-red-600">{msg}</div>}

          {/* ✅ altura fixa + scroll interno */}
          <div className="max-h-[65vh] overflow-y-auto p-5">
            {loading ? (
              <div className="text-sm text-slate-600">Carregando...</div>
            ) : (
              <>
                {step === "basico" && (
                  <div className="rounded-3xl border border-slate-200 p-5">
                    <h3 className="text-base font-semibold text-slate-900">Básico</h3>
                    <p className="mt-1 text-sm text-slate-600">Etapa 1 de {steps.length}</p>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Field label="Nome">
                        <input
                          value={form.nome}
                          onChange={(e) => setField("nome", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Cargo">
                        <select
                          value={form.cargo_id}
                          onChange={(e) => setField("cargo_id", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        >
                          <option value="">Selecione...</option>
                          {cargos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Departamento">
                        <select
                          value={form.department_id}
                          onChange={(e) => setField("department_id", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        >
                          <option value="">Selecione...</option>
                          {depts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Empresa">
                        <input
                          value={form.empresa}
                          onChange={(e) => setField("empresa", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Setor">
                        <input
                          value={form.setor}
                          onChange={(e) => setField("setor", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <div className="md:col-span-3">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => setField("is_active", e.target.checked)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-slate-800 font-medium">
                            Colaborador ativo (pode acessar o portal)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {step === "contato" && (
                  <div className="rounded-3xl border border-slate-200 p-5">
                    <h3 className="text-base font-semibold text-slate-900">Contato</h3>
                    <p className="mt-1 text-sm text-slate-600">Etapa 2 de {steps.length}</p>

                    {/* ✅ aqui corrige o cursor: inputs estáveis */}
                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Field label="E-mail">
                        <input
                          value={form.email}
                          onChange={(e) => setField("email", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Telefone">
                        <input
                          value={form.telefone}
                          onChange={(e) => setField("telefone", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Celular">
                        <input
                          value={form.celular}
                          onChange={(e) => setField("celular", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {step === "pagamento" && (
                  <div className="rounded-3xl border border-slate-200 p-5">
                    <h3 className="text-base font-semibold text-slate-900">Pagamento</h3>
                    <p className="mt-1 text-sm text-slate-600">Etapa 3 de {steps.length}</p>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Field label="Banco">
                        <input
                          value={form.bank_name}
                          onChange={(e) => setField("bank_name", e.target.value)}
                          placeholder="Ex.: 260 - NU PAGAMENTOS S.A."
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Agência">
                        <input
                          value={form.agency}
                          onChange={(e) => setField("agency", e.target.value)}
                          placeholder="Ex.: 0001"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Conta corrente">
                        <input
                          value={form.account}
                          onChange={(e) => setField("account", e.target.value)}
                          placeholder="Ex.: 123456-7"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Chave PIX">
                        <input
                          value={form.pix_key}
                          onChange={(e) => setField("pix_key", e.target.value)}
                          placeholder="Digite a chave"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Tipo de chave">
                        <select
                          value={form.pix_key_type}
                          onChange={(e) => setField("pix_key_type", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        >
                          <option value="CPF">CPF</option>
                          <option value="EMAIL">E-mail</option>
                          <option value="TELEFONE">Telefone</option>
                          <option value="ALEATORIA">Aleatória</option>
                        </select>
                      </Field>

                      <Field label="Banco (PIX)">
                        <input
                          value={form.pix_bank}
                          onChange={(e) => setField("pix_bank", e.target.value)}
                          placeholder="Opcional"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Frequência">
                        <select
                          value={form.frequency}
                          onChange={(e) => setField("frequency", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        >
                          <option value="">Selecione...</option>
                          <option value="Mensal">Mensal</option>
                          <option value="Quinzenal">Quinzenal</option>
                          <option value="Semanal">Semanal</option>
                        </select>
                      </Field>

                      <Field label="Período trabalhado">
                        <input
                          value={form.work_period}
                          onChange={(e) => setField("work_period", e.target.value)}
                          placeholder="Ex.: 01 a 30"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Valor da tarifa">
                        <input
                          value={form.tariff_value}
                          onChange={(e) => setField("tariff_value", e.target.value)}
                          placeholder="Ex.: 10"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {step === "desligamento" && (
                  <div className="rounded-3xl border border-slate-200 p-5">
                    <h3 className="text-base font-semibold text-slate-900">Desligamento</h3>
                    <p className="mt-1 text-sm text-slate-600">Etapa 4 de {steps.length}</p>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Data demissão">
                        <input
                          type="date"
                          value={form.termination_date}
                          onChange={(e) => setField("termination_date", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <Field label="Motivo">
                        <input
                          value={form.termination_reason}
                          onChange={(e) => setField("termination_reason", e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </Field>

                      <div className="md:col-span-2 text-xs text-slate-500">
                        Se o colaborador estiver <b>ativo</b>, os campos de desligamento serão limpos ao salvar.
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-5">
            <button
              onClick={prev}
              disabled={stepIndex === 0 || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              Voltar
            </button>

            <div className="flex items-center gap-2">
              {stepIndex < steps.length - 1 ? (
                <button
                  onClick={next}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  Avançar
                </button>
              ) : (
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Histórico */}
      {showHistory && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHistory(false)} />
          <div className="absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div className="text-base font-semibold text-slate-900">Histórico de alterações</div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-5">
                {historyLoading ? (
                  <div className="text-sm text-slate-600">Carregando...</div>
                ) : history.length === 0 ? (
                  <div className="text-sm text-slate-600">Sem logs para este colaborador.</div>
                ) : (
                  <div className="space-y-3">
                    {history.map((h) => (
                      <div key={h.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {h.action ?? "Alteração"} •{" "}
                          {new Date(h.created_at).toLocaleString("pt-BR")}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          por: <b>{h.actor_email ?? "-"}</b>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                          {JSON.stringify(h.details ?? {}, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-5">
                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-900">{label}</div>
      {children}
    </div>
  );
}
