const INTERNAL_AVATAR_ROUTE = "/api/me/avatar/file";

function buildAvatarUrl(path: string, version: string | null = null) {
  const params = new URLSearchParams({ path });
  if (version) params.set("v", version);
  return `${INTERNAL_AVATAR_ROUTE}?${params.toString()}`;
}

function readVersion(value: string) {
  try {
    const parsed = new URL(value, "http://local");
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export function extractAvatarPath(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw, "http://local");
    if (parsed.pathname === INTERNAL_AVATAR_ROUTE) {
      return parsed.searchParams.get("path");
    }

    const markers = [
      "/storage/v1/object/public/avatars/",
      "/storage/v1/object/sign/avatars/",
      "/storage/v1/object/authenticated/avatars/",
    ];
    for (const marker of markers) {
      const idx = parsed.pathname.indexOf(marker);
      if (idx >= 0) {
        const tail = parsed.pathname.slice(idx + marker.length);
        return decodeURIComponent(tail);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function resolvePortalAvatarUrl(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const path = extractAvatarPath(raw);
  if (!path) return raw;
  return buildAvatarUrl(path, readVersion(raw));
}

export function buildPortalAvatarUrl(path: string, version?: string | number | null) {
  return buildAvatarUrl(path, version == null ? null : String(version));
}
