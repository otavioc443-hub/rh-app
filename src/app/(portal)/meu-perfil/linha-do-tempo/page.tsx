"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, GitBranch, RefreshCcw, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ColaboradorResumo = {
  user_id: string | null;
  nome: string | null;
  cargo: string | null;
  tipo_contrato: string | null;
  data_admissao: string | null;
  data_contrato: string | null;
  vencimento_contrato: string | null;
  data_demissao: string | null;
  motivo_demissao: string | null;
  superior_direto: string | null;
  grau_hierarquico: string | null;
  empresa: string | null;
  departamento: string | null;
  setor: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type TimelineEvent = {
  key: string;
  title: string;
  date: string;
  description: string;
  kind: "start" | "progress" | "attention" | "end";
};

type CareerTimelineRow = {
  id: string;
  event_date: string;
  event_type:
    | "admission"
    | "promotion"
    | "role_change"
    | "department_change"
    | "contract_change"
    | "contract_renewal"
    | "termination"
    | "other";
  title: string;
  description: string | null;
  from_cargo: string | null;
  to_cargo: string | null;
  from_department: string | null;
  to_department: string | null;
  from_contract_type: string | null;
  to_contract_type: string | null;
  from_salary: number | null;
  to_salary: number | null;
  created_at: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("pt-BR");
}

function diffInDays(fromIso: string | null) {
  if (!fromIso) return null;
  const start = new Date(fromIso);
  if (Number.isNaN(start.getTime())) return null;
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function toHumanTenure(days: number | null) {
  if (days === null) return "-";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years <= 0 && months <= 0) return "Menos de 1 mes";
  if (years <= 0) return `${months} mes${months > 1 ? "es" : ""}`;
  if (months <= 0) return `${years} ano${years > 1 ? "s" : ""}`;
  return `${years} ano${years > 1 ? "s" : ""} e ${months} mes${months > 1 ? "es" : ""}`;
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function eventDotClass(kind: TimelineEvent["kind"]) {
  if (kind === "start") return "bg-emerald-500";
  if (kind === "end") return "bg-rose-500";
  if (kind === "attention") return "bg-amber-500";
  return "bg-slate-400";
}

function mapKindFromType(type: CareerTimelineRow["event_type"]): TimelineEvent["kind"] {
  if (type === "admission") return "start";
  if (type === "termination") return "end";
  if (type === "contract_renewal") return "attention";
  return "progress";
}

export default function MinhaLinhaDoTempoPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [row, setRow] = useState<ColaboradorResumo | null>(null);
  const [careerRows, setCareerRows] = useState<CareerTimelineRow[]>([]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData.user;
      if (!user) {
        setRow(null);
        setCareerRows([]);
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      const [colabRes, historyRes] = await Promise.all([
        supabase
          .from("colaboradores")
          .select(
            "user_id,nome,cargo,tipo_contrato,data_admissao,data_contrato,vencimento_contrato,data_demissao,motivo_demissao,superior_direto,grau_hierarquico,empresa,departamento,setor,updated_at,created_at"
          )
          .eq("user_id", user.id)
          .maybeSingle<ColaboradorResumo>(),
        supabase
          .from("career_timeline_events")
          .select(
            "id,event_date,event_type,title,description,from_cargo,to_cargo,from_department,to_department,from_contract_type,to_contract_type,from_salary,to_salary,created_at"
          )
          .eq("user_id", user.id)
          .order("event_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (colabRes.error) throw colabRes.error;
      setRow(colabRes.data ?? null);

      if (historyRes.error) {
        setCareerRows([]);
        const text = historyRes.error.message.toLowerCase();
        if (text.includes("does not exist") || text.includes("schema cache") || text.includes("relation")) {
          if (!colabRes.data) {
            setMsg("Nao encontramos dados para montar sua linha do tempo.");
          } else {
            setMsg(
              "Historico avancado ainda nao disponivel. Rode supabase/sql/2026-02-16_create_career_timeline_events.sql."
            );
          }
        } else if (!colabRes.data) {
          setMsg("Nao encontramos dados para montar sua linha do tempo.");
        } else {
          setMsg(historyRes.error.message);
        }
      } else {
        setCareerRows((historyRes.data ?? []) as CareerTimelineRow[]);
        if (!colabRes.data && !(historyRes.data ?? []).length) {
          setMsg("Nao encontramos dados para montar sua linha do tempo.");
        }
      }
    } catch (e: unknown) {
      setRow(null);
      setCareerRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar linha do tempo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const tenureDays = useMemo(() => diffInDays(row?.data_admissao ?? null), [row?.data_admissao]);
  const isPjContract = useMemo(() => (row?.tipo_contrato ?? "").trim().toUpperCase() === "PJ", [row?.tipo_contrato]);

  const historyTimeline = useMemo<TimelineEvent[]>(() => {
    return careerRows.map((evt) => {
      const moves: string[] = [];
      if (evt.from_cargo || evt.to_cargo) moves.push(`Cargo: ${evt.from_cargo ?? "-"} -> ${evt.to_cargo ?? "-"}`);
      if (evt.from_department || evt.to_department) {
        moves.push(`Departamento: ${evt.from_department ?? "-"} -> ${evt.to_department ?? "-"}`);
      }
      if (evt.from_contract_type || evt.to_contract_type) {
        moves.push(`Contrato: ${evt.from_contract_type ?? "-"} -> ${evt.to_contract_type ?? "-"}`);
      }
      if (evt.from_salary !== null || evt.to_salary !== null) {
        moves.push(`Salario: ${formatMoney(evt.from_salary)} -> ${formatMoney(evt.to_salary)}`);
      }
      const details = [evt.description ?? "", ...moves].filter(Boolean).join(" ");
      return {
        key: evt.id,
        title: evt.title,
        date: evt.event_date,
        description: details || "Evento registrado no historico contratual.",
        kind: mapKindFromType(evt.event_type),
      };
    });
  }, [careerRows]);

  const fallbackTimeline = useMemo<TimelineEvent[]>(() => {
    if (!row) return [];
    const events: TimelineEvent[] = [];

    if (row.data_admissao) {
      events.push({
        key: "admissao",
        title: "Admissao",
        date: row.data_admissao,
        description: `Entrada na empresa${row.empresa ? ` (${row.empresa})` : ""}.`,
        kind: "start",
      });
    }

    if (row.data_contrato) {
      events.push({
        key: "contrato",
        title: "Inicio do contrato atual",
        date: row.data_contrato,
        description: row.tipo_contrato
          ? `Contrato registrado como ${row.tipo_contrato}.`
          : "Contrato registrado no sistema.",
        kind: "progress",
      });
    }

    if (row.updated_at || row.created_at) {
      events.push({
        key: "cargo-atual",
        title: "Cargo atual registrado",
        date: row.updated_at ?? row.created_at ?? "",
        description: row.cargo
          ? `Cargo atual: ${row.cargo}${row.grau_hierarquico ? ` (${row.grau_hierarquico})` : ""}.`
          : "Cargo nao informado no cadastro.",
        kind: "progress",
      });
    }

    if (row.vencimento_contrato) {
      events.push({
        key: "vencimento",
        title: "Vencimento contratual",
        date: row.vencimento_contrato,
        description: "Data prevista para vencimento do contrato atual.",
        kind: "attention",
      });
    }

    if (row.data_demissao) {
      events.push({
        key: "demissao",
        title: "Desligamento",
        date: row.data_demissao,
        description: row.motivo_demissao ? `Motivo: ${row.motivo_demissao}.` : "Desligamento registrado.",
        kind: "end",
      });
    }

    return events
      .filter((evt) => evt.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [row]);

  const timeline = historyTimeline.length ? historyTimeline : fallbackTimeline;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Minha linha do tempo</h1>
            <p className="mt-1 text-sm text-slate-600">
              Visualize sua trajetoria contratual na empresa, com marcos de contratacao e movimentacoes.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <BriefcaseBusiness size={16} /> Cargo atual
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{row?.cargo?.trim() || "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays size={16} /> Tempo de casa
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{toHumanTenure(tenureDays)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <GitBranch size={16} /> Tipo de contrato
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{row?.tipo_contrato?.trim() || "-"}</p>
        </div>
        {!isPjContract ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <UserRound size={16} /> Gestor direto
            </div>
            <p className="mt-2 text-base font-semibold text-slate-900">{row?.superior_direto?.trim() || "-"}</p>
          </div>
        ) : null}
      </div>

      {msg ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{msg}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Trajetoria contratual</p>
        <p className="mt-1 text-sm text-slate-600">
          {historyTimeline.length
            ? "Linha do tempo alimentada por eventos de promocao, movimentacao e contrato."
            : "Ordem cronologica dos principais registros do seu vinculo com a empresa."}
        </p>

        {loading ? (
          <div className="mt-4 h-36 animate-pulse rounded-2xl bg-slate-100" />
        ) : timeline.length ? (
          <div className="mt-5 space-y-4">
            {timeline.map((event, index) => (
              <div key={event.key} className="relative pl-8">
                {index < timeline.length - 1 ? (
                  <div className="absolute left-[10px] top-5 h-[calc(100%+0.5rem)] w-px bg-slate-200" />
                ) : null}
                <div className={`absolute left-0 top-1.5 h-5 w-5 rounded-full ${eventDotClass(event.kind)}`} />
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <span className="text-xs text-slate-500">{formatDate(event.date)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Ainda nao ha marcos suficientes para compor sua linha do tempo.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        Local atual: {row?.empresa?.trim() || "-"} - {row?.departamento?.trim() || "-"} - {row?.setor?.trim() || "-"}
      </div>
    </div>
  );
}
