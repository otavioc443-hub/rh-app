import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { notifyRoles } from "@/lib/server/notifications";

type DestinationArea = "rh" | "financeiro" | "pd";

const AREA_CONFIG: Record<DestinationArea, { roles: Array<"rh" | "financeiro" | "pd" | "admin">; link: string; label: string }> = {
  rh: { roles: ["rh", "admin"], link: "/rh/solicitacoes", label: "RH" },
  financeiro: { roles: ["financeiro", "admin"], link: "/financeiro/solicitacoes", label: "Financeiro" },
  pd: { roles: ["pd", "admin"], link: "/p-d/chamados", label: "P&D" },
};

export async function POST(req: Request) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "financeiro", "pd", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await req.json()) as { area?: DestinationArea; title?: string; description?: string | null };
    const area = body.area;
    if (area !== "rh" && area !== "financeiro" && area !== "pd") {
      return NextResponse.json({ error: "Area invalida." }, { status: 400 });
    }

    const config = AREA_CONFIG[area];
    const title = String(body.title ?? "").trim() || "Novo chamado";
    const description = String(body.description ?? "").trim();

    const result = await notifyRoles(
      config.roles,
      {
        title: `Novo chamado para ${config.label}`,
        body: description ? `${title}: ${description.slice(0, 160)}` : title,
        link: config.link,
        type: "support_ticket_created",
      },
      { companyId: access.companyId, excludeUserIds: [access.userId] },
    );

    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao notificar chamado." },
      { status: 500 },
    );
  }
}
