"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, RefreshCcw, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type RequestType = "financial" | "personal" | "contractual" | "avatar" | "other";
type RequestStatus = "pending" | "in_review" | "approved" | "rejected" | "implemented" | "cancelled";
type PdTicketType = "solidarvt" | "solides" | "server_access" | "equipment" | "system_improvement" | "other";
type PdTicketPriority = "low" | "medium" | "high" | "critical";
type PdTicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "cancelled";
type DestinationArea = "rh" | "financeiro" | "pd";
type RhReason = "registration_update" | "vacation_leave" | "benefits" | "documents" | "policy_question" | "other_rh";
type FinancialReason =
  | "payment_delay"
  | "bank_account_change"
  | "pix_key_change"
  | "reimbursement"
  | "invoice_issue"
  | "other_financial";

type UploadResult = {
  signedUrl: string;
  path: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type ProfileRequestRow = {
  id: string;
  request_type: RequestType;
  title: string;
  details: string;
  requested_changes: Record<string, unknown> | null;
  status: RequestStatus;
  created_at: string;
};

type PdTicketRow = {
  id: string;
  request_type: PdTicketType;
  priority: PdTicketPriority;
  title: string;
  description: string;
  status: PdTicketStatus;
  created_at: string;
};

type UnifiedTicket = {
  id: string;
  source: "profile_update" | "pd_ticket";
  area: string;
  type: string;
  title: string;
  description: string;
  statusLabel: string;
  statusClass: string;
  createdAt: string;
  attachmentPath: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
};

function parseLegacyAttachment(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { path: null, url: null };
  if (/^https?:\/\//i.test(trimmed)) return { path: null, url: trimmed };
  return { path: trimmed, url: null };
}

const OTHER_TITLE_VALUE = "__other__";

function requestTypeLabel(value: RequestType) {
  if (value === "financial") return "Financeiro";
  if (value === "personal") return "Pessoal";
  if (value === "contractual") return "Contratual";
  if (value === "avatar") return "Foto";
  return "Outro";
}

function requestStatusLabel(status: RequestStatus) {
  if (status === "pending") return "Pendente";
  if (status === "in_review") return "Em analise";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Recusada";
  if (status === "implemented") return "Implementada";
  return "Cancelada";
}

function requestStatusClass(status: RequestStatus) {
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "in_review") return "bg-sky-50 text-sky-700";
  if (status === "approved" || status === "implemented") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function pdTypeLabel(value: PdTicketType) {
  if (value === "server_access") return "TI - Acessos e infraestrutura";
  if (value === "system_improvement") return "Sistemas internos";
  if (value === "equipment") return "Equipamentos (computador e perifericos)";
  if (value === "solidarvt" || value === "solides") return "Sistemas internos";
  return "Outros de TI";
}

function pdStatusLabel(value: PdTicketStatus) {
  if (value === "open") return "Aberto";
  if (value === "in_progress") return "Em andamento";
  if (value === "waiting_user") return "Aguardando usuario";
  if (value === "resolved") return "Resolvido";
  return "Cancelado";
}

function pdStatusClass(value: PdTicketStatus) {
  if (value === "open") return "bg-amber-50 text-amber-700";
  if (value === "in_progress") return "bg-sky-50 text-sky-700";
  if (value === "waiting_user") return "bg-violet-50 text-violet-700";
  if (value === "resolved") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function destinationLabel(value: DestinationArea) {
  if (value === "rh") return "RH";
  if (value === "financeiro") return "Financeiro";
  return "P&D";
}

function rhReasonLabel(value: RhReason) {
  if (value === "registration_update") return "Atualizacao cadastral";
  if (value === "vacation_leave") return "Ferias e licencas";
  if (value === "benefits") return "Beneficios";
  if (value === "documents") return "Documentos RH";
  if (value === "policy_question") return "Duvidas sobre politicas internas";
  return "Outros assuntos de RH";
}

function rhTitleOptionsByReason(value: RhReason) {
  if (value === "registration_update") {
    return [
      "Atualizacao de dados pessoais",
      "Correcao de nome/documento",
      "Atualizacao de endereco e contato",
      OTHER_TITLE_VALUE,
    ];
  }
  if (value === "vacation_leave") {
    return [
      "Solicitacao de ferias",
      "Duvida sobre saldo de ferias",
      "Solicitacao sobre licenca",
      OTHER_TITLE_VALUE,
    ];
  }
  if (value === "benefits") {
    return [
      "Solicitacao sobre beneficios",
      "Duvida sobre plano/beneficio",
      "Atualizacao relacionada a beneficio",
      OTHER_TITLE_VALUE,
    ];
  }
  if (value === "documents") {
    return [
      "Solicitacao de documento trabalhista",
      "Correcao em documento RH",
      "Envio/atualizacao de documento",
      OTHER_TITLE_VALUE,
    ];
  }
  if (value === "policy_question") {
    return [
      "Duvida sobre politica interna",
      "Orientacao sobre regra interna",
      OTHER_TITLE_VALUE,
    ];
  }
  if (value === "other_rh") {
    return [
      "Solicitacao geral para RH",
      "Outros assuntos de RH",
      OTHER_TITLE_VALUE,
    ];
  }
  return ["Solicitacao para RH", OTHER_TITLE_VALUE];
}

function financialTitleOptionsByReason(value: FinancialReason) {
  if (value === "payment_delay") {
    return ["Verificacao de pagamento pendente", "Divergencia no valor do pagamento", OTHER_TITLE_VALUE];
  }
  if (value === "bank_account_change") {
    return ["Atualizacao de conta bancaria", "Atualizacao de agencia e conta", OTHER_TITLE_VALUE];
  }
  if (value === "pix_key_change") {
    return ["Atualizacao de chave PIX", "Correcao de chave PIX cadastrada", OTHER_TITLE_VALUE];
  }
  if (value === "reimbursement") {
    return ["Solicitacao de reembolso", "Status de reembolso pendente", OTHER_TITLE_VALUE];
  }
  if (value === "invoice_issue") {
    return ["Correcao de nota fiscal", "Duvida sobre cobranca/faturamento", OTHER_TITLE_VALUE];
  }
  return ["Solicitacao financeira geral", OTHER_TITLE_VALUE];
}

function pdTitleOptionsByType(value: PdTicketType) {
  if (value === "server_access") {
    return ["Solicitacao de acesso a sistema/servidor", "Erro de permissao em sistema interno", OTHER_TITLE_VALUE];
  }
  if (value === "system_improvement") {
    return ["Melhoria em sistema interno", "Ajuste de funcionalidade em sistema interno", OTHER_TITLE_VALUE];
  }
  if (value === "equipment") {
    return ["Problema com computador/notebook", "Solicitacao de periferico", OTHER_TITLE_VALUE];
  }
  return ["Solicitacao tecnica para TI/P&D", OTHER_TITLE_VALUE];
}

export default function MeuPerfilChamadosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);

  const [destination, setDestination] = useState<DestinationArea>("rh");
  const [rhReason, setRhReason] = useState<RhReason>("registration_update");
  const [financialReason, setFinancialReason] = useState<FinancialReason>("payment_delay");
  const [pdType, setPdType] = useState<PdTicketType>("system_improvement");
  const [pdPriority, setPdPriority] = useState<PdTicketPriority>("medium");
  const [titlePreset, setTitlePreset] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [profileRequests, setProfileRequests] = useState<ProfileRequestRow[]>([]);
  const [pdTickets, setPdTickets] = useState<PdTicketRow[]>([]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw new Error("Sessao invalida. Faca login novamente.");
      const uid = authData.user.id;
      setUserId(uid);

      const [collabRes, requestsRes, pdRes] = await Promise.all([
        supabase.from("colaboradores").select("id").eq("user_id", uid).maybeSingle<{ id: string }>(),
        supabase
          .from("profile_update_requests")
          .select("id,request_type,title,details,requested_changes,status,created_at")
          .eq("requester_user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("pd_tickets")
          .select("id,request_type,priority,title,description,status,created_at")
          .eq("requester_user_id", uid)
          .order("created_at", { ascending: false }),
      ]);

      if (collabRes.error) throw collabRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (pdRes.error) throw pdRes.error;

      setCollaboratorId(collabRes.data?.id ?? null);
      setProfileRequests((requestsRes.data ?? []) as ProfileRequestRow[]);
      setPdTickets((pdRes.data ?? []) as PdTicketRow[]);
    } catch (e: unknown) {
      setProfileRequests([]);
      setPdTickets([]);
      setMsg(e instanceof Error ? e.message : "Erro ao carregar chamados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const history = useMemo<UnifiedTicket[]>(() => {
    const fromProfile = profileRequests.map((r) => ({
      id: r.id,
      source: "profile_update" as const,
      area: r.request_type === "financial" ? "Financeiro" : "RH",
      type: requestTypeLabel(r.request_type),
      title: r.title,
      description: r.details,
      statusLabel: requestStatusLabel(r.status),
      statusClass: requestStatusClass(r.status),
      createdAt: r.created_at,
      attachmentPath:
        typeof (r.requested_changes ?? {})["attachment_path"] === "string"
          ? String((r.requested_changes ?? {})["attachment_path"])
          : null,
      attachmentUrl:
        typeof (r.requested_changes ?? {})["attachment_url"] === "string" &&
        /^https?:\/\//i.test(String((r.requested_changes ?? {})["attachment_url"]))
          ? String((r.requested_changes ?? {})["attachment_url"])
          : null,
      attachmentName:
        typeof (r.requested_changes ?? {})["attachment_name"] === "string"
          ? String((r.requested_changes ?? {})["attachment_name"])
          : null,
    }));

    const fromPd = pdTickets.map((t) => {
      const match = t.description.match(/(?:^|\n)Anexo:\s*(\S+)/i);
      const parsedAttachment = parseLegacyAttachment(match?.[1] ?? "");
      const cleanDescription = t.description.replace(/\n?Anexo:\s*\S+/gi, "").trim();
      return {
        id: t.id,
        source: "pd_ticket" as const,
        area: "P&D",
        type: pdTypeLabel(t.request_type),
        title: t.title,
        description: cleanDescription,
        statusLabel: pdStatusLabel(t.status),
        statusClass: pdStatusClass(t.status),
        createdAt: t.created_at,
        attachmentPath: parsedAttachment.path,
        attachmentUrl: parsedAttachment.url,
        attachmentName: parsedAttachment.path || parsedAttachment.url ? "Anexo" : null,
      };
    });

    return [...fromProfile, ...fromPd].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [profileRequests, pdTickets]);

  async function uploadAttachment(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/chamados/attachments/upload", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const json = (await res.json()) as Partial<UploadResult> & { error?: string };
    if (!res.ok || !json.signedUrl || !json.path || !json.bucket || !json.fileName || !json.mimeType || !json.size) {
      throw new Error(json.error ?? "Falha ao enviar anexo.");
    }
    return {
      signedUrl: json.signedUrl,
      path: json.path,
      bucket: json.bucket,
      fileName: json.fileName,
      mimeType: json.mimeType,
      size: Number(json.size),
    };
  }

  async function openAttachment(item: UnifiedTicket) {
    setMsg("");
    try {
      if (item.attachmentPath) {
        const res = await fetch("/api/chamados/attachments/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: item.id,
            path: item.attachmentPath,
            source: item.source === "pd_ticket" ? "pd_ticket" : "profile_request",
          }),
        });
        const json = (await res.json()) as { signedUrl?: string; error?: string };
        if (!res.ok || !json.signedUrl) throw new Error(json.error ?? "Nao foi possivel abrir o anexo.");
        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (item.attachmentUrl) {
        window.open(item.attachmentUrl, "_blank", "noopener,noreferrer");
        return;
      }
      throw new Error("Anexo indisponivel.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir anexo.");
    }
  }

  const titleOptions = useMemo(() => {
    if (destination === "pd") return pdTitleOptionsByType(pdType);
    if (destination === "financeiro") return financialTitleOptionsByReason(financialReason);
    return rhTitleOptionsByReason(rhReason);
  }, [destination, pdType, financialReason, rhReason]);

  useEffect(() => {
    setTitlePreset(titleOptions[0] ?? "");
    setCustomTitle("");
  }, [titleOptions]);

  async function openTicket() {
    setMsg("");
    if (!userId) {
      setMsg("Sessao invalida. Faca login novamente.");
      return;
    }
    const resolvedTitle = titlePreset === OTHER_TITLE_VALUE ? customTitle.trim() : titlePreset.trim();
    if (!resolvedTitle || !description.trim()) {
      setMsg("Preencha titulo e descricao do chamado.");
      return;
    }

    setSaving(true);
    try {
      let uploadedAttachment: UploadResult | null = null;
      if (attachmentFile) {
        uploadedAttachment = await uploadAttachment(attachmentFile);
      }

      if (destination === "pd") {
        const composedDescription = uploadedAttachment
          ? `${description.trim()}\n\nAnexo: ${uploadedAttachment.path}`
          : description.trim();
        const { error } = await supabase.from("pd_tickets").insert({
          requester_user_id: userId,
          title: resolvedTitle,
          description: composedDescription,
          request_type: pdType,
          priority: pdPriority,
        });
        if (error) throw error;
      } else {
        const finalType: RequestType =
          destination === "financeiro"
            ? "financial"
            : rhReason === "registration_update"
            ? "personal"
            : rhReason === "vacation_leave" || rhReason === "benefits"
            ? "contractual"
            : "other";
        const { error } = await supabase.from("profile_update_requests").insert({
          requester_user_id: userId,
          collaborator_id: collaboratorId,
          request_type: finalType,
          title: resolvedTitle,
          details: description.trim(),
          requested_changes: {
            assigned_area: destination,
            channel: "meu-perfil/chamados",
            rh_reason: destination === "rh" ? rhReason : null,
            financial_reason: destination === "financeiro" ? financialReason : null,
            attachment_url: null,
            attachment_path: uploadedAttachment?.path ?? null,
            attachment_bucket: uploadedAttachment?.bucket ?? null,
            attachment_name: uploadedAttachment?.fileName ?? null,
            attachment_mime_type: uploadedAttachment?.mimeType ?? null,
            attachment_size: uploadedAttachment?.size ?? null,
          },
        });
        if (error) throw error;
      }

      setTitlePreset(titleOptions[0] ?? "");
      setCustomTitle("");
      setDescription("");
      setAttachmentFile(null);
      setRhReason("registration_update");
      setFinancialReason("payment_delay");
      setPdType("system_improvement");
      setPdPriority("medium");
      setMsg("Chamado aberto com sucesso.");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao abrir chamado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Chamados</h1>
            <p className="mt-1 text-sm text-slate-600">
              Abra e acompanhe solicitacoes para RH, Financeiro e P&D em um unico lugar.
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Abrir novo chamado</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Destino
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as DestinationArea)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="rh">RH</option>
              <option value="financeiro">Financeiro</option>
              <option value="pd">P&D</option>
            </select>
          </label>

          {destination === "pd" ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Tipo do chamado
              <select
                value={pdType}
                onChange={(e) => setPdType(e.target.value as PdTicketType)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="server_access">TI - Acessos e infraestrutura</option>
                <option value="system_improvement">Sistemas internos</option>
                <option value="equipment">Equipamentos (computador e perifericos)</option>
                <option value="other">Outros de TI</option>
              </select>
            </label>
          ) : destination === "financeiro" ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Assunto financeiro
              <select
                value={financialReason}
                onChange={(e) => setFinancialReason(e.target.value as FinancialReason)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="payment_delay">Pagamento pendente/atrasado</option>
                <option value="bank_account_change">Mudanca de dados bancarios (conta/agencia)</option>
                <option value="pix_key_change">Mudanca de chave PIX</option>
                <option value="reimbursement">Reembolso</option>
                <option value="invoice_issue">Nota fiscal/cobranca</option>
                <option value="other_financial">Outros assuntos financeiros</option>
              </select>
            </label>
          ) : (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Assunto de RH
              <select
                value={rhReason}
                onChange={(e) => setRhReason(e.target.value as RhReason)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="registration_update">{rhReasonLabel("registration_update")}</option>
                <option value="vacation_leave">{rhReasonLabel("vacation_leave")}</option>
                <option value="benefits">{rhReasonLabel("benefits")}</option>
                <option value="documents">{rhReasonLabel("documents")}</option>
                <option value="policy_question">{rhReasonLabel("policy_question")}</option>
                <option value="other_rh">{rhReasonLabel("other_rh")}</option>
              </select>
            </label>
          )}

          {destination === "pd" ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Prioridade
              <select
                value={pdPriority}
                onChange={(e) => setPdPriority(e.target.value as PdTicketPriority)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Critica</option>
              </select>
            </label>
          ) : null}

          <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
            Titulo padronizado
            <select
              value={titlePreset}
              onChange={(e) => setTitlePreset(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              {titleOptions.map((option) => (
                <option key={option} value={option}>
                  {option === OTHER_TITLE_VALUE ? "Outro (digitar titulo)" : option}
                </option>
              ))}
            </select>
          </label>
          {titlePreset === OTHER_TITLE_VALUE ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2">
              Titulo personalizado
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                placeholder={`Ex.: Solicitacao para ${destinationLabel(destination)}`}
              />
            </label>
          ) : null}
        </div>

        <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-700">
          Descricao
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"
            placeholder="Descreva os detalhes da sua solicitacao."
          />
        </label>

        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-700">Anexo (opcional)</p>
          <label className="mt-1 flex cursor-pointer flex-col gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-slate-400 hover:bg-slate-100">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Paperclip size={16} />
              {attachmentFile ? "Trocar arquivo" : "Selecionar documento"}
            </div>
            <p className="text-xs text-slate-500">
              Formatos aceitos: PDF, JPG, PNG, WEBP, DOC, DOCX (max 10MB).
            </p>
            {attachmentFile ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                Arquivo selecionado: {attachmentFile.name}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                Nenhum arquivo selecionado
              </div>
            )}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => void openTicket()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Enviando..." : "Abrir chamado"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-slate-900">Historico de chamados</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Area</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Titulo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Descricao</th>
                <th className="p-3">Anexo</th>
                <th className="p-3">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-3 text-slate-500">Carregando...</td>
                </tr>
              ) : history.length ? (
                history.map((item) => (
                  <tr key={`${item.source}-${item.id}`} className="border-t">
                    <td className="p-3">{item.area}</td>
                    <td className="p-3">{item.type}</td>
                    <td className="p-3">{item.title}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.statusClass}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="p-3">{item.description}</td>
                    <td className="p-3">
                      {item.attachmentPath || item.attachmentUrl ? (
                        <button
                          type="button"
                          onClick={() => void openAttachment(item)}
                          className="text-xs font-semibold text-sky-700 underline"
                        >
                          {item.attachmentName ?? "Ver anexo"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-3">{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-3 text-slate-500">Nenhum chamado registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

