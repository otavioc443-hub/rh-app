import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { getCertificateDownload } from "@/lib/lms/server";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const access = await requireRoles(["colaborador", "coordenador", "gestor", "diretoria", "rh", "admin", "compliance"]);
  if (!access.ok) return NextResponse.json({ error: "Nao autorizado." }, { status: access.status });
  const { courseId } = await params;
  const data = await getCertificateDownload(access, courseId);
  return NextResponse.redirect(data.signedUrl);
}
