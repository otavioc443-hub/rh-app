"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ImageOff, RefreshCcw, Save, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import {
  BOLAO_DEFAULT_DEADLINE,
  BOLAO_DEFAULT_REGULATION,
  BOLAO_DEFAULT_TITLE,
  BOLAO_DEFAULT_VALUE,
  type BolaoBet,
  type BolaoConfig,
  formatBolaoCurrency,
  formatBolaoDateTime,
} from "@/lib/bolaoCopa2026";

function toLocalInputValue(value: string | null | undefined) {
  const date = new Date(value || BOLAO_DEFAULT_DEADLINE);
  if (Number.isNaN(date.getTime())) return "2026-05-17T23:59";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(" ", "T");
}

function localFortalezaToIso(value: string) {
  if (!value) return BOLAO_DEFAULT_DEADLINE;
  const local = new Date(`${value}:00-03:00`);
  return local.toISOString();
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function betPlayersText(bet: BolaoBet) {
  return (bet.jogadores ?? []).map((item) => `${item.nome} - ${item.clube}`).join("; ");
}

function manualPlayersText(bet: BolaoBet) {
  return (bet.jogadores_manuais ?? []).map((item) => `${item.nome}${item.clube ? ` - ${item.clube}` : ""}`).join("; ");
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function schemaMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find the table")) {
    return "O bolão ainda não foi configurado no banco. Rode a migration supabase/sql/2026-05-12_create_pulsehub_bolao_copa_2026.sql.";
  }
  return message;
}

export default function RhBolaoCopa2026Page() {
  const { loading: roleLoading, isRH, error: roleError } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [configId, setConfigId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(BOLAO_DEFAULT_TITLE);
  const [valor, setValor] = useState(String(BOLAO_DEFAULT_VALUE));
  const [prazo, setPrazo] = useState("2026-05-17T23:59");
  const [regulamento, setRegulamento] = useState(BOLAO_DEFAULT_REGULATION);
  const [pixLink, setPixLink] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [status, setStatus] = useState<"ativo" | "encerrado">("ativo");
  const [bets, setBets] = useState<BolaoBet[]>([]);

  const totalPrize = useMemo(() => bets.length * (Number(valor.replace(",", ".")) || BOLAO_DEFAULT_VALUE), [bets.length, valor]);

  const applyConfig = useCallback((row: BolaoConfig | null) => {
    setConfigId(row?.id ?? null);
    setTitulo(row?.titulo ?? BOLAO_DEFAULT_TITLE);
    setValor(String(Number(row?.valor ?? BOLAO_DEFAULT_VALUE)));
    setPrazo(toLocalInputValue(row?.prazo));
    setRegulamento(row?.regulamento ?? BOLAO_DEFAULT_REGULATION);
    setPixLink(row?.pix_link ?? "");
    setQrCodeUrl(row?.qr_code_url ?? "");
    setStatus(row?.status === "encerrado" ? "encerrado" : "ativo");
  }, []);

  const load = useCallback(async () => {
    if (!isRH) return;
    setLoading(true);
    setMessage("");
    try {
      const [configRes, betsRes] = await Promise.all([
        supabase
          .from("pulsehub_bolao_config")
          .select("id,titulo,valor,regulamento,prazo,pix_link,qr_code_url,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<BolaoConfig>(),
        supabase
          .from("pulsehub_bolao_copa_2026")
          .select("id,user_id,nome,email,jogadores,jogadores_manuais,total_jogadores,status,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (configRes.error) throw configRes.error;
      if (betsRes.error) throw betsRes.error;
      applyConfig(configRes.data ?? null);
      setBets((betsRes.data ?? []) as BolaoBet[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao carregar bolão.";
      setMessage(schemaMessage(raw));
    } finally {
      setLoading(false);
    }
  }, [applyConfig, isRH]);

  useEffect(() => {
    if (!roleLoading) void load();
  }, [load, roleLoading]);

  async function saveConfig(nextQrCodeUrl = qrCodeUrl) {
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        titulo: titulo.trim() || BOLAO_DEFAULT_TITLE,
        valor: Number(valor.replace(",", ".")) || BOLAO_DEFAULT_VALUE,
        prazo: localFortalezaToIso(prazo),
        regulamento,
        pix_link: pixLink.trim(),
        qr_code_url: nextQrCodeUrl.trim(),
        status,
        updated_at: new Date().toISOString(),
      };
      const query = configId
        ? supabase.from("pulsehub_bolao_config").update(payload).eq("id", configId)
        : supabase.from("pulsehub_bolao_config").insert(payload);
      const { data, error } = await query
        .select("id,titulo,valor,regulamento,prazo,pix_link,qr_code_url,status,updated_at")
        .single<BolaoConfig>();
      if (error) throw error;
      applyConfig(data);
      setMessage("Configurações salvas.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao salvar configurações.";
      setMessage(schemaMessage(raw));
    } finally {
      setSaving(false);
    }
  }

  async function uploadQrCode(file: File) {
    setUploading(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pulsehub/bolao-copa-2026/qr-code", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = (await res.json()) as { publicUrl?: string; error?: string };
      if (!res.ok || !json.publicUrl) throw new Error(json.error || "Erro ao enviar QR Code.");
      setQrCodeUrl(json.publicUrl);
      await saveConfig(json.publicUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao enviar QR Code.");
    } finally {
      setUploading(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Nome", "E-mail", "Data/hora de envio", "Quantidade", "Lista enviada", "Jogadores manuais", "Status"],
      ...bets.map((bet) => [
        bet.nome ?? "",
        bet.email ?? "",
        formatBolaoDateTime(bet.created_at),
        String(bet.total_jogadores),
        betPlayersText(bet),
        manualPlayersText(bet),
        bet.status ?? "",
      ]),
    ];
    downloadBlob("bolao-copa-2026-apostas.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const htmlRows = bets.map((bet) => `
      <tr>
        <td>${bet.nome ?? ""}</td>
        <td>${bet.email ?? ""}</td>
        <td>${formatBolaoDateTime(bet.created_at)}</td>
        <td>${bet.total_jogadores}</td>
        <td>${betPlayersText(bet)}</td>
        <td>${manualPlayersText(bet)}</td>
        <td>${bet.status ?? ""}</td>
      </tr>
    `).join("");
    const html = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Data/hora de envio</th><th>Quantidade</th><th>Lista enviada</th><th>Jogadores manuais</th><th>Status</th></tr></thead><tbody>${htmlRows}</tbody></table>`;
    downloadBlob("bolao-copa-2026-apostas.xls", html, "application/vnd.ms-excel;charset=utf-8");
  }

  if (roleLoading || loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando gestão do bolão...</div>;
  }

  if (!isRH) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-900">
        {roleError || "Acesso restrito a RH/Admin."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Bolão Copa do Mundo 2026</h1>
            <p className="mt-1 text-sm text-slate-600">Configurações, Pix e acompanhamento das apostas do PulseHub.</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={16} /> Atualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Apostas enviadas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{bets.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Valor estimado</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{formatBolaoCurrency(totalPrize)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Prazo</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{formatBolaoDateTime(localFortalezaToIso(prazo))}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Configurações do bolão</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Título do bolão
              <input value={titulo} onChange={(event) => setTitulo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Valor da aposta
              <input value={valor} onChange={(event) => setValor(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Data limite
              <input type="datetime-local" value={prazo} onChange={(event) => setPrazo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as "ativo" | "encerrado")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal">
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
              Link Pix
              <input value={pixLink} onChange={(event) => setPixLink(event.target.value)} placeholder="https://..." className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
              Regulamento
              <textarea value={regulamento} onChange={(event) => setRegulamento(event.target.value)} className="min-h-40 rounded-xl border border-slate-200 p-3 text-sm font-normal leading-6" />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => void saveConfig()} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              <Save size={16} /> {saving ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">QR Code Pix</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodeUrl} alt="Preview do QR Code Pix" className="mx-auto aspect-square max-h-80 w-full object-contain" />
            ) : (
              <div className="grid aspect-square place-items-center text-center text-sm font-semibold text-slate-500">
                <ImageOff size={32} className="mb-2" /> Nenhum QR Code cadastrado.
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload size={16} /> {uploading ? "Enviando..." : "Substituir QR Code"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadQrCode(file);
                event.currentTarget.value = "";
              }} />
            </label>
            <button type="button" onClick={() => { setQrCodeUrl(""); void saveConfig(""); }} className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
              <Trash2 size={16} /> Remover
            </button>
          </div>
        </div>
      </section>

      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Gestão das apostas</h2>
            <p className="mt-1 text-sm text-slate-600">Lista administrativa com exportação CSV/Excel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              <Download size={16} /> CSV
            </button>
            <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Envio</th>
                <th className="px-4 py-3">Qtd.</th>
                <th className="px-4 py-3">Lista enviada</th>
                <th className="px-4 py-3">Manuais</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bets.map((bet) => (
                <tr key={bet.id} className="align-top">
                  <td className="px-4 py-3 font-semibold text-slate-900">{bet.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{bet.email}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBolaoDateTime(bet.created_at)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{bet.total_jogadores}</td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{betPlayersText(bet)}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{manualPlayersText(bet) || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{bet.status}</span>
                  </td>
                </tr>
              ))}
              {!bets.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma aposta enviada até agora.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
