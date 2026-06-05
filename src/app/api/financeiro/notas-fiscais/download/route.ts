import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type InvoiceFileRow = {
  id: string;
  invoice_id: string;
  file_name: string | null;
  file_kind: string | null;
  storage_bucket: string;
  storage_path: string;
  collaborator_invoices?: {
    user_id: string;
    invoice_number: string | null;
    reference_month: string;
  } | Array<{
    user_id: string;
    invoice_number: string | null;
    reference_month: string;
  }> | null;
};

const MAX_FILES = 300;
const CRC_TABLE = makeCrcTable();

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return data?.user ?? null;
}

async function canDownloadInvoices(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role,active")
    .eq("id", userId)
    .maybeSingle<{ role: string | null; active: boolean | null }>();
  if (error || !data?.active) return false;
  return data.role === "financeiro" || data.role === "admin" || data.role === "rh";
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function u16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function safeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "arquivo";
}

function uniquePath(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const prefix = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  while (used.has(`${prefix}-${index}${ext}`)) index += 1;
  const next = `${prefix}-${index}${ext}`;
  used.add(next);
  return next;
}

function buildZip(entries: Array<{ name: string; data: Uint8Array }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]));
    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function monthYear(value: string) {
  const date = new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${month}-${year}`;
}

function invoiceFromFile(file: InvoiceFileRow) {
  const invoice = file.collaborator_invoices;
  return Array.isArray(invoice) ? invoice[0] ?? null : invoice ?? null;
}

export async function POST(req: Request) {
  try {
    const user = await getRequesterUser(req);
    if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    if (!(await canDownloadInvoices(user.id))) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { invoice_ids?: unknown };
    const invoiceIds = Array.isArray(body.invoice_ids)
      ? Array.from(new Set(body.invoice_ids.map((id) => String(id).trim()).filter(Boolean)))
      : [];
    if (!invoiceIds.length) return NextResponse.json({ error: "Nenhuma nota filtrada para baixar." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("collaborator_invoice_files")
      .select("id,invoice_id,file_name,file_kind,storage_bucket,storage_path,collaborator_invoices(user_id,invoice_number,reference_month)")
      .in("invoice_id", invoiceIds)
      .limit(MAX_FILES);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const files = ((data ?? []) as unknown as InvoiceFileRow[]).filter((file) => file.storage_bucket && file.storage_path && file.file_kind === "pdf");
    if (!files.length) return NextResponse.json({ error: "As notas filtradas nao possuem PDFs para baixar." }, { status: 404 });

    const userIds = Array.from(new Set(files.map((file) => invoiceFromFile(file)?.user_id).filter(Boolean) as string[]));
    const nameByUserId: Record<string, string> = {};
    if (userIds.length) {
      const collaborators = await supabaseAdmin
        .from("colaboradores")
        .select("id,user_id,nome,email")
        .or(`user_id.in.(${userIds.join(",")}),id.in.(${userIds.join(",")})`);
      for (const item of (collaborators.data ?? []) as Array<{ id: string | null; user_id: string | null; nome: string | null; email: string | null }>) {
        const name = item.nome?.trim() || "";
        if (item.user_id && name) nameByUserId[item.user_id] = name;
        if (item.id && name) nameByUserId[item.id] = name;
      }
    }

    const usedNames = new Set<string>();
    const entries: Array<{ name: string; data: Uint8Array }> = [];
    for (const file of files) {
      const downloaded = await supabaseAdmin.storage.from(file.storage_bucket).download(file.storage_path);
      if (downloaded.error || !downloaded.data) continue;
      const invoice = invoiceFromFile(file);
      const collaborator = safeName(nameByUserId[invoice?.user_id ?? ""] ?? "colaborador");
      const competence = invoice?.reference_month ? monthYear(invoice.reference_month) : "sem-competencia";
      const zipPath = uniquePath(`${collaborator}_${competence}.pdf`, usedNames);
      entries.push({ name: zipPath, data: new Uint8Array(await downloaded.data.arrayBuffer()) });
    }

    if (!entries.length) return NextResponse.json({ error: "Nao foi possivel baixar os anexos filtrados." }, { status: 404 });
    const zip = buildZip(entries);
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="notas-fiscais-filtradas-${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
