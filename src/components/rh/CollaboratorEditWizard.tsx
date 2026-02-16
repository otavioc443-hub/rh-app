"use client";

import { useEffect, useState } from "react";
import { X, History, TrendingUp, ClipboardPlus, CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import EmployeeForm, { ColaboradorPayload } from "@/components/rh/EmployeeForm";

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string | null;
  details: unknown;
};

type AbsenceEventRow = {
  id: string;
  collaborator_id: string;
  user_id: string | null;
  event_type: "falta" | "atestado" | "licenca" | "outro";
  start_date: string;
  end_date: string | null;
  days_count: number;
  has_certificate: boolean;
  certificate_date: string | null;
  cid: string | null;
  notes: string | null;
  created_at: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

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

function formatCurrency(v: number | null) {
  if (v === null || !Number.isFinite(v)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function diffDaysInclusiveIso(startIso: string, endIso?: string | null) {
  if (!startIso) return 1;
  const s = new Date(`${startIso}T00:00:00`);
  const e = new Date(`${(endIso || startIso)}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function mapRowToInitial(row: Record<string, unknown>): Partial<ColaboradorPayload> {
  return {
    ...(row as Partial<ColaboradorPayload>),
    company_id: (row.company_id as string | null) ?? "",
    department_id: (row.department_id as string | null) ?? "",
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
  base.company_id = n(payload.company_id) || null;
  base.department_id = n(payload.department_id) || null;
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
  startWithPromotion = false,
}: {
  collaboratorId: string;
  onClose: () => void;
  onSaved: () => void;
  startWithPromotion?: boolean;
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
  const [activeView, setActiveView] = useState<"dados" | "absenteismo">("dados");
  const [showPromotion, setShowPromotion] = useState(startWithPromotion);
  const [promotionSaving, setPromotionSaving] = useState(false);
  const [promotionCargo, setPromotionCargo] = useState("");
  const [promotionManualCargo, setPromotionManualCargo] = useState(false);
  const [promotionDate, setPromotionDate] = useState(todayIsoDate());
  const [promotionDescription, setPromotionDescription] = useState("");
  const [cargoOptions, setCargoOptions] = useState<string[]>([]);
  const [collaboratorUserId, setCollaboratorUserId] = useState<string | null>(null);
  const [currentCargo, setCurrentCargo] = useState("");
  const [currentSalary, setCurrentSalary] = useState<number | null>(null);
  const [promotionSalary, setPromotionSalary] = useState("");
  const [absenceLoading, setAbsenceLoading] = useState(false);
  const [absenceSaving, setAbsenceSaving] = useState(false);
  const [absenceRows, setAbsenceRows] = useState<AbsenceEventRow[]>([]);
  const [absenceType, setAbsenceType] = useState<AbsenceEventRow["event_type"]>("falta");
  const [absenceStartDate, setAbsenceStartDate] = useState(todayIsoDate());
  const [absenceEndDate, setAbsenceEndDate] = useState("");
  const [absenceHasCertificate, setAbsenceHasCertificate] = useState(false);
  const [absenceCertificateDate, setAbsenceCertificateDate] = useState("");
  const [absenceCid, setAbsenceCid] = useState("");
  const [absenceNotes, setAbsenceNotes] = useState("");

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
      setCollaboratorUserId(typeof row.user_id === "string" ? row.user_id : null);
      setCurrentCargo(typeof row.cargo === "string" ? row.cargo : "");
      setPromotionCargo(typeof row.cargo === "string" ? row.cargo : "");
      setPromotionManualCargo(false);
      const salaryValue = typeof row.salario === "number" ? row.salario : num(row.salario);
      setCurrentSalary(salaryValue);
      setPromotionSalary(salaryValue === null ? "" : String(salaryValue));

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

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("cargos").select("name").order("name", { ascending: true });
      if (!alive) return;
      const options = (data ?? [])
        .map((r) => (typeof r.name === "string" ? r.name.trim() : ""))
        .filter(Boolean);
      setCargoOptions(Array.from(new Set(options)));
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (activeView !== "absenteismo") return;
    void loadAbsenceEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, collaboratorId]);

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

  async function loadAbsenceEvents() {
    setAbsenceLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from("collaborator_absence_events")
        .select("id,collaborator_id,user_id,event_type,start_date,end_date,days_count,has_certificate,certificate_date,cid,notes,created_at")
        .eq("collaborator_id", collaboratorId)
        .order("start_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        const text = error.message.toLowerCase();
        if (text.includes("does not exist") || text.includes("schema cache") || text.includes("relation")) {
          setMsg(
            "Modulo de absenteismo ainda nao disponivel. Rode supabase/sql/2026-02-16_create_collaborator_absence_events.sql."
          );
          setAbsenceRows([]);
        } else {
          throw new Error(error.message);
        }
      } else {
        setAbsenceRows((data ?? []) as AbsenceEventRow[]);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar registros de absenteismo.");
      setAbsenceRows([]);
    } finally {
      setAbsenceLoading(false);
    }
  }

  async function saveAbsenceEvent() {
    if (!absenceStartDate) {
      setMsg("Informe a data da falta/ocorrencia.");
      return;
    }
    if (absenceEndDate && absenceEndDate < absenceStartDate) {
      setMsg("Data final nao pode ser menor que a data inicial.");
      return;
    }
    if (absenceHasCertificate && !absenceCertificateDate) {
      setMsg("Informe a data do atestado.");
      return;
    }

    setAbsenceSaving(true);
    setMsg(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const createdBy = authData.user?.id ?? null;
      const payload = {
        collaborator_id: collaboratorId,
        user_id: collaboratorUserId,
        event_type: absenceType,
        start_date: absenceStartDate,
        end_date: absenceEndDate || null,
        days_count: diffDaysInclusiveIso(absenceStartDate, absenceEndDate || null),
        has_certificate: absenceHasCertificate,
        certificate_date: absenceHasCertificate ? absenceCertificateDate || null : null,
        cid: absenceHasCertificate ? n(absenceCid) || null : null,
        notes: n(absenceNotes) || null,
        created_by: createdBy,
      };
      const { error } = await supabase.from("collaborator_absence_events").insert(payload);
      if (error) throw new Error(error.message);

      setAbsenceType("falta");
      setAbsenceStartDate(todayIsoDate());
      setAbsenceEndDate("");
      setAbsenceHasCertificate(false);
      setAbsenceCertificateDate("");
      setAbsenceCid("");
      setAbsenceNotes("");
      setMsg("Registro de absenteismo salvo.");
      await loadAbsenceEvents();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar absenteismo.");
    } finally {
      setAbsenceSaving(false);
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

      const companyId = n(payload.company_id) || null;
      const departmentId = n(payload.department_id) || null;
      const syncRes = await fetch(`/api/rh/colaboradores/${collaboratorId}/sync-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          company_id: companyId,
          department_id: departmentId,
        }),
      });
      if (!syncRes.ok) {
        const text = await syncRes.text();
        let errMsg = "Falha ao sincronizar vinculo no perfil.";
        try {
          const json = JSON.parse(text) as { error?: string };
          if (json.error) errMsg = json.error;
        } catch {
          if (text) errMsg = text;
        }
        throw new Error(errMsg);
      }

      onSaved();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function promoteCollaborator() {
    const nextCargo = n(promotionCargo);
    const nextSalary = num(promotionSalary);
    if (!nextCargo) {
      setMsg("Informe o novo cargo para registrar a promocao.");
      return;
    }
    if (nextSalary === null || nextSalary <= 0) {
      setMsg("Informe o novo salario da promocao.");
      return;
    }
    if (!promotionDate) {
      setMsg("Informe a data da promocao.");
      return;
    }
    if (!collaboratorUserId) {
      setMsg("Colaborador sem user_id vinculado. Nao foi possivel registrar promocao.");
      return;
    }

    setPromotionSaving(true);
    setMsg(null);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const editorId = userRes?.user?.id ?? null;
      const editorEmail = userRes?.user?.email ?? null;
      const nowIso = new Date().toISOString();

      const baseUpdate: Record<string, unknown> = {
        cargo: nextCargo,
        salario: nextSalary,
        updated_by_email: editorEmail,
        updated_at: nowIso,
      };
      const filtered = Object.fromEntries(Object.entries(baseUpdate).filter(([key]) => rowColumns.has(key)));
      const { error: upErr } = await supabase.from("colaboradores").update(filtered).eq("id", collaboratorId);
      if (upErr) throw new Error(upErr.message);

      const eventWithSalary = {
        user_id: collaboratorUserId,
        event_date: promotionDate,
        event_type: "promotion",
        title: `Promocao para ${nextCargo}`,
        description: n(promotionDescription) || "Promocao registrada na edicao do colaborador.",
        from_cargo: currentCargo || null,
        to_cargo: nextCargo,
        from_salary: currentSalary,
        to_salary: nextSalary,
        created_by: editorId,
      };
      let salaryTimelineFallback = false;
      let { error: evtErr } = await supabase.from("career_timeline_events").insert(eventWithSalary);
      if (evtErr) {
        const text = evtErr.message.toLowerCase();
        const hasSalaryColumnsIssue =
          text.includes("from_salary") || text.includes("to_salary") || text.includes("schema cache");
        if (hasSalaryColumnsIssue) {
          const eventWithoutSalary = {
            user_id: collaboratorUserId,
            event_date: promotionDate,
            event_type: "promotion",
            title: `Promocao para ${nextCargo}`,
            description: n(promotionDescription) || "Promocao registrada na edicao do colaborador.",
            from_cargo: currentCargo || null,
            to_cargo: nextCargo,
            created_by: editorId,
          };
          const retry = await supabase.from("career_timeline_events").insert(eventWithoutSalary);
          evtErr = retry.error ?? null;
          if (!evtErr) {
            salaryTimelineFallback = true;
          }
        }
      }

      if (evtErr) {
        const text = evtErr.message.toLowerCase();
        if (text.includes("does not exist") || text.includes("relation") || text.includes("schema cache")) {
          setMsg(
            "Cargo atualizado, mas o historico de carreira nao esta disponivel. Rode supabase/sql/2026-02-16_create_career_timeline_events.sql."
          );
        } else {
          setMsg(`Cargo atualizado, mas falhou ao registrar evento: ${evtErr.message}`);
        }
      } else {
        if (salaryTimelineFallback) {
          setMsg(
            "Promocao registrada. Rode supabase/sql/2026-02-16_add_salary_to_career_timeline_events.sql para salvar salario na linha do tempo."
          );
        } else {
          setMsg("Promocao registrada e adicionada na linha do tempo.");
        }
      }

      setCurrentCargo(nextCargo);
      setCurrentSalary(nextSalary);
      setInitial((prev) => ({ ...prev, cargo: nextCargo, salario: String(nextSalary) }));
      setLastInfo({
        at: new Date(nowIso).toLocaleString("pt-BR"),
        by: editorEmail,
      });
      setPromotionDescription("");
      setPromotionSalary(String(nextSalary));
      setShowPromotion(false);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao promover colaborador.");
    } finally {
      setPromotionSaving(false);
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
                onClick={() => {
                  setActiveView("dados");
                  setShowPromotion(false);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <ClipboardPlus size={16} />
                Dados
              </button>

              <button
                onClick={() => {
                  setActiveView("absenteismo");
                  setShowPromotion(false);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <CalendarClock size={16} />
                Absenteismo
              </button>

              <button
                onClick={() => {
                  setActiveView("dados");
                  setShowPromotion((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <TrendingUp size={16} />
                Promover
              </button>

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
                {activeView === "dados" ? (
                  <>
                    {showPromotion ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-sm font-semibold text-emerald-900">Registrar promocao</div>
                        <div className="mt-1 text-xs text-emerald-800">
                          Cargo atual: <b>{currentCargo || "-"}</b>
                        </div>
                        <div className="mt-1 text-xs text-emerald-800">
                          Salario atual: <b>{formatCurrency(currentSalary)}</b>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <select
                            value={promotionManualCargo ? "__manual__" : promotionCargo}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "__manual__") {
                                setPromotionManualCargo(true);
                                setPromotionCargo("");
                                return;
                              }
                              setPromotionManualCargo(false);
                              setPromotionCargo(v);
                            }}
                            className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-900 md:col-span-2"
                          >
                            <option value="">Selecione o novo cargo</option>
                            {cargoOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            <option value="__manual__">Digitar manualmente</option>
                          </select>

                          <input
                            type="date"
                            value={promotionDate}
                            onChange={(e) => setPromotionDate(e.target.value)}
                            className="h-10 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-900"
                          />
                        </div>
                        <input
                          value={promotionSalary}
                          onChange={(e) => setPromotionSalary(e.target.value)}
                          placeholder="Novo salario (ex.: 6500 ou 6500,00)"
                          className="mt-3 h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-900"
                        />
                        {promotionManualCargo ? (
                          <input
                            value={promotionCargo}
                            onChange={(e) => setPromotionCargo(e.target.value)}
                            placeholder="Novo cargo (manual)"
                            className="mt-3 h-10 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-900"
                          />
                        ) : null}
                        <textarea
                          value={promotionDescription}
                          onChange={(e) => setPromotionDescription(e.target.value)}
                          placeholder="Descricao (opcional)"
                          className="mt-3 min-h-[84px] w-full rounded-xl border border-emerald-200 bg-white p-3 text-sm text-slate-900"
                        />
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void promoteCollaborator()}
                            disabled={promotionSaving}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            <TrendingUp size={16} />
                            {promotionSaving ? "Registrando..." : "Registrar promocao"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPromotion(false)}
                            className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}

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
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">Registrar absenteismo</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="grid gap-1 text-xs font-semibold text-slate-700">
                          Tipo
                          <select
                            value={absenceType}
                            onChange={(e) => setAbsenceType(e.target.value as AbsenceEventRow["event_type"])}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          >
                            <option value="falta">Falta</option>
                            <option value="atestado">Atestado</option>
                            <option value="licenca">Licenca</option>
                            <option value="outro">Outro</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-700">
                          Data inicio
                          <input
                            type="date"
                            value={absenceStartDate}
                            onChange={(e) => setAbsenceStartDate(e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-700">
                          Data fim (opcional)
                          <input
                            type="date"
                            value={absenceEndDate}
                            onChange={(e) => setAbsenceEndDate(e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          />
                        </label>
                      </div>

                      <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={absenceHasCertificate}
                          onChange={(e) => setAbsenceHasCertificate(e.target.checked)}
                        />
                        Possui atestado
                      </label>

                      {absenceHasCertificate ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="grid gap-1 text-xs font-semibold text-slate-700">
                            Data do atestado
                            <input
                              type="date"
                              value={absenceCertificateDate}
                              onChange={(e) => setAbsenceCertificateDate(e.target.value)}
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-slate-700">
                            CID
                            <input
                              value={absenceCid}
                              onChange={(e) => setAbsenceCid(e.target.value)}
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                              placeholder="Ex.: J11"
                            />
                          </label>
                        </div>
                      ) : null}

                      <textarea
                        value={absenceNotes}
                        onChange={(e) => setAbsenceNotes(e.target.value)}
                        placeholder="Demais informacoes relacionadas"
                        className="mt-3 min-h-[88px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
                      />

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void saveAbsenceEvent()}
                          disabled={absenceSaving}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
                        >
                          {absenceSaving ? "Salvando..." : "Registrar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void loadAbsenceEvents()}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Recarregar
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Historico de absenteismo</div>
                      {absenceLoading ? (
                        <div className="mt-3 text-sm text-slate-600">Carregando...</div>
                      ) : absenceRows.length ? (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-[920px] w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-700">
                              <tr>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Inicio</th>
                                <th className="p-3">Fim</th>
                                <th className="p-3">Dias</th>
                                <th className="p-3">Atestado</th>
                                <th className="p-3">CID</th>
                                <th className="p-3">Observacao</th>
                              </tr>
                            </thead>
                            <tbody>
                              {absenceRows.map((r) => (
                                <tr key={r.id} className="border-t">
                                  <td className="p-3">{r.event_type}</td>
                                  <td className="p-3">{r.start_date}</td>
                                  <td className="p-3">{r.end_date ?? "-"}</td>
                                  <td className="p-3">{r.days_count}</td>
                                  <td className="p-3">{r.has_certificate ? (r.certificate_date ?? "Sim") : "Nao"}</td>
                                  <td className="p-3">{r.cid ?? "-"}</td>
                                  <td className="p-3">{r.notes ?? "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-600">Sem registros de absenteismo.</div>
                      )}
                    </div>
                  </div>
                )}
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
