"use client";

import { useEffect, useState } from "react";
import { X, History } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import EmployeeForm, { ColaboradorPayload } from "@/components/rh/EmployeeForm";

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string | null;
  details: unknown;
};

function n(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

function num(v: unknown) {
  const s = n(v).replace(",", ".");
  if (!s) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}

function mapRowToInitial(row: Record<string, unknown>): Partial<ColaboradorPayload> {
  return {
    ...(row as Partial<ColaboradorPayload>),
    departamento: (row.departamento as string | null) ?? "",
    banco: ((row.banco as string | null) ?? (row.bank_name as string | null) ?? "") as string,
    agencia: ((row.agencia as string | null) ?? (row.agency as string | null) ?? "") as string,
    conta_corrente: ((row.conta_corrente as string | null) ?? (row.account as string | null) ?? "") as string,
    pix_key: (row.pix_key as string | null) ?? "",
    pix_key_type: (row.pix_key_type as string | null) ?? "CPF",
    pix_bank: (row.pix_bank as string | null) ?? "",
  };
}

function toDb(payload: ColaboradorPayload, isActive: boolean, editorEmail: string | null) {
  const base: Record<string, unknown> = { ...payload };

  base.nome = n(payload.nome) || null;
  base.empresa = n(payload.empresa) || null;
  base.departamento = n(payload.departamento) || null;
  base.setor = n(payload.setor) || null;

  base.email = n(payload.email) || null;
  base.telefone = n(payload.telefone) || null;
  base.celular = n(payload.celular) || null;
  base.telefone_emergencia = n(payload.telefone_emergencia) || null;
  base.email_pessoal = n(payload.email_pessoal) || null;
  base.email_empresarial = n(payload.email_empresarial) || null;

  base.cargo = n(payload.cargo) || null;
  base.cbo = n(payload.cbo) || null;
  base.salario = num(payload.salario);
  base.turno = n(payload.turno) || null;
  base.moeda = n(payload.moeda) || null;
  base.tipo_contrato = n(payload.tipo_contrato) || null;
  base.escolaridade = n(payload.escolaridade) || null;
  base.superior_direto = n(payload.superior_direto) || null;
  base.email_superior_direto = n(payload.email_superior_direto) || null;
  base.grau_hierarquico = n(payload.grau_hierarquico) || null;
  base.duracao_contrato = n(payload.duracao_contrato) || null;

  base.data_nascimento = n(payload.data_nascimento ?? "") || null;
  base.data_admissao = n(payload.data_admissao ?? "") || null;
  base.data_contrato = n(payload.data_contrato ?? "") || null;
  base.vencimento_contrato = n(payload.vencimento_contrato ?? "") || null;
  base.data_demissao = n(payload.data_demissao ?? "") || null;

  base.cpf = n(payload.cpf) || null;
  base.pne =
    payload.pne === "" || payload.pne === null || payload.pne === undefined
      ? null
      : payload.pne === true || String(payload.pne).toLowerCase() === "sim";
  base.rg = n(payload.rg) || null;
  base.titulo_eleitor = n(payload.titulo_eleitor) || null;
  base.zona_eleitoral = n(payload.zona_eleitoral) || null;
  base.secao_eleitoral = n(payload.secao_eleitoral) || null;
  base.ctps_num = n(payload.ctps_num) || null;
  base.ctps_serie = n(payload.ctps_serie) || null;
  base.reservista = n(payload.reservista) || null;
  base.cnh = n(payload.cnh) || null;
  base.pis = n(payload.pis) || null;

  const banco = n(payload.banco) || null;
  const agencia = n(payload.agencia) || null;
  const conta = n(payload.conta_corrente) || null;

  base.banco = banco;
  base.agencia = agencia;
  base.conta_corrente = conta;

  // Compatibilidade com schema antigo (serao removidas se colunas nao existirem)
  base.bank_name = banco;
  base.agency = agencia;
  base.account = conta;

  base.pix_key = n(payload.pix_key) || null;
  base.pix_key_type = n(payload.pix_key_type) || null;
  base.pix_bank = n(payload.pix_bank) || null;

  base.valor_rescisao = num(payload.valor_rescisao);
  base.motivo_demissao = n(payload.motivo_demissao) || null;

  base.cep = n(payload.cep) || null;
  base.logradouro = n(payload.logradouro) || null;
  base.numero = n(payload.numero) || null;
  base.complemento = n(payload.complemento) || null;
  base.bairro = n(payload.bairro) || null;
  base.cidade = n(payload.cidade) || null;

  base.sistema = n(payload.sistema) || null;
  base.id_colaborador_externo = n(payload.id_colaborador_externo) || null;
  base.id_departamento_externo = n(payload.id_departamento_externo) || null;
  base.id_cargo_externo = n(payload.id_cargo_externo) || null;
  base.unidade = n(payload.unidade) || null;
  base.id_unidade_externo = n(payload.id_unidade_externo) || null;

  base.is_active = isActive;
  if (isActive && !base.data_demissao) {
    base.data_demissao = null;
    base.motivo_demissao = null;
  }

  base.updated_by_email = editorEmail;
  base.updated_at = new Date().toISOString();

  return base;
}

export default function CollaboratorEditWizard({
  collaboratorId,
  onClose,
  onSaved,
}: {
  collaboratorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [initial, setInitial] = useState<Partial<ColaboradorPayload>>({});
  const [isActive, setIsActive] = useState(true);
  const [rowColumns, setRowColumns] = useState<Set<string>>(new Set());

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [lastInfo, setLastInfo] = useState<{ at: string | null; by: string | null }>({
    at: null,
    by: null,
  });

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setMsg(null);

      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("id", collaboratorId)
        .single();

      if (!alive) return;

      if (error || !data) {
        setMsg(error?.message ?? "Nao foi possivel carregar o colaborador.");
        setLoading(false);
        return;
      }

      const row = data as Record<string, unknown>;
      setInitial(mapRowToInitial(row));
      setIsActive(Boolean(row.is_active ?? true));
      setRowColumns(new Set(Object.keys(row)));

      setLastInfo({
        at: typeof row.updated_at === "string" ? new Date(row.updated_at).toLocaleString("pt-BR") : null,
        by: typeof row.updated_by_email === "string" ? row.updated_by_email : null,
      });

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

      if (!res.ok) throw new Error(json?.error ?? "Falha ao carregar historico.");
      setHistory(json.logs ?? []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar historico.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function save(payload: ColaboradorPayload) {
    setSaving(true);
    setMsg(null);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const editorEmail = userRes?.user?.email ?? null;
      const row = toDb(payload, isActive, editorEmail);
      const filtered = Object.fromEntries(
        Object.entries(row).filter(([key]) => rowColumns.has(key))
      );

      const { error } = await supabase
        .from("colaboradores")
        .update(filtered)
        .eq("id", collaboratorId);
      if (error) throw new Error(error.message);

      onSaved();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(1100px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              <div className="text-lg font-semibold text-slate-900">Editar colaborador</div>
              <div className="mt-1 text-xs text-slate-600">
                Ultima alteracao: <b>{lastInfo.at ?? "-"}</b>
                {lastInfo.by ? (
                  <>
                    {" "}por <b>{lastInfo.by}</b>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setShowHistory(true);
                  await loadHistory();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <History size={16} />
                Historico
              </button>

              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {msg && <div className="border-b border-slate-200 px-5 py-3 text-sm text-red-600">{msg}</div>}

          <div className="max-h-[75vh] overflow-y-auto p-5">
            {loading ? (
              <div className="text-sm text-slate-600">Carregando...</div>
            ) : (
              <div className="space-y-5">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Colaborador ativo (desmarque para registrar desligamento)
                  </span>
                </label>

                <EmployeeForm
                  initial={initial}
                  submitting={saving}
                  submitLabel={saving ? "Salvando..." : "Salvar alteracoes"}
                  onSubmit={save}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHistory(false)} />
          <div className="absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div className="text-base font-semibold text-slate-900">Historico de alteracoes</div>
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
                          {h.action ?? "Alteracao"} - {new Date(h.created_at).toLocaleString("pt-BR")}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
