import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/server/feedbackGuard";
import { buildStorageRef } from "@/lib/lms/utils";
import type { LmsMediaLibraryItem } from "@/lib/lms/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKETS = new Set(["lms-thumbnails", "lms-banners", "lms-materials", "lms-videos"]);

export async function GET(request: Request) {
  const access = await requireRoles(["rh", "admin"]);
  if (!access.ok) return NextResponse.json({ error: "Acesso negado." }, { status: access.status });

  const { searchParams } = new URL(request.url);
  const bucket = String(searchParams.get("bucket") ?? "").trim() as LmsMediaLibraryItem["bucket"];
  const search = String(searchParams.get("search") ?? "").trim().toLowerCase();

  if (!BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket nao permitido." }, { status: 400 });
  }

  const basePath = access.companyId ?? "global";
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(basePath, {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const files = (data ?? []).filter((entry) => entry.name && !entry.id?.endsWith("/"));
  const filtered = files.filter((entry) => !search || entry.name.toLowerCase().includes(search));

  const items = await Promise.all(
    filtered.map(async (entry) => {
      const path = `${basePath}/${entry.name}`;
      const storageRef = buildStorageRef(bucket, path);
      const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 60);
      const item: LmsMediaLibraryItem = {
        id: entry.id ?? path,
        name: entry.name,
        bucket,
        path,
        storageRef,
        signedUrl: signed?.signedUrl ?? null,
        createdAt: entry.created_at ?? null,
      };
      return item;
    }),
  );

  return NextResponse.json({ items });
}
