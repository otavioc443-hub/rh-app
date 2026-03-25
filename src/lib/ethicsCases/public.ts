import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  EthicsCaseStatus,
  PublicEthicsCaseCreatePayload,
  PublicEthicsCaseCreateResult,
  PublicEthicsCaseFollowUpResult,
} from "@/lib/ethicsCases/types";

type EthicsCaseInsertRow = {
  id: string;
  protocol: string;
  category: string | null;
  status: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
};

type EthicsCaseFollowUpRow = {
  id: string;
  protocol: string;
  subject: string;
  category: string | null;
  status: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
};

function normalizeProtocol(protocol: string) {
  return protocol.trim().toUpperCase();
}

function buildProtocolCandidate() {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ETH-${datePart}-${randomPart}`;
}

async function generateUniqueProtocol() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const protocol = buildProtocolCandidate();
    const { data, error } = await supabaseAdmin
      .from("ethics_cases")
      .select("id")
      .eq("protocol", protocol)
      .maybeSingle();

    if (error) throw error;
    if (!data) return protocol;
  }

  throw new Error("Nao foi possivel gerar um protocolo unico.");
}

function buildSubject(category: string, location: string) {
  return `${category} - ${location}`.trim();
}

function buildDescription(payload: PublicEthicsCaseCreatePayload) {
  const details = [
    `Local do ocorrido: ${payload.location}`,
    payload.reporterRole ? `Funcao ou relacao com a empresa: ${payload.reporterRole}` : null,
    payload.reporterPhone ? `Telefone: ${payload.reporterPhone}` : null,
    payload.reporterMobile ? `Celular: ${payload.reporterMobile}` : null,
    payload.previouslyReported ? `Ja denunciou anteriormente: ${payload.previouslyReported}` : null,
    "",
    "Descricao do relato:",
    payload.description,
  ].filter(Boolean);

  return details.join("\n");
}

export async function createPublicEthicsCase(
  payload: PublicEthicsCaseCreatePayload,
): Promise<PublicEthicsCaseCreateResult> {
  const protocol = await generateUniqueProtocol();
  const now = new Date().toISOString();

  const insertPayload = {
    company_id: payload.companyId,
    protocol,
    subject: buildSubject(payload.category, payload.location),
    description: buildDescription(payload),
    category: payload.category,
    risk_level: "Médio",
    status: "Recebido",
    is_anonymous: payload.isAnonymous,
    reporter_name: payload.isAnonymous ? null : payload.reporterName?.trim() || null,
    reporter_email: payload.reporterEmail?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const { data: caseRow, error: insertError } = await supabaseAdmin
    .from("ethics_cases")
    .insert(insertPayload)
    .select("id,protocol,category,status,is_anonymous,created_at")
    .single<EthicsCaseInsertRow>();

  if (insertError) throw insertError;

  const { error: historyError } = await supabaseAdmin.from("ethics_case_history").insert({
    case_id: caseRow.id,
    previous_status: null,
    new_status: "Recebido",
    comment: "Relato registrado pelo portal publico.",
    changed_by: null,
    created_at: now,
  });

  if (historyError) throw historyError;

  return {
    protocol: caseRow.protocol,
    status: (caseRow.status as EthicsCaseStatus) ?? "Recebido",
    createdAt: caseRow.created_at ?? now,
  };
}

export async function getPublicEthicsCaseByProtocol(
  companyId: string,
  protocol: string,
): Promise<PublicEthicsCaseFollowUpResult | null> {
  const normalizedProtocol = normalizeProtocol(protocol);

  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("ethics_cases")
    .select("id,protocol,subject,category,status,is_anonymous,created_at,updated_at,closed_at")
    .eq("company_id", companyId)
    .eq("protocol", normalizedProtocol)
    .maybeSingle<EthicsCaseFollowUpRow>();

  if (caseError) throw caseError;
  if (!caseRow) return null;

  const { data: historyRows, error: historyError } = await supabaseAdmin
    .from("ethics_case_history")
    .select("id,new_status,created_at")
    .eq("case_id", caseRow.id)
    .order("created_at", { ascending: true });

  if (historyError) throw historyError;

  return {
    protocol: caseRow.protocol,
    subject: caseRow.subject,
    category: caseRow.category ?? "Nao classificado",
    status: (caseRow.status as EthicsCaseStatus) ?? "Recebido",
    isAnonymous: caseRow.is_anonymous === true,
    createdAt: caseRow.created_at ?? new Date().toISOString(),
    updatedAt: caseRow.updated_at ?? caseRow.created_at ?? new Date().toISOString(),
    closedAt: caseRow.closed_at,
    history: (historyRows ?? []).map((item) => ({
      id: item.id,
      status: (item.new_status as EthicsCaseStatus) ?? "Recebido",
      createdAt: item.created_at ?? new Date().toISOString(),
    })),
  };
}
