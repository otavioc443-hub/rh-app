import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { buildStorageRef } from "@/lib/lms/utils";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "ethics-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const access = await requireRoles(["admin"]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "pdf");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 });
  const allowedMimeTypes = kind === "image" ? IMAGE_MIME_TYPES : ["application/pdf"];
  if (!allowedMimeTypes.includes(file.type)) {
    return NextResponse.json({ error: kind === "image" ? "Envie uma imagem valida." : "Envie um PDF valido." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Arquivo excede 15MB." }, { status: 400 });

  const bucketRes = await supabaseAdmin.storage.getBucket(BUCKET);
  if (bucketRes.error) {
    const createRes = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_FILE_SIZE}`,
      allowedMimeTypes: ["application/pdf", ...IMAGE_MIME_TYPES],
    });
    if (createRes.error) {
      return NextResponse.json({ error: createRes.error.message }, { status: 500 });
    }
  } else if (kind === "image") {
    await supabaseAdmin.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: `${MAX_FILE_SIZE}`,
      allowedMimeTypes: ["application/pdf", ...IMAGE_MIME_TYPES],
    });
  }

  const fallbackExtension = kind === "image" ? ".webp" : ".pdf";
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : fallbackExtension;
  const filePath = `${access.companyId ?? "global"}/${kind}/${randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await supabaseAdmin.storage.from(BUCKET).upload(filePath, bytes, {
    upsert: false,
    contentType: file.type,
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  return NextResponse.json({
    storageRef: buildStorageRef(BUCKET, filePath),
    fileName: file.name,
  });
}
