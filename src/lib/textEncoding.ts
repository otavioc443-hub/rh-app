export function decodeEscapedUnicode(value: string) {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function repairMojibake(value: string) {
  const looksMojibake = (text: string) => /Ã.|Â.|â[€™€œ€“]/.test(text);
  if (!looksMojibake(value)) return value;

  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const repaired = decodeURIComponent(escape(current));
      if (repaired === current || !looksMojibake(repaired)) return repaired;
      current = repaired;
    } catch {
      return current;
    }
  }

  return current;
}

export function normalizeDisplayText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return repairMojibake(decodeEscapedUnicode(text));
}
