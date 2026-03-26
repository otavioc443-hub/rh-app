type CertificatePdfInput = {
  validationCode: string;
  learnerName: string;
  courseTitle: string;
  workloadHours: number | null;
  completedAt: string;
  companyName: string;
  validationUrl?: string | null;
};

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toPdfLine(text: string, y: number, size = 14) {
  return `BT /F1 ${size} Tf 56 ${y} Td (${escapePdfText(text)}) Tj ET`;
}

export function buildCertificatePdf(input: CertificatePdfInput) {
  const lines = [
    toPdfLine(input.companyName || "Portal RH", 770, 18),
    toPdfLine("Certificado de conclusao", 734, 26),
    toPdfLine(`Certificamos que ${input.learnerName}.`, 688, 14),
    toPdfLine(`Concluiu o treinamento: ${input.courseTitle}.`, 664, 14),
    toPdfLine(`Carga horaria: ${input.workloadHours ?? 0} hora(s).`, 640, 14),
    toPdfLine(`Data de conclusao: ${input.completedAt}.`, 616, 14),
    toPdfLine(`Codigo de validacao: ${input.validationCode}.`, 592, 12),
    toPdfLine(input.validationUrl ? `Validacao publica: ${input.validationUrl}.` : "Documento emitido eletronicamente pelo modulo LMS.", 568, 10),
    toPdfLine("Documento emitido eletronicamente pelo modulo LMS.", 548, 12),
  ].join("\n");

  const contentStream = `${lines}\n`;
  const contentLength = Buffer.byteLength(contentStream, "latin1");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${contentLength} >> stream\n${contentStream}endstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
