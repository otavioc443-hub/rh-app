"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ColaboradorBirthday = {
  id: string;
  nome: string | null;
  data_nascimento: string | null;
  departamento: string | null;
  cargo: string | null;
  is_active: boolean | null;
};

type BirthdayRow = {
  id: string;
  nome: string;
  nascimento: string;
  departamento: string;
  cargo: string;
  nextDate: Date;
  daysLeft: number;
};

function parseDateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function nextBirthdayDate(birthIso: string, now = new Date()) {
  const birth = parseDateOnly(birthIso);
  const month = birth.getMonth();
  const day = birth.getDate();

  const currentYear = now.getFullYear();
  let next = new Date(currentYear, month, day);
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next = new Date(currentYear + 1, month, day);
  }
  return next;
}

function diffInDays(a: Date, b: Date) {
  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.max(0, Math.round((x - y) / (1000 * 60 * 60 * 24)));
}

export default function AniversariantesPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<BirthdayRow[]>([]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,data_nascimento,departamento,cargo,is_active")
        .eq("is_active", true)
        .not("data_nascimento", "is", null);
      if (error) throw error;

      const now = new Date();
      const normalized = ((data ?? []) as ColaboradorBirthday[])
        .filter((r) => Boolean(r.data_nascimento))
        .map((r) => {
          const next = nextBirthdayDate(String(r.data_nascimento), now);
          return {
            id: r.id,
            nome: r.nome ?? "Sem nome",
            nascimento: String(r.data_nascimento),
            departamento: r.departamento ?? "-",
            cargo: r.cargo ?? "-",
            nextDate: next,
            daysLeft: diffInDays(next, now),
          } as BirthdayRow;
        })
        .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

      setRows(normalized);
    } catch (e: unknown) {
      setRows([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar aniversariantes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const next30 = useMemo(() => rows.filter((r) => r.daysLeft <= 30), [rows]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Aniversariantes</h1>
            <p className="mt-1 text-sm text-slate-600">
              Lista de aniversarios baseada nos colaboradores ativos com data de nascimento.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total com aniversario</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Proximos 30 dias</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{next30.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Hoje</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {rows.filter((r) => r.daysLeft === 0).length}
          </p>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{msg}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Proximos 30 dias</p>
        <div className="mt-4 space-y-3">
          {next30.length ? (
            next30.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{r.nome}</p>
                  <p className="text-sm text-slate-600">{r.cargo} - {r.departamento}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-3 py-1 font-semibold text-pink-700">
                    <Cake size={14} />
                    {r.nextDate.toLocaleDateString("pt-BR")}
                  </span>
                  <span className="text-slate-500">{r.daysLeft === 0 ? "Hoje" : `Em ${r.daysLeft} dia(s)`}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Nenhum aniversario nos proximos 30 dias.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Todos os aniversarios futuros</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Cargo</th>
                <th className="p-3">Departamento</th>
                <th className="p-3">Pr?xima data</th>
                <th className="p-3">Dias</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.nome}</td>
                    <td className="p-3">{r.cargo}</td>
                    <td className="p-3">{r.departamento}</td>
                    <td className="p-3">{r.nextDate.toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">{r.daysLeft}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={5}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
