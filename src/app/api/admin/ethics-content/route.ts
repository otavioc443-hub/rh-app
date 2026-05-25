import { NextRequest, NextResponse } from "next/server";
import { getEthicsManagedContentForCompanyId } from "@/lib/ethicsChannelServer";
import type { EthicsManagedContent } from "@/lib/ethicsChannelDefaults";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function serializeContent(content: EthicsManagedContent) {
  return {
    publication_status: content.publicationStatus,
    legal_notice: content.legalNotice,
    non_retaliation_policy: content.nonRetaliationPolicy,
    report_types: content.reportTypes,
    out_of_scope: content.outOfScope,
    treatment_flow: content.treatmentFlow,
    analysis_deadline: content.analysisDeadline,
    footer_note: content.footerNote,
    custom_primary_color: content.customPrimaryColor,
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

async function getAuditEntries(companyId: string) {
  const { data } = await supabaseAdmin
    .from("ethics_channel_content_audit")
    .select("id, action, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(8);

  return data ?? [];
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

  const audit = await getAuditEntries(companyId);
  return NextResponse.json({ company: data.company, content: data.content, audit });
}

export async function PATCH(request: NextRequest) {
  const access = await requireRoles(["admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = (await request.json()) as { companyId?: string; content?: EthicsManagedContent; action?: "draft" | "publish" };
    if (!body.companyId || !body.content) {
      return NextResponse.json({ error: "Dados inválidos para salvar o conteúdo." }, { status: 400 });
    }
    if (access.companyId && access.companyId !== body.companyId) {
      return NextResponse.json({ error: "Empresa fora do seu escopo." }, { status: 403 });
    }

    const action = body.action === "draft" ? "draft" : "publish";
    const payload =
      action === "draft"
        ? {
            company_id: body.companyId,
            draft_content: body.content,
            updated_by: access.userId,
          }
        : {
            company_id: body.companyId,
            ...serializeContent(body.content),
            draft_content: null,
            updated_by: access.userId,
          };

    const { error } = await supabaseAdmin.from("ethics_channel_content").upsert(payload, { onConflict: "company_id" });

    if (error) throw error;

    await supabaseAdmin.from("ethics_channel_content_audit").insert({
      company_id: body.companyId,
      user_id: access.userId,
      action: action === "draft" ? "save_draft" : "publish",
      content_snapshot: body.content,
    });

    const data = await getEthicsManagedContentForCompanyId(body.companyId);
    if (!data) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

    const audit = await getAuditEntries(body.companyId);
    return NextResponse.json({ company: data.company, content: data.content, audit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar o conteúdo." },
      { status: 500 },
    );
  }
}
