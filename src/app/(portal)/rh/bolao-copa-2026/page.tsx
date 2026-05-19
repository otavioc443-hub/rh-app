"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Eye, ImageOff, RefreshCcw, Save, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import {
  BOLAO_DEFAULT_DEADLINE,
  BOLAO_DEFAULT_REGULATION,
  BOLAO_DEFAULT_TITLE,
  BOLAO_DEFAULT_VALUE,
  BOLAO_PAYMENT_STATUS_LABELS,
  BOLAO_PLAYERS,
  BOLAO_POSITIONS,
  type BolaoBet,
  type BolaoConfirmedPlayer,
  type BolaoConfig,
  type BolaoPaymentStatus,
  formatBolaoCurrency,
  formatBolaoDateTime,
  isBolaoPaid,
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

function betAllPlayers(bet: BolaoBet) {
  return [
    ...(bet.jogadores ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      clube: item.clube,
      origem: "Lista" as const,
    })),
    ...(bet.jogadores_manuais ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      clube: item.clube ?? "",
      origem: "Manual" as const,
    })),
  ];
}

function isPdfProof(url: string, path: string | null | undefined) {
  const source = (path || url).split("?")[0].toLowerCase();
  return source.endsWith(".pdf");
}

function sectorLabel(value: string | null | undefined) {
  return value?.trim() || "Setor não informado";
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
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [confirmedManualText, setConfirmedManualText] = useState("");
  const [resultadoConfirmadoAt, setResultadoConfirmadoAt] = useState<string | null>(null);
  const [bets, setBets] = useState<BolaoBet[]>([]);
  const [selectedBet, setSelectedBet] = useState<BolaoBet | null>(null);
  const [proofLoadingId, setProofLoadingId] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<{ bet: BolaoBet; url: string; path: string | null; isPdf: boolean } | null>(null);

  const paidBets = useMemo(() => bets.filter(isBolaoPaid), [bets]);
  const totalPrize = useMemo(() => paidBets.length * (Number(valor.replace(",", ".")) || BOLAO_DEFAULT_VALUE), [paidBets.length, valor]);

  const applyConfig = useCallback((row: BolaoConfig | null) => {
    setConfigId(row?.id ?? null);
    setTitulo(row?.titulo ?? BOLAO_DEFAULT_TITLE);
    setValor(String(Number(row?.valor ?? BOLAO_DEFAULT_VALUE)));
    setPrazo(toLocalInputValue(row?.prazo));
    setRegulamento(row?.regulamento ?? BOLAO_DEFAULT_REGULATION);
    setPixLink(row?.pix_link ?? "");
    setQrCodeUrl(row?.qr_code_url ?? "");
    setStatus(row?.status === "encerrado" ? "encerrado" : "ativo");
    const confirmed = row?.jogadores_convocados ?? [];
    setConfirmedIds(new Set(confirmed.filter((player) => !player.manual && player.id).map((player) => player.id)));
    setConfirmedManualText(confirmed.filter((player) => player.manual).map((player) => `${player.nome}${player.clube ? ` - ${player.clube}` : ""}`).join("\n"));
    setResultadoConfirmadoAt(row?.resultado_confirmado_at ?? null);
  }, []);

  const load = useCallback(async () => {
    if (!isRH) return;
    setLoading(true);
    setMessage("");
    try {
      const [configRes, betsRes] = await Promise.all([
        supabase
          .from("pulsehub_bolao_config")
          .select("id,titulo,valor,regulamento,prazo,pix_link,qr_code_url,jogadores_convocados,resultado_confirmado_at,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<BolaoConfig>(),
        supabase
          .from("pulsehub_bolao_copa_2026")
          .select("id,user_id,nome,email,setor,payment_status,comprovante_url,comprovante_path,jogadores,jogadores_manuais,total_jogadores,status,created_at,updated_at")
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

  function buildConfirmedPlayers(): BolaoConfirmedPlayer[] {
    const listed = BOLAO_PLAYERS.filter((player) => confirmedIds.has(player.id)).map((player) => ({
      id: player.id,
      nome: player.name,
      clube: player.club,
      posicao: player.position,
      manual: false,
    }));

    const manual = confirmedManualText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [nomeRaw, ...clubParts] = line.split(" - ");
        const nome = nomeRaw.trim();
        const clube = clubParts.join(" - ").trim();
        return {
          id: `convocado-manual-${index}-${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          nome,
          clube: clube || undefined,
          posicao: "Manual" as const,
          manual: true,
        };
      });

    return [...listed, ...manual];
  }

  function toggleConfirmedPlayer(id: string) {
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveConfig(nextQrCodeUrl = qrCodeUrl, confirmResult = false, statusOverride: "ativo" | "encerrado" = status) {
    setSaving(true);
    setMessage("");
    try {
      const jogadoresConvocados = buildConfirmedPlayers();
      const payload = {
        titulo: titulo.trim() || BOLAO_DEFAULT_TITLE,
        valor: Number(valor.replace(",", ".")) || BOLAO_DEFAULT_VALUE,
        prazo: localFortalezaToIso(prazo),
        regulamento,
        pix_link: pixLink.trim(),
        qr_code_url: nextQrCodeUrl.trim(),
        jogadores_convocados: jogadoresConvocados,
        resultado_confirmado_at: jogadoresConvocados.length
          ? confirmResult
            ? new Date().toISOString()
            : resultadoConfirmadoAt
          : null,
        status: statusOverride,
        updated_at: new Date().toISOString(),
      };
      const query = configId
        ? supabase.from("pulsehub_bolao_config").update(payload).eq("id", configId)
        : supabase.from("pulsehub_bolao_config").insert(payload);
      const { data, error } = await query
        .select("id,titulo,valor,regulamento,prazo,pix_link,qr_code_url,jogadores_convocados,resultado_confirmado_at,status,updated_at")
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

  async function togglePulseHubCardVisibility() {
    const nextStatus = status === "ativo" ? "encerrado" : "ativo";
    setStatus(nextStatus);
    await saveConfig(qrCodeUrl, false, nextStatus);
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

  async function updatePaymentStatus(betId: string, paymentStatus: BolaoPaymentStatus) {
    setMessage("");
    try {
      const { error } = await supabase
        .from("pulsehub_bolao_copa_2026")
        .update({ payment_status: paymentStatus })
        .eq("id", betId);
      if (error) throw error;
      setBets((prev) => prev.map((bet) => (bet.id === betId ? { ...bet, payment_status: paymentStatus } : bet)));
      setMessage("Status de pagamento atualizado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao atualizar pagamento.");
    }
  }

  async function openPaymentProof(bet: BolaoBet) {
    setMessage("");
    setProofLoadingId(bet.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/pulsehub/bolao-copa-2026/payment-proof?betId=${encodeURIComponent(bet.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      const json = (await res.json()) as { url?: string; path?: string | null; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Erro ao abrir comprovante.");
      setProofPreview({
        bet,
        url: json.url,
        path: json.path ?? bet.comprovante_path ?? null,
        isPdf: isPdfProof(json.url, json.path ?? bet.comprovante_path),
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao abrir comprovante.");
    } finally {
      setProofLoadingId(null);
    }
  }

  function exportCsv() {
    const rows = [
      ["Nome", "E-mail", "Setor", "Pagamento", "Data/hora de envio", "Quantidade", "Lista enviada", "Jogadores manuais", "Status"],
      ...bets.map((bet) => [
        bet.nome ?? "",
        bet.email ?? "",
        sectorLabel(bet.setor),
        BOLAO_PAYMENT_STATUS_LABELS[(bet.payment_status ?? "pendente") as BolaoPaymentStatus],
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
        <td>${sectorLabel(bet.setor)}</td>
        <td>${BOLAO_PAYMENT_STATUS_LABELS[(bet.payment_status ?? "pendente") as BolaoPaymentStatus]}</td>
        <td>${formatBolaoDateTime(bet.created_at)}</td>
        <td>${bet.total_jogadores}</td>
        <td>${betPlayersText(bet)}</td>
        <td>${manualPlayersText(bet)}</td>
        <td>${bet.status ?? ""}</td>
      </tr>
    `).join("");
    const html = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Setor</th><th>Pagamento</th><th>Data/hora de envio</th><th>Quantidade</th><th>Lista enviada</th><th>Jogadores manuais</th><th>Status</th></tr></thead><tbody>${htmlRows}</tbody></table>`;
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void togglePulseHubCardVisibility()}
              disabled={saving}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                status === "ativo"
                  ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              {status === "ativo" ? "Ocultar no PulseHub" : "Exibir no PulseHub"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw size={16} /> Atualizar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Apostas enviadas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{bets.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Pagamentos confirmados</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{paidBets.length}</p>
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Convocados oficiais e ranking</h2>
            <p className="mt-1 text-sm text-slate-600">
              Após o prazo, marque os jogadores convocados de fato. O ranking público será calculado automaticamente.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {buildConfirmedPlayers().length}/26 confirmados
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {BOLAO_POSITIONS.map((position) => (
            <div key={position} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">{position}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {BOLAO_PLAYERS.filter((player) => player.position === position).map((player) => (
                  <label key={player.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmedIds.has(player.id)}
                      onChange={() => toggleConfirmedPlayer(player.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{player.name}</span>
                      <span className="text-xs text-slate-500">{player.club}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="mt-4 grid gap-1 text-xs font-semibold text-slate-700">
          Convocados fora da lista
          <textarea
            value={confirmedManualText}
            onChange={(event) => setConfirmedManualText(event.target.value)}
            placeholder={"Um jogador por linha. Ex.: Nome - Clube"}
            className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm font-normal leading-6"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {resultadoConfirmadoAt ? `Resultado confirmado em ${formatBolaoDateTime(resultadoConfirmadoAt)}.` : "Resultado ainda não confirmado."}
          </p>
          <button
            type="button"
            onClick={() => {
              setResultadoConfirmadoAt(new Date().toISOString());
              void saveConfig(qrCodeUrl, true);
            }}
            disabled={saving || buildConfirmedPlayers().length !== 26}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} /> Confirmar convocados
          </button>
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

        <div className="mt-4 rounded-2xl border border-slate-200">
          <table className="w-full table-fixed text-left text-xs md:text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[6%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-3 md:px-3">Nome</th>
                <th className="px-2 py-3 md:px-3">E-mail</th>
                <th className="px-2 py-3 md:px-3">Setor</th>
                <th className="px-2 py-3 md:px-3">Pagamento</th>
                <th className="px-2 py-3 md:px-3">Comprov.</th>
                <th className="px-2 py-3 md:px-3">Envio</th>
                <th className="px-2 py-3 md:px-3">Qtd.</th>
                <th className="px-2 py-3 md:px-3">Lista enviada</th>
                <th className="px-2 py-3 md:px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bets.map((bet) => (
                <tr key={bet.id} className="align-top">
                  <td className="break-words px-2 py-3 font-semibold text-slate-900 md:px-3">{bet.nome}</td>
                  <td className="break-words px-2 py-3 text-slate-600 md:px-3">{bet.email}</td>
                  <td className="break-words px-2 py-3 text-slate-600 md:px-3">{sectorLabel(bet.setor)}</td>
                  <td className="px-2 py-3 md:px-3">
                    <select
                      value={bet.payment_status ?? "pendente"}
                      onChange={(event) => void updatePaymentStatus(bet.id, event.target.value as BolaoPaymentStatus)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                    >
                      {Object.entries(BOLAO_PAYMENT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3 md:px-3">
                    {bet.comprovante_url || bet.comprovante_path ? (
                      <button
                        type="button"
                        onClick={() => void openPaymentProof(bet)}
                        disabled={proofLoadingId === bet.id}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        <Eye size={14} />
                        {proofLoadingId === bet.id ? "Abrindo..." : "Visualizar"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Pendente</span>
                    )}
                  </td>
                  <td className="break-words px-2 py-3 text-slate-600 md:px-3">{formatBolaoDateTime(bet.created_at)}</td>
                  <td className="px-2 py-3 font-semibold text-slate-900 md:px-3">{bet.total_jogadores}</td>
                  <td className="px-2 py-3 md:px-3">
                    <button
                      type="button"
                      onClick={() => setSelectedBet(bet)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Eye size={14} />
                      Ver lista
                    </button>
                    {(bet.jogadores_manuais ?? []).length ? (
                      <p className="mt-1 text-center text-[11px] font-semibold text-amber-700">
                        +{(bet.jogadores_manuais ?? []).length} manual
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 md:px-3">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 md:px-3 md:text-xs">{bet.status}</span>
                  </td>
                </tr>
              ))}
              {!bets.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma aposta enviada até agora.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {proofPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Comprovante de pagamento</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{proofPreview.bet.nome ?? "Colaborador"}</h3>
                <p className="text-sm text-slate-600">{proofPreview.bet.email ?? "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={proofPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink size={16} />
                  Abrir em nova aba
                </a>
                <button
                  type="button"
                  onClick={() => setProofPreview(null)}
                  className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                  aria-label="Fechar comprovante"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto bg-slate-100 p-4">
              {proofPreview.isPdf ? (
                <iframe
                  src={proofPreview.url}
                  title="Comprovante de pagamento"
                  className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="flex justify-center">
                  <img
                    src={proofPreview.url}
                    alt="Comprovante de pagamento"
                    className="max-h-[70vh] max-w-full rounded-2xl border border-slate-200 bg-white object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedBet ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Lista enviada</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{selectedBet.nome ?? "Colaborador"}</h3>
                <p className="text-sm text-slate-600">
                  {selectedBet.email ?? "-"} | {selectedBet.total_jogadores} jogadores
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBet(null)}
                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                aria-label="Fechar lista enviada"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {betAllPlayers(selectedBet).map((player, index) => (
                  <div key={`${player.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {index + 1}. {player.nome}
                        </p>
                        <p className="text-xs text-slate-600">{player.clube || "Clube não informado"}</p>
                      </div>
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[11px] font-semibold",
                          player.origem === "Manual" ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700",
                        ].join(" ")}
                      >
                        {player.origem}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
