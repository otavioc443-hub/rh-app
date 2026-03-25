import { NextRequest, NextResponse } from "next/server";
import { getPublicEthicsCaseByProtocol } from "@/lib/ethicsCases/public";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId")?.trim();
    const protocol = searchParams.get("protocol")?.trim();

    if (!companyId || !protocol) {
      return NextResponse.json({ error: "Informe a empresa e o protocolo para consulta." }, { status: 400 });
    }

    const item = await getPublicEthicsCaseByProtocol(companyId, protocol);
    if (!item) {
      return NextResponse.json({ error: "Nenhum relato foi encontrado para o protocolo informado." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar o protocolo." },
      { status: 500 },
    );
  }
}
