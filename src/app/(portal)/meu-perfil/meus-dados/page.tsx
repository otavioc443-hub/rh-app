"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, RefreshCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [collaborator, setCollaborator] = useState<CollaboratorRow | null>(null);

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
        setMsg("Sessao invalida. Faca login novamente.");
        return;
      }

      setUserId(user.id);
      const md = (user.user_metadata ?? {}) as Record<string, unknown>;
      setAvatarUrl(resolvePortalAvatarUrl(String(md.avatar_url ?? md.picture ?? "")) ?? "");

      const colabRes = await supabase
        .from("colaboradores")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle<Record<string, unknown>>();

      if (colabRes.error) throw colabRes.error;
      setCollaborator(mapCollaboratorRow(colabRes.data ?? null));
    } catch (e: unknown) {
      setCollaborator(null);
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

      const publicUrl = resolvePortalAvatarUrl(json.publicUrl ?? "") ?? "";
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
        <p className="text-sm font-semibold text-slate-900">Solicitacoes centralizadas</p>
        <p className="mt-1 text-sm text-slate-600">
          As solicitacoes para RH, Financeiro e P&D foram movidas para um unico local.
        </p>
        <a
          href="/meu-perfil/chamados"
          className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Ir para Chamados
        </a>
      </div>
    </div>
  );
}
