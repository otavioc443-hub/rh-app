"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type CollaboratorRow = {
  id: string;
  nome: string | null;
  email: string | null;
  cpf: string | null;
  telefone: string | null;
  celular: string | null;
  cargo: string | null;
  tipo_contrato: string | null;
  data_admissao: string | null;
  salario: number | null;
  superior_direto: string | null;
  banco: string | null;
  bank_name: string | null;
  agencia: string | null;
  agency: string | null;
  conta_corrente: string | null;
  account: string | null;
  pix_key_type: string | null;
  pix_key: string | null;
  pix_bank: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  departamento: string | null;
  setor: string | null;
  empresa: string | null;
};

type ProfileRequestRow = {
  id: string;
  request_type: "financial" | "personal" | "contractual" | "avatar" | "other";
  title: string;
  details: string;
  status: "pending" | "in_review" | "approved" | "rejected" | "implemented" | "cancelled";
  review_notes: string | null;
  created_at: string;
};

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("pt-BR");
}

function requestTypeLabel(t: ProfileRequestRow["request_type"]) {
  if (t === "financial") return "Financeiro";
  if (t === "personal") return "Pessoal";
  if (t === "contractual") return "Contratual";
  if (t === "avatar") return "Foto";
  return "Outro";
}

function statusLabel(status: ProfileRequestRow["status"]) {
  if (status === "pending") return "Pendente";
  if (status === "in_review") return "Em analise";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "implemented") return "Implementada";
  return "Cancelada";
}

function statusClass(status: ProfileRequestRow["status"]) {
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "in_review") return "bg-sky-50 text-sky-700";
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "implemented") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function strOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapCollaboratorRow(raw: Record<string, unknown> | null): CollaboratorRow | null {
  if (!raw) return null;
  return {
    id: strOrNull(raw.id) ?? "",
    nome: strOrNull(raw.nome),
    email: strOrNull(raw.email),
    cpf: strOrNull(raw.cpf),
    telefone: strOrNull(raw.telefone),
    celular: strOrNull(raw.celular),
    cargo: strOrNull(raw.cargo),
    tipo_contrato: strOrNull(raw.tipo_contrato),
    data_admissao: strOrNull(raw.data_admissao),
    salario: numOrNull(raw.salario),
    superior_direto: strOrNull(raw.superior_direto),
    banco: strOrNull(raw.banco),
    bank_name: strOrNull(raw.bank_name),
    agencia: strOrNull(raw.agencia),
    agency: strOrNull(raw.agency),
    conta_corrente: strOrNull(raw.conta_corrente),
    account: strOrNull(raw.account),
    pix_key_type: strOrNull(raw.pix_key_type),
    pix_key: strOrNull(raw.pix_key),
    pix_bank: strOrNull(raw.pix_bank),
    cep: strOrNull(raw.cep),
    logradouro: strOrNull(raw.logradouro),
    numero: strOrNull(raw.numero),
    complemento: strOrNull(raw.complemento),
    bairro: strOrNull(raw.bairro),
    cidade: strOrNull(raw.cidade),
    departamento: strOrNull(raw.departamento),
    setor: strOrNull(raw.setor),
    empresa: strOrNull(raw.empresa),
  };
}

export default function MeusDadosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [collaborator, setCollaborator] = useState<CollaboratorRow | null>(null);
  const [requests, setRequests] = useState<ProfileRequestRow[]>([]);

  const [requestType, setRequestType] = useState<ProfileRequestRow["request_type"]>("financial");
  const [fieldName, setFieldName] = useState("");
  const [details, setDetails] = useState("");

  const fullAddress = useMemo(() => {
    if (!collaborator) return "-";
    const parts = [
      collaborator.logradouro,
      collaborator.numero,
      collaborator.complemento,
      collaborator.bairro,
      collaborator.cidade,
      collaborator.cep,
    ]
      .map((v) => (v ?? "").trim())
      .filter(Boolean);
    return parts.length ? parts.join(" - ") : "-";
  }, [collaborator]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData.user;
      if (!user) {
        setUserId(null);
        setCollaborator(null);
        setRequests([]);
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      setUserId(user.id);
      const md = (user.user_metadata ?? {}) as Record<string, unknown>;
      setAvatarUrl(String(md.avatar_url ?? md.picture ?? ""));

      const [colabRes, reqRes] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle<Record<string, unknown>>(),
        supabase
          .from("profile_update_requests")
          .select("id,request_type,title,details,status,review_notes,created_at")
          .eq("requester_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (colabRes.error) throw colabRes.error;
      setCollaborator(mapCollaboratorRow(colabRes.data ?? null));

      if (reqRes.error) {
        const text = reqRes.error.message.toLowerCase();
        if (text.includes("does not exist") || text.includes("relation") || text.includes("schema cache")) {
          setRequests([]);
          setMsg(
            "Modulo de solicitacao de adequacao ainda nao disponivel. Rode supabase/sql/2026-02-16_create_profile_update_requests.sql."
          );
        } else {
          throw reqRes.error;
        }
      } else {
        setRequests((reqRes.data ?? []) as ProfileRequestRow[]);
      }
    } catch (e: unknown) {
      setCollaborator(null);
      setRequests([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar meus dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function uploadAvatar(file: File) {
    setMsg("");
    if (!userId) {
      setMsg("Sessao invalida. Faca login novamente.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMsg("Envie uma imagem (PNG/JPG/WEBP).");
      return;
    }

    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMsg("Imagem muito grande. Limite de 3MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/me/avatar/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = (await res.json()) as { publicUrl?: string; error?: string };
      if (!res.ok || !json.publicUrl) {
        throw new Error(json.error || `Falha no upload (status ${res.status})`);
      }

      const publicUrl = json.publicUrl;
      const { error: updateErr } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl,
        },
      });
      if (updateErr) throw updateErr;

      setAvatarUrl(publicUrl);
      setMsg("Foto do perfil atualizada.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("portal-profile-updated"));
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao atualizar foto.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function submitRequest() {
    setMsg("");
    if (!userId) {
      setMsg("Sessao invalida. Faca login novamente.");
      return;
    }
    if (!details.trim()) {
      setMsg("Descreva o ajuste solicitado.");
      return;
    }

    setSaving(true);
    try {
      const title = fieldName.trim()
        ? `Adequacao de ${fieldName.trim()}`
        : `Solicitacao ${requestTypeLabel(requestType).toLowerCase()}`;

      const payload = {
        requester_user_id: userId,
        collaborator_id: collaborator?.id ?? null,
        request_type: requestType,
        title,
        details: details.trim(),
        requested_changes: {
          field: fieldName.trim() || null,
          assigned_area: requestType === "financial" ? "financeiro" : "rh",
        },
      };

      const { error } = await supabase.from("profile_update_requests").insert(payload);
      if (error) throw error;

      setFieldName("");
      setDetails("");
      setMsg("Solicitacao registrada com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao registrar solicitacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Meus dados</h1>
            <p className="mt-1 text-sm text-slate-600">
              Consulte seus dados atuais e solicite adequacao de informacoes financeiras, pessoais e contratuais.
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Foto do perfil</p>
          <div className="mt-4 flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Foto do perfil" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {(collaborator?.nome ?? "U").trim().charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <div className="flex-1">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                <Camera size={16} />
                {uploadingPhoto ? "Enviando..." : "Alterar foto"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Dados pessoais e contratuais</p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p><b>Nome:</b> {collaborator?.nome?.trim() || "-"}</p>
            <p><b>Email:</b> {collaborator?.email?.trim() || "-"}</p>
            <p><b>CPF:</b> {collaborator?.cpf?.trim() || "-"}</p>
            <p><b>Telefone:</b> {collaborator?.telefone?.trim() || collaborator?.celular?.trim() || "-"}</p>
            <p><b>Cargo:</b> {collaborator?.cargo?.trim() || "-"}</p>
            <p><b>Tipo de contrato:</b> {collaborator?.tipo_contrato?.trim() || "-"}</p>
            <p><b>Data de admissao:</b> {formatDate(collaborator?.data_admissao)}</p>
            <p><b>Salario:</b> {formatCurrency(collaborator?.salario ?? null)}</p>
            <p><b>Gestor direto:</b> {collaborator?.superior_direto?.trim() || "-"}</p>
            <p><b>Lotacao:</b> {[collaborator?.empresa, collaborator?.departamento, collaborator?.setor].map((v) => (v ?? "").trim()).filter(Boolean).join(" - ") || "-"}</p>
            <p className="md:col-span-2"><b>Endereco:</b> {fullAddress}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Dados financeiros atuais</p>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-3">
          <p><b>Banco:</b> {(collaborator?.banco ?? collaborator?.bank_name ?? "").trim() || "-"}</p>
          <p><b>Agencia:</b> {(collaborator?.agencia ?? collaborator?.agency ?? "").trim() || "-"}</p>
          <p><b>Conta:</b> {(collaborator?.conta_corrente ?? collaborator?.account ?? "").trim() || "-"}</p>
          <p><b>Chave PIX:</b> {(collaborator?.pix_key ?? "").trim() || "-"}</p>
          <p><b>Tipo PIX:</b> {(collaborator?.pix_key_type ?? "").trim() || "-"}</p>
          <p><b>Banco PIX:</b> {(collaborator?.pix_bank ?? "").trim() || "-"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Solicitar adequacao de dados</p>
        <p className="mt-1 text-sm text-slate-600">
          Use este formulario para ajustes financeiros, pessoais, contratuais ou outros dados.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Tipo de solicitacao
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as ProfileRequestRow["request_type"])}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="financial">Financeiro</option>
              <option value="personal">Pessoal</option>
              <option value="contractual">Contratual</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Campo a ajustar
            <input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              placeholder="Ex.: banco, salario, endereco, cargo"
            />
          </label>
        </div>

        <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-700">
          Descricao da solicitacao
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="min-h-[96px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
            placeholder="Explique o ajuste solicitado e o motivo."
          />
        </label>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => void submitRequest()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Enviando..." : "Enviar solicitacao"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Minhas solicitacoes</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[880px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Tipo</th>
                <th className="p-3">Titulo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Descricao</th>
                <th className="p-3">Retorno RH/Financeiro</th>
                <th className="p-3">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-3 text-slate-500">Carregando...</td>
                </tr>
              ) : requests.length ? (
                requests.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{requestTypeLabel(r.request_type)}</td>
                    <td className="p-3">{r.title}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="p-3">{r.details}</td>
                    <td className="p-3">{r.review_notes ?? "-"}</td>
                    <td className="p-3">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-3 text-slate-500">Nenhuma solicitacao registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
