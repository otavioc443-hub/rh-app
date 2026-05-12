"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, CreditCard, Plus, Trash2, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  BOLAO_DEFAULT_DEADLINE,
  BOLAO_DEFAULT_REGULATION,
  BOLAO_DEFAULT_TITLE,
  BOLAO_DEFAULT_VALUE,
  BOLAO_PLAYERS,
  BOLAO_POSITIONS,
  BOLAO_REQUIRED_PLAYERS,
  BOLAO_RULES,
  type BolaoBet,
  type BolaoConfig,
  type BolaoManualPlayer,
  formatBolaoCurrency,
  formatBolaoDateTime,
  isBolaoClosed,
} from "@/lib/bolaoCopa2026";

type ProfileLite = {
  full_name: string | null;
  email: string | null;
};

function normalizeConfig(row: BolaoConfig | null): BolaoConfig {
  return {
    id: row?.id ?? "default",
    titulo: row?.titulo ?? BOLAO_DEFAULT_TITLE,
    valor: Number(row?.valor ?? BOLAO_DEFAULT_VALUE),
    regulamento: row?.regulamento ?? BOLAO_DEFAULT_REGULATION,
    prazo: row?.prazo ?? BOLAO_DEFAULT_DEADLINE,
    pix_link: row?.pix_link ?? "",
    qr_code_url: row?.qr_code_url ?? "",
    status: row?.status ?? "ativo",
    updated_at: row?.updated_at ?? null,
  };
}

function selectedPayload(ids: Set<string>) {
  return BOLAO_PLAYERS.filter((player) => ids.has(player.id)).map((player) => ({
    id: player.id,
    nome: player.name,
    clube: player.club,
    posicao: player.position,
  }));
}

function schemaMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find the table")) {
    return "O bolão ainda não foi configurado no banco. Rode a migration supabase/sql/2026-05-12_create_pulsehub_bolao_copa_2026.sql.";
  }
  return message;
}

export default function BolaoCopa2026Page() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [config, setConfig] = useState<BolaoConfig>(() => normalizeConfig(null));
  const [existingBet, setExistingBet] = useState<BolaoBet | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualPlayers, setManualPlayers] = useState<BolaoManualPlayer[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualClub, setManualClub] = useState("");

  const closed = useMemo(() => isBolaoClosed(config), [config]);
  const totalSelected = selectedIds.size + manualPlayers.length;
  const validTotal = totalSelected === BOLAO_REQUIRED_PLAYERS;
  const valorLabel = formatBolaoCurrency(config.valor);
  const deadlineLabel = formatBolaoDateTime(config.prazo);
  const rules = useMemo(() => {
    const custom = (config.regulamento ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
    return custom.length ? custom : BOLAO_RULES;
  }, [config.regulamento]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) throw new Error("Não autenticado.");
      setUserId(user.id);

      const [profileRes, configRes, betRes] = await Promise.all([
        supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle<ProfileLite>(),
        supabase
          .from("pulsehub_bolao_config")
          .select("id,titulo,valor,regulamento,prazo,pix_link,qr_code_url,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<BolaoConfig>(),
        supabase
          .from("pulsehub_bolao_copa_2026")
          .select("id,user_id,nome,email,jogadores,jogadores_manuais,total_jogadores,status,created_at")
          .eq("user_id", user.id)
          .maybeSingle<BolaoBet>(),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (configRes.error) throw configRes.error;
      if (betRes.error) throw betRes.error;

      setProfile({
        full_name: profileRes.data?.full_name ?? user.user_metadata?.full_name ?? user.email ?? "Colaborador",
        email: profileRes.data?.email ?? user.email ?? "",
      });
      setConfig(normalizeConfig(configRes.data ?? null));
      setExistingBet(betRes.data ?? null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao carregar bolão.";
      setMessage(schemaMessage(raw));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addManualPlayer() {
    const nome = manualName.trim();
    const clube = manualClub.trim();
    if (!nome) return;
    setManualPlayers((prev) => [
      ...prev,
      { id: `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`, nome, clube, manual: true },
    ]);
    setManualName("");
    setManualClub("");
  }

  async function submitBet() {
    setMessage("");
    if (closed) {
      setMessage("Prazo encerrado para envio das listas.");
      return;
    }
    if (!validTotal) {
      setMessage("Sua lista precisa conter exatamente 26 jogadores para ser válida.");
      return;
    }
    if (existingBet) {
      setMessage("Já existe uma aposta registrada para este usuário.");
      return;
    }

    setSaving(true);
    try {
      const payload = selectedPayload(selectedIds);
      const { data, error } = await supabase
        .from("pulsehub_bolao_copa_2026")
        .insert({
          user_id: userId,
          nome: profile?.full_name ?? "Colaborador",
          email: profile?.email ?? "",
          jogadores: payload,
          jogadores_manuais: manualPlayers,
          total_jogadores: totalSelected,
          status: "enviado",
        })
        .select("id,user_id,nome,email,jogadores,jogadores_manuais,total_jogadores,status,created_at")
        .single<BolaoBet>();
      if (error) throw error;
      setExistingBet(data);
      setMessage("Aposta registrada com sucesso.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao registrar aposta.";
      setMessage(schemaMessage(raw.includes("duplicate") ? "Já existe uma aposta registrada para este usuário." : raw));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Carregando bolão...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid gap-0 lg:grid-cols-[1.45fr_0.85fr]">
          <div className="p-6 lg:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <Trophy size={14} /> PulseHub
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{config.titulo ?? BOLAO_DEFAULT_TITLE}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Participe do bolão institucional e registre os 26 jogadores que você acredita que serão convocados para a Seleção Brasileira na Copa do Mundo de 2026.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Prazo de envio</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{deadlineLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Participação</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{valorLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Selecionados</p>
                <p className={`mt-1 text-sm font-semibold ${validTotal ? "text-emerald-700" : "text-slate-950"}`}>
                  Selecionados: {totalSelected}/{BOLAO_REQUIRED_PLAYERS}
                </p>
              </div>
            </div>
          </div>

          <aside className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 lg:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <CreditCard size={16} /> Pagamento Pix
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
              {config.qr_code_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.qr_code_url} alt="QR Code Pix" className="mx-auto aspect-square max-h-64 w-full object-contain" />
              ) : (
                <div className="grid aspect-square place-items-center rounded-xl bg-slate-100 px-4 text-center text-sm font-semibold text-slate-500">
                  QR Code Pix aguardando cadastro pelo RH.
                </div>
              )}
            </div>
            <a
              href={config.pix_link || undefined}
              target="_blank"
              rel="noreferrer"
              className={`mt-4 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold ${
                config.pix_link ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "pointer-events-none bg-white/10 text-white/55"
              }`}
            >
              Pagar {valorLabel} via Pix
            </a>
          </aside>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule, index) => (
          <div key={`${rule}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-slate-700">{rule}</p>
            </div>
          </div>
        ))}
      </section>

      {closed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Prazo encerrado para envio das listas.
        </div>
      ) : null}

      {existingBet ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Check size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-emerald-950">Aposta registrada</h2>
              <p className="text-sm text-emerald-800">
                Enviada em {formatBolaoDateTime(existingBet.created_at)} com {existingBet.total_jogadores} jogadores.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Sua lista de convocados</h2>
              <p className="mt-1 text-sm text-slate-600">Selecione jogadores da lista e inclua nomes manuais quando necessário.</p>
            </div>
            <div className={`rounded-full px-4 py-2 text-sm font-semibold ${validTotal ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
              Selecionados: {totalSelected}/{BOLAO_REQUIRED_PLAYERS}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {BOLAO_POSITIONS.map((position) => (
              <div key={position} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-950">{position}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {BOLAO_PLAYERS.filter((player) => player.position === position).map((player) => (
                    <label
                      key={player.id}
                      className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm transition hover:border-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(player.id)}
                        onChange={() => togglePlayer(player.id)}
                        disabled={closed || saving}
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-950">Jogador manual</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Nome do jogador"
                disabled={closed || saving}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
              <input
                value={manualClub}
                onChange={(event) => setManualClub(event.target.value)}
                placeholder="Clube opcional"
                disabled={closed || saving}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
              <button
                type="button"
                onClick={addManualPlayer}
                disabled={!manualName.trim() || closed || saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>

            {manualPlayers.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {manualPlayers.map((player) => (
                  <span key={player.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {player.nome}{player.clube ? ` - ${player.clube}` : ""}
                    <button type="button" onClick={() => setManualPlayers((prev) => prev.filter((item) => item.id !== player.id))} className="text-slate-500 hover:text-rose-600">
                      <Trash2 size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {message ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message}</div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock size={14} /> Prazo: {deadlineLabel}
            </div>
            <button
              type="button"
              onClick={() => void submitBet()}
              disabled={saving || closed || !validTotal}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Enviando..." : "Enviar aposta"}
            </button>
          </div>
        </section>
      )}

      {message && existingBet ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-semibold text-emerald-800">{message}</div>
      ) : null}
    </div>
  );
}
