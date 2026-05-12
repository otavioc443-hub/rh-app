"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, CreditCard, Eye, Pencil, Plus, Search, Trash2, Trophy, Upload, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";
import {
  BOLAO_DEFAULT_DEADLINE,
  BOLAO_DEFAULT_REGULATION,
  BOLAO_DEFAULT_TITLE,
  BOLAO_DEFAULT_VALUE,
  BOLAO_PLAYERS,
  BOLAO_POSITIONS,
  BOLAO_REQUIRED_PLAYERS,
  BOLAO_RULES,
  BOLAO_PAYMENT_STATUS_LABELS,
  countBolaoHits,
  formatBolaoCurrency,
  formatBolaoDateTime,
  getBolaoBetPlayers,
  isBolaoClosed,
  isBolaoPaid,
  type BolaoBet,
  type BolaoConfig,
  type BolaoManualPlayer,
} from "@/lib/bolaoCopa2026";

type ProfileLite = {
  full_name: string | null;
  email: string | null;
};

type CollaboratorLite = {
  nome: string | null;
  email: string | null;
  setor: string | null;
};

type ActiveView = "aposta" | "palpites";

function normalizeConfig(row: BolaoConfig | null): BolaoConfig {
  return {
    id: row?.id ?? "default",
    titulo: row?.titulo ?? BOLAO_DEFAULT_TITLE,
    valor: Number(row?.valor ?? BOLAO_DEFAULT_VALUE),
    regulamento: row?.regulamento ?? BOLAO_DEFAULT_REGULATION,
    prazo: row?.prazo ?? BOLAO_DEFAULT_DEADLINE,
    pix_link: row?.pix_link ?? "",
    qr_code_url: row?.qr_code_url ?? "",
    jogadores_convocados: row?.jogadores_convocados ?? null,
    resultado_confirmado_at: row?.resultado_confirmado_at ?? null,
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
    return "O bolão ainda não foi configurado no banco. Rode as migrations do bolão no Supabase.";
  }
  if (lower.includes("duplicate")) return "Já existe uma aposta registrada para este usuário.";
  return message;
}

function sectorLabel(value: string | null | undefined) {
  return value?.trim() || "Setor não informado";
}

export default function BolaoCopa2026Page() {
  const { loading: roleLoading, isRH } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [message, setMessage] = useState("");
  const [view, setView] = useState<ActiveView>("aposta");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [setor, setSetor] = useState<string | null>(null);
  const [config, setConfig] = useState<BolaoConfig>(() => normalizeConfig(null));
  const [existingBet, setExistingBet] = useState<BolaoBet | null>(null);
  const [allBets, setAllBets] = useState<BolaoBet[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualPlayers, setManualPlayers] = useState<BolaoManualPlayer[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualClub, setManualClub] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<"Todas" | (typeof BOLAO_POSITIONS)[number]>("Todas");
  const [showReview, setShowReview] = useState(false);

  const closed = useMemo(() => isBolaoClosed(config), [config]);
  const totalSelected = selectedIds.size + manualPlayers.length;
  const validTotal = totalSelected === BOLAO_REQUIRED_PLAYERS;
  const valorLabel = formatBolaoCurrency(config.valor);
  const deadlineLabel = formatBolaoDateTime(config.prazo);
  const hasResult = !!config.resultado_confirmado_at && !!config.jogadores_convocados?.length;
  const canViewTeamBets = !roleLoading && isRH;

  const rules = useMemo(() => {
    const custom = (config.regulamento ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
    return custom.length ? custom : BOLAO_RULES;
  }, [config.regulamento]);

  const positionCounts = useMemo(() => {
    return BOLAO_POSITIONS.map((position) => ({
      position,
      count: BOLAO_PLAYERS.filter((player) => player.position === position && selectedIds.has(player.id)).length,
    }));
  }, [selectedIds]);

  const visiblePositions = useMemo(() => {
    return positionFilter === "Todas" ? BOLAO_POSITIONS : BOLAO_POSITIONS.filter((position) => position === positionFilter);
  }, [positionFilter]);

  const normalizedPlayerSearch = playerSearch.trim().toLowerCase();
  const currentPlayerSelection = useMemo(() => selectedPayload(selectedIds), [selectedIds]);
  const reviewPlayers = useMemo(
    () => [
      ...currentPlayerSelection,
      ...manualPlayers.map((player) => ({
        id: player.id,
        nome: player.nome,
        clube: player.clube ?? "",
        posicao: "Manual" as const,
        manual: true,
      })),
    ],
    [currentPlayerSelection, manualPlayers],
  );

  const groupedBets = useMemo(() => {
    const groups = new Map<string, BolaoBet[]>();
    for (const bet of allBets) {
      const key = sectorLabel(bet.setor);
      groups.set(key, [...(groups.get(key) ?? []), bet]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [allBets]);

  const ranking = useMemo(() => {
    if (!hasResult) return [];
    return allBets
      .filter(isBolaoPaid)
      .map((bet) => ({ bet, hits: countBolaoHits(bet, config.jogadores_convocados) ?? 0 }))
      .sort((a, b) => b.hits - a.hits || (a.bet.nome ?? "").localeCompare(b.bet.nome ?? "", "pt-BR"));
  }, [allBets, config.jogadores_convocados, hasResult]);

  useEffect(() => {
    if (!canViewTeamBets && view === "palpites") setView("aposta");
  }, [canViewTeamBets, view]);

  const applyBetToForm = useCallback((bet: BolaoBet | null) => {
    if (!bet) {
      setSelectedIds(new Set());
      setManualPlayers([]);
      return;
    }
    setSelectedIds(new Set((bet.jogadores ?? []).map((player) => player.id)));
    setManualPlayers((bet.jogadores_manuais ?? []).map((player) => ({ ...player, manual: true })));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth.user;
      if (!user) throw new Error("Não autenticado.");
      setUserId(user.id);

      const [profileRes, configRes, betRes, allBetsRes] = await Promise.all([
        supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle<ProfileLite>(),
        supabase
          .from("pulsehub_bolao_config")
          .select("id,titulo,valor,regulamento,prazo,pix_link,qr_code_url,jogadores_convocados,resultado_confirmado_at,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<BolaoConfig>(),
        supabase
          .from("pulsehub_bolao_copa_2026")
          .select("id,user_id,nome,email,setor,payment_status,comprovante_url,comprovante_path,jogadores,jogadores_manuais,total_jogadores,status,created_at,updated_at")
          .eq("user_id", user.id)
          .maybeSingle<BolaoBet>(),
        supabase
          .from("pulsehub_bolao_copa_2026")
          .select("id,user_id,nome,email,setor,payment_status,comprovante_url,comprovante_path,jogadores,jogadores_manuais,total_jogadores,status,created_at,updated_at")
          .order("created_at", { ascending: true }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (configRes.error) throw configRes.error;
      if (betRes.error) throw betRes.error;
      if (allBetsRes.error) throw allBetsRes.error;

      const userEmail = profileRes.data?.email ?? user.email ?? "";
      const collaboratorRes = userEmail
        ? await supabase.from("colaboradores").select("nome,email,setor").eq("email", userEmail).maybeSingle<CollaboratorLite>()
        : { data: null, error: null };

      if (collaboratorRes.error) throw collaboratorRes.error;

      setProfile({
        full_name: collaboratorRes.data?.nome ?? profileRes.data?.full_name ?? user.user_metadata?.full_name ?? user.email ?? "Colaborador",
        email: userEmail,
      });
      setSetor(collaboratorRes.data?.setor ?? null);
      setConfig(normalizeConfig(configRes.data ?? null));
      setExistingBet(betRes.data ?? null);
      setAllBets((allBetsRes.data ?? []) as BolaoBet[]);
      applyBetToForm(betRes.data ?? null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao carregar bolão.";
      setMessage(schemaMessage(raw));
    } finally {
      setLoading(false);
    }
  }, [applyBetToForm]);

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

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        nome: profile?.full_name ?? "Colaborador",
        email: profile?.email ?? "",
        setor: setor ?? "Setor não informado",
        jogadores: currentPlayerSelection,
        jogadores_manuais: manualPlayers,
        total_jogadores: totalSelected,
        status: "enviado",
        payment_status: existingBet?.payment_status ?? "pendente",
      };

      const query = existingBet
        ? supabase.from("pulsehub_bolao_copa_2026").update(payload).eq("id", existingBet.id).eq("user_id", userId)
        : supabase.from("pulsehub_bolao_copa_2026").insert(payload);

      const { data, error } = await query
        .select("id,user_id,nome,email,setor,payment_status,comprovante_url,comprovante_path,jogadores,jogadores_manuais,total_jogadores,status,created_at,updated_at")
        .single<BolaoBet>();

      if (error) throw error;
      setExistingBet(data);
      setAllBets((prev) => {
        const others = prev.filter((item) => item.id !== data.id);
        return [...others, data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      setMessage(existingBet ? "Palpite atualizado com sucesso." : "Aposta registrada com sucesso.");
      setShowReview(false);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao registrar aposta.";
      setMessage(schemaMessage(raw));
    } finally {
      setSaving(false);
    }
  }

  async function uploadPaymentProof(file: File) {
    if (!existingBet) return;
    setUploadingProof(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      const form = new FormData();
      form.append("file", file);
      form.append("betId", existingBet.id);
      const res = await fetch("/api/pulsehub/bolao-copa-2026/payment-proof", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = (await res.json()) as { publicUrl?: string; path?: string; paymentStatus?: string; error?: string };
      if (!res.ok || !json.publicUrl) throw new Error(json.error || "Erro ao enviar comprovante.");
      setExistingBet((prev) =>
        prev
          ? {
              ...prev,
              comprovante_url: json.publicUrl ?? prev.comprovante_url,
              comprovante_path: json.path ?? prev.comprovante_path,
              payment_status: "aguardando_validacao",
            }
          : prev,
      );
      setAllBets((prev) =>
        prev.map((bet) =>
          bet.id === existingBet.id
            ? { ...bet, comprovante_url: json.publicUrl ?? bet.comprovante_url, comprovante_path: json.path ?? bet.comprovante_path, payment_status: "aguardando_validacao" }
            : bet,
        ),
      );
      setMessage("Comprovante enviado para validação do RH.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao enviar comprovante.");
    } finally {
      setUploadingProof(false);
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

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setView("aposta")}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${
                  view === "aposta" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                <Pencil size={16} /> Meu palpite
              </button>
              {canViewTeamBets ? (
                <button
                  type="button"
                  onClick={() => setView("palpites")}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${
                    view === "palpites" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <Eye size={16} /> Palpites e ranking
                </button>
              ) : null}
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

      {view === "aposta" || !canViewTeamBets ? (
        <>
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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <Check size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-emerald-950">Palpite registrado</h2>
                  <p className="text-sm text-emerald-800">
                    {closed
                      ? `Enviado em ${formatBolaoDateTime(existingBet.created_at)} com ${existingBet.total_jogadores} jogadores.`
                      : `Você pode editar este palpite até ${deadlineLabel}.`}
                  </p>
                </div>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  Pagamento: {BOLAO_PAYMENT_STATUS_LABELS[(existingBet.payment_status ?? "pendente") as keyof typeof BOLAO_PAYMENT_STATUS_LABELS] ?? "Pendente"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-emerald-100 pt-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                  <Upload size={16} /> {uploadingProof ? "Enviando..." : "Enviar comprovante Pix"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    disabled={uploadingProof}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPaymentProof(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {existingBet.comprovante_url ? (
                  <a href={existingBet.comprovante_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-800 hover:underline">
                    Ver comprovante enviado
                  </a>
                ) : (
                  <p className="text-sm text-emerald-800">Envie o comprovante para o RH validar sua participação.</p>
                )}
              </div>
            </section>
          ) : null}

          {!closed ? (
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

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={playerSearch}
                    onChange={(event) => setPlayerSearch(event.target.value)}
                    placeholder="Buscar por nome ou clube"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm"
                  />
                </label>
                <select
                  value={positionFilter}
                  onChange={(event) => setPositionFilter(event.target.value as "Todas" | (typeof BOLAO_POSITIONS)[number])}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
                >
                  <option value="Todas">Todas as posições</option>
                  {BOLAO_POSITIONS.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {positionCounts.map((item) => (
                  <div key={item.position} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">{item.position}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{item.count}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Manuais</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{manualPlayers.length}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {visiblePositions.map((position) => (
                  <div key={position} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-950">{position}</h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {BOLAO_PLAYERS.filter((player) => {
                        if (player.position !== position) return false;
                        if (!normalizedPlayerSearch) return true;
                        return `${player.name} ${player.club}`.toLowerCase().includes(normalizedPlayerSearch);
                      }).map((player) => (
                        <label
                          key={player.id}
                          className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm transition hover:border-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(player.id)}
                            onChange={() => togglePlayer(player.id)}
                            disabled={saving}
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
                    disabled={saving}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                  <input
                    value={manualClub}
                    onChange={(event) => setManualClub(event.target.value)}
                    placeholder="Clube opcional"
                    disabled={saving}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addManualPlayer}
                    disabled={!manualName.trim() || saving}
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
                  onClick={() => {
                    setMessage("");
                    if (!validTotal) {
                      setMessage("Sua lista precisa conter exatamente 26 jogadores para ser válida.");
                      return;
                    }
                    setShowReview(true);
                  }}
                  disabled={saving || !validTotal}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {existingBet ? "Revisar atualização" : "Revisar aposta"}
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Palpites por setor</h2>
              <p className="mt-1 text-sm text-slate-600">Todos os colaboradores conseguem acompanhar as listas enviadas.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              <Users size={16} /> {allBets.length} palpites
            </div>
          </div>

          {hasResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-semibold text-emerald-950">Ranking de acertos</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {ranking.slice(0, 12).map((item, index) => (
                  <div key={item.bet.id} className="rounded-2xl border border-emerald-100 bg-white p-3">
                    <p className="text-xs font-semibold text-emerald-700">#{index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{item.bet.nome}</p>
                    <p className="text-xs text-slate-500">{sectorLabel(item.bet.setor)}</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-800">{item.hits}/26 acertos</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              O ranking será exibido após o RH/Admin confirmar os jogadores convocados e validar os pagamentos.
            </div>
          )}

          <div className="space-y-4">
            {groupedBets.map(([sector, bets]) => (
              <div key={sector} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-950">{sector}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{bets.length} palpite(s)</span>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {bets.map((bet) => {
                    const hits = countBolaoHits(bet, config.jogadores_convocados);
                    const players = getBolaoBetPlayers(bet);
                    return (
                      <details key={bet.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
                          {bet.nome} <span className="font-normal text-slate-500">- {bet.total_jogadores} jogadores</span>
                          {hits !== null ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{hits}/26</span> : null}
                        </summary>
                        <p className="mt-1 text-xs text-slate-500">Enviado em {formatBolaoDateTime(bet.updated_at ?? bet.created_at)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {players.map((player) => (
                            <span key={player.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {player.nome}{player.clube ? ` - ${player.clube}` : ""}
                            </span>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            ))}
            {!groupedBets.length ? <p className="text-sm text-slate-500">Nenhum palpite enviado até agora.</p> : null}
          </div>
        </section>
      )}

      {message && view === "palpites" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message}</div>
      ) : null}

      {showReview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-semibold text-slate-950">Revisar palpite</h2>
              <p className="mt-1 text-sm text-slate-600">
                Confira os 26 nomes antes de {existingBet ? "atualizar" : "enviar"} sua aposta.
              </p>
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {reviewPlayers.map((player, index) => (
                  <div key={player.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">#{index + 1} · {player.posicao}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{player.nome}</p>
                    {player.clube ? <p className="text-xs text-slate-500">{player.clube}</p> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5">
              <p className={`text-sm font-semibold ${reviewPlayers.length === 26 ? "text-emerald-700" : "text-rose-700"}`}>
                Selecionados: {reviewPlayers.length}/26
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Voltar e editar
                </button>
                <button
                  type="button"
                  onClick={() => void submitBet()}
                  disabled={saving || reviewPlayers.length !== 26}
                  className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : existingBet ? "Confirmar atualização" : "Confirmar envio"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
