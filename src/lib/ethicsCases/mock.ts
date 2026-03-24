import type {
  EthicsCaseHistoryEntry,
  EthicsCaseRecord,
  EthicsDashboardData,
  EthicsSummary,
} from "@/lib/ethicsCases/types";

function buildSummary(cases: EthicsCaseRecord[]): EthicsSummary {
  const byStatus = {
    Recebido: 0,
    "Em triagem": 0,
    "Em análise": 0,
    "Em investigação": 0,
    Concluído: 0,
    Encerrado: 0,
    Reaberto: 0,
  } as EthicsSummary["byStatus"];

  for (const item of cases) byStatus[item.status] += 1;

  return {
    total: cases.length,
    byStatus,
  };
}

const mockHistory: Record<string, EthicsCaseHistoryEntry[]> = {
  "case-1": [
    {
      id: "hist-1",
      case_id: "case-1",
      previous_status: null,
      new_status: "Recebido",
      comment: "Registro recebido no canal e encaminhado para avaliação inicial.",
      changed_by: "user-admin-1",
      changed_by_name: "Marina Almeida",
      created_at: "2026-03-18T09:05:00.000Z",
    },
    {
      id: "hist-2",
      case_id: "case-1",
      previous_status: "Recebido",
      new_status: "Em triagem",
      comment: "Separação preliminar dos fatos e validação das evidências anexadas.",
      changed_by: "user-compliance-1",
      changed_by_name: "Carlos Nogueira",
      created_at: "2026-03-18T14:20:00.000Z",
    },
  ],
  "case-2": [
    {
      id: "hist-3",
      case_id: "case-2",
      previous_status: null,
      new_status: "Em análise",
      comment: "Caso já chegou com detalhamento suficiente para análise.",
      changed_by: "user-rh-1",
      changed_by_name: "Fernanda Costa",
      created_at: "2026-03-16T11:10:00.000Z",
    },
  ],
  "case-3": [
    {
      id: "hist-4",
      case_id: "case-3",
      previous_status: null,
      new_status: "Em investigação",
      comment: "Caso direcionado para apuração com envolvimento de mais de uma área.",
      changed_by: "user-compliance-1",
      changed_by_name: "Carlos Nogueira",
      created_at: "2026-03-10T16:45:00.000Z",
    },
  ],
  "case-4": [
    {
      id: "hist-5",
      case_id: "case-4",
      previous_status: null,
      new_status: "Encerrado",
      comment: "Tratativa concluída e caso encerrado com registro final.",
      changed_by: "user-admin-1",
      changed_by_name: "Marina Almeida",
      created_at: "2026-02-28T17:15:00.000Z",
    },
  ],
};

const mockCases: EthicsCaseRecord[] = [
  {
    id: "case-1",
    protocol: "ET-2026-0001",
    subject: "Suposto conflito de interesses em contratação de fornecedor",
    description:
      "Relato sobre possível favorecimento indevido na seleção de fornecedor em processo de contratação para obra de energia renovável.",
    category: "Conflito de interesses",
    risk_level: "Alto",
    status: "Em triagem",
    is_anonymous: false,
    reporter_name: "Juliana Rocha",
    reporter_email: "juliana.rocha@solida.com.br",
    assigned_to: "user-compliance-1",
    assigned_to_name: "Carlos Nogueira",
    created_at: "2026-03-18T09:05:00.000Z",
    updated_at: "2026-03-18T14:20:00.000Z",
    closed_at: null,
    last_update_at: "2026-03-18T14:20:00.000Z",
    attachments: [
      {
        id: "att-1",
        name: "comparativo-fornecedores.pdf",
        url: "#",
      },
    ],
    history: mockHistory["case-1"],
  },
  {
    id: "case-2",
    protocol: "ET-2026-0002",
    subject: "Conduta inadequada de liderança",
    description:
      "Denúncia sobre postura recorrente incompatível com o código de conduta em reuniões de acompanhamento da equipe.",
    category: "Assédio moral",
    risk_level: "Médio",
    status: "Em análise",
    is_anonymous: true,
    reporter_name: null,
    reporter_email: null,
    assigned_to: "user-rh-1",
    assigned_to_name: "Fernanda Costa",
    created_at: "2026-03-16T11:10:00.000Z",
    updated_at: "2026-03-17T08:40:00.000Z",
    closed_at: null,
    last_update_at: "2026-03-17T08:40:00.000Z",
    attachments: [],
    history: mockHistory["case-2"],
  },
  {
    id: "case-3",
    protocol: "ET-2026-0003",
    subject: "Indício de fraude documental",
    description:
      "Foram relatadas inconsistências em documentos usados em aprovação interna, com necessidade de investigação aprofundada.",
    category: "Fraude",
    risk_level: "Crítico",
    status: "Em investigação",
    is_anonymous: false,
    reporter_name: "Paulo Mendes",
    reporter_email: "paulo.mendes@solida.com.br",
    assigned_to: "user-admin-1",
    assigned_to_name: "Marina Almeida",
    created_at: "2026-03-10T16:45:00.000Z",
    updated_at: "2026-03-19T13:10:00.000Z",
    closed_at: null,
    last_update_at: "2026-03-19T13:10:00.000Z",
    attachments: [
      { id: "att-2", name: "evidencia-print.png", url: "#" },
      { id: "att-3", name: "documentos.zip", url: "#" },
    ],
    history: mockHistory["case-3"],
  },
  {
    id: "case-4",
    protocol: "ET-2026-0004",
    subject: "Uso indevido de recursos corporativos",
    description:
      "Caso concluído com apuração e registro das medidas adotadas após confirmação de descumprimento de política interna.",
    category: "Uso indevido de recursos",
    risk_level: "Baixo",
    status: "Encerrado",
    is_anonymous: true,
    reporter_name: null,
    reporter_email: null,
    assigned_to: "user-compliance-1",
    assigned_to_name: "Carlos Nogueira",
    created_at: "2026-02-25T10:30:00.000Z",
    updated_at: "2026-02-28T17:15:00.000Z",
    closed_at: "2026-02-28T17:15:00.000Z",
    last_update_at: "2026-02-28T17:15:00.000Z",
    attachments: [],
    history: mockHistory["case-4"],
  },
];

export function getMockEthicsDashboardData(): EthicsDashboardData {
  return {
    source: "mock",
    cases: mockCases,
    summary: buildSummary(mockCases),
    assignees: [
      { id: "user-admin-1", name: "Marina Almeida" },
      { id: "user-rh-1", name: "Fernanda Costa" },
      { id: "user-compliance-1", name: "Carlos Nogueira" },
    ],
    warning:
      "Exibindo dados mockados porque as tabelas de casos éticos ainda não estão disponíveis ou acessíveis no Supabase.",
  };
}
