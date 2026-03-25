import { NextRequest, NextResponse } from "next/server";
import { getEthicsManagedContentForCompanyId } from "@/lib/ethicsChannelServer";
import type { EthicsManagedContent } from "@/lib/ethicsChannelDefaults";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function serializeContent(content: EthicsManagedContent) {
  return {
    hero_title: content.heroTitle,
    hero_subtitle: content.heroSubtitle,
    heading: content.heading,
    intro: content.intro,
    hero_image_url: content.heroImageUrl,
    report_url: content.reportUrl,
    follow_up_url: content.followUpUrl,
    contact_email: content.contactEmail,
    contact_phone: content.contactPhone,
    code_of_ethics_url: content.codeOfEthicsUrl,
    data_protection_url: content.dataProtectionUrl,
    code_summary: content.codeSummary,
    data_protection_summary: content.dataProtectionSummary,
    principles: content.principles,
    foundation_title: content.foundationTitle,
    foundation_subtitle: content.foundationSubtitle,
    foundation_pillars: content.foundationPillars,
    steer_title: content.steerTitle,
    steer_body: content.steerBody,
    faq_items: content.faqItems,
    page_texts: content.pageTexts,
  };
}

export async function GET(request: NextRequest) {
  const access = await requireRoles(["admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
  if (access.companyId && access.companyId !== companyId) {
    return NextResponse.json({ error: "Empresa fora do seu escopo." }, { status: 403 });
  }

  const data = await getEthicsManagedContentForCompanyId(companyId);
  if (!data) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  return NextResponse.json({ company: data.company, content: data.content });
}

export async function PATCH(request: NextRequest) {
  const access = await requireRoles(["admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await request.json()) as { companyId?: string; content?: EthicsManagedContent };
    if (!body.companyId || !body.content) {
      return NextResponse.json({ error: "Dados inválidos para salvar o conteúdo." }, { status: 400 });
    }
    if (access.companyId && access.companyId !== body.companyId) {
      return NextResponse.json({ error: "Empresa fora do seu escopo." }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("ethics_channel_content").upsert(
      {
        company_id: body.companyId,
        ...serializeContent(body.content),
        updated_by: access.userId,
      },
      { onConflict: "company_id" },
    );

    if (error) throw error;

    const data = await getEthicsManagedContentForCompanyId(body.companyId);
    if (!data) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

    return NextResponse.json({ company: data.company, content: data.content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar o conteúdo." },
      { status: 500 },
    );
  }
}
