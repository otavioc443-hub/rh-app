export function normalizeRoutePath(path: string | null | undefined): string {
  if (!path) return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  const clean = trimmed.split("?")[0].split("#")[0];
  if (clean === "/") return "/";
  return clean.endsWith("/") ? clean.slice(0, -1) : clean;
}

export function isRouteHidden(pathname: string, hiddenRoutes: Iterable<string>): boolean {
  const current = normalizeRoutePath(pathname);
  for (const candidate of hiddenRoutes) {
    const hidden = normalizeRoutePath(candidate);
    if (hidden === "/") continue;
    if (current === hidden) return true;
    if (current.startsWith(`${hidden}/`)) return true;
  }
  return false;
}
