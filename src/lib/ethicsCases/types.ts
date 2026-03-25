export const ETHICS_CASE_STATUSES = [
  "Recebido",
  "Em triagem",
  "Em análise",
  "Em investigação",
  "Concluído",
  "Encerrado",
  "Reaberto",
] as const;

export const ETHICS_RISK_LEVELS = ["Baixo", "Médio", "Alto", "Crítico"] as const;

export const ETHICS_CASE_ORIGINS = ["anonymous", "identified"] as const;

export type EthicsCaseStatus = (typeof ETHICS_CASE_STATUSES)[number];
export type EthicsRiskLevel = (typeof ETHICS_RISK_LEVELS)[number];
export type EthicsCaseOrigin = (typeof ETHICS_CASE_ORIGINS)[number];

export type EthicsAttachment = {
  id: string;
  name: string;
  url: string;
};

export type EthicsCaseHistoryEntry = {
  id: string;
  case_id: string;
  previous_status: EthicsCaseStatus | null;
  new_status: EthicsCaseStatus;
  comment: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
};

export type EthicsCaseRecord = {
  id: string;
  company_id: string;
  protocol: string;
  subject: string;
  description: string;
  category: string;
  risk_level: EthicsRiskLevel;
  status: EthicsCaseStatus;
  is_anonymous: boolean;
  reporter_name: string | null;
  reporter_email: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_update_at: string;
  attachments: EthicsAttachment[];
  history: EthicsCaseHistoryEntry[];
};

export type EthicsSummary = {
  total: number;
  byStatus: Record<EthicsCaseStatus, number>;
};

export type EthicsDashboardData = {
  source: "supabase" | "mock";
  cases: EthicsCaseRecord[];
  summary: EthicsSummary;
  assignees: Array<{ id: string; name: string }>;
  warning: string | null;
};

export type PublicEthicsCaseCreatePayload = {
  companyId: string;
  isAnonymous: boolean;
  reporterName?: string | null;
  reporterEmail?: string | null;
  reporterRole?: string | null;
  reporterPhone?: string | null;
  reporterMobile?: string | null;
  previouslyReported?: string | null;
  category: string;
  location: string;
  description: string;
};

export type PublicEthicsCaseCreateResult = {
  protocol: string;
  status: EthicsCaseStatus;
  createdAt: string;
};

export type PublicEthicsCaseFollowUpResult = {
  protocol: string;
  subject: string;
  category: string;
  status: EthicsCaseStatus;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  history: Array<{
    id: string;
    status: EthicsCaseStatus;
    createdAt: string;
  }>;
};

export type EthicsCaseFiltersState = {
  search: string;
  status: string;
  category: string;
  risk: string;
  origin: "all" | EthicsCaseOrigin;
  openedFrom: string;
  openedTo: string;
};

export type EthicsCasesSortKey =
  | "protocol"
  | "created_at"
  | "subject"
  | "category"
  | "status"
  | "risk_level"
  | "origin"
  | "assigned_to_name"
  | "last_update_at";

export type EthicsCasesSortState = {
  key: EthicsCasesSortKey;
  direction: "asc" | "desc";
};

export type EthicsCaseUpdatePayload =
  | {
      action: "status";
      status: EthicsCaseStatus;
      comment?: string;
    }
  | {
      action: "assign";
      assignedTo: string | null;
      comment?: string;
    }
  | {
      action: "note";
      comment: string;
    }
  | {
      action: "close";
      comment?: string;
    };
