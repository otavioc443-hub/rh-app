import { NextRequest, NextResponse } from "next/server";
import { createPublicEthicsCase } from "@/lib/ethicsCases/public";
import type { PublicEthicsCaseCreatePayload } from "@/lib/ethicsCases/types";
import { notifyRoles } from "@/lib/server/notifications";

function isValidPayload(body: Partial<PublicEthicsCaseCreatePayload>): body is PublicEthicsCaseCreatePayload {
  return Boolean(
    body.companyId &&
      body.category?.trim() &&
      body.location?.trim() &&
      body.description?.trim() &&
      typeof body.isAnonymous === "boolean",
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<PublicEthicsCaseCreatePayload>;

    if (!isValidPayload(body)) {
      return NextResponse.json({ error: "Dados obrigatorios do relato nao foram informados." }, { status: 400 });
    }

    const result = await createPublicEthicsCase(body);
    await notifyRoles(
      ["compliance", "rh", "admin"],
      {
        title: "Novo relato no canal de etica",
        body: "Um novo relato foi registrado e aguarda triagem. O conteudo sensivel deve ser acessado apenas no modulo.",
        link: "/admin/canal-de-etica",
        type: "ethics_case_created",
        entity_type: "ethics_case_protocol",
        entity_id: result.protocol,
        severity: "warning",
        action_required: true,
      },
      { companyId: body.companyId },
    );
    return NextResponse.json({ item: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar o relato." },
      { status: 500 },
    );
  }
}
