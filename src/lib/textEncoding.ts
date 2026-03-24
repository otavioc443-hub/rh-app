export function decodeEscapedUnicode(value: string) {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function repairMojibake(value: string) {
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

export function normalizeDisplayText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return repairMojibake(decodeEscapedUnicode(text));
}
