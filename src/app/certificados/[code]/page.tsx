import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCertificateValidation } from "@/lib/lms/server";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));
}

export default async function PublicCertificateValidationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await getPublicCertificateValidation(code);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Validacao de certificado</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Certificado confirmado</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Este documento foi emitido pelo modulo de treinamentos do portal corporativo e corresponde a uma conclusao registrada no ambiente oficial.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colaborador</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{data.learnerName}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Empresa</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{data.companyName}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Treinamento</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{data.courseTitle}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Carga horaria</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{data.workloadHours ?? 0} hora(s)</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conclusao</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{formatDate(data.completedAt)}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Codigo de validacao</div>
              <div className="mt-2 break-all text-lg font-semibold text-slate-950">{data.validationCode}</div>
            </div>
          </div>
        </section>

        <div className="text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-slate-900 underline">
            Voltar ao portal
          </Link>
        </div>
      </div>
    </main>
  );
}
