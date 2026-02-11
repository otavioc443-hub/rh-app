import { supabase } from "@/lib/supabaseClient";

export async function getCompanyIdByCnpj(cnpj: string) {
  const normalized = (cnpj || "").replace(/\D/g, "");
  if (normalized.length !== 14) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("cnpj", normalized)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}
