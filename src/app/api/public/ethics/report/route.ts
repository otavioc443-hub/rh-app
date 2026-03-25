import { NextRequest, NextResponse } from "next/server";
import { createPublicEthicsCase } from "@/lib/ethicsCases/public";
import type { PublicEthicsCaseCreatePayload } from "@/lib/ethicsCases/types";

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
    return NextResponse.json({ item: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar o relato." },
      { status: 500 },
    );
  }
}
