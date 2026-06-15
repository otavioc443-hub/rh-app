export type MonthlyCompensationSource = {
  salario?: number | string | null;
  bonus_mensal?: number | string | null;
};

export function numberOrZero(value: number | string | null | undefined) {
  return parseMoneyValue(value) ?? 0;
}

export function monthlyCompensation(source: MonthlyCompensationSource) {
  return numberOrZero(source.salario) + numberOrZero(source.bonus_mensal);
}

export function parseMoneyValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = value.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  const dotCount = cleaned.match(/\./g)?.length ?? 0;
  const lastDotPart = cleaned.split(".").at(-1) ?? "";
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : hasDot && (dotCount > 1 || lastDotPart.length === 3)
      ? cleaned.replace(/\./g, "")
      : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoneyValue(value: number | string | null | undefined) {
  const parsed = parseMoneyValue(value);
  if (parsed === null) return "";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
