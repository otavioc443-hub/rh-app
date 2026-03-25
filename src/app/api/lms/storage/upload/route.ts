import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildStorageRef } from "@/lib/lms/utils";

const BUCKETS = new Set(["lms-thumbnails", "lms-banners", "lms-materials", "lms-videos"]);
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Acesso negado." }, { status: access.status });

  const formData = await request.formData();
  const file = formData.get("file");
  const bucket = String(formData.get("bucket") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 });
  if (!BUCKETS.has(bucket)) return NextResponse.json({ error: "Bucket nao permitido." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Arquivo excede 100MB." }, { status: 400 });

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  const filePath = `${access.companyId ?? "global"}/${randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await supabaseAdmin.storage.from(bucket).upload(filePath, bytes, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  return NextResponse.json({ storageRef: buildStorageRef(bucket, filePath) });
}
