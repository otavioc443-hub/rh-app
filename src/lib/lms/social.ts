import { supabaseAdmin } from "@/lib/supabaseAdmin";

type LmsPulseHubPayload = {
  userId: string;
  companyId: string | null;
  title: string;
  body: string;
};

function isMissingRelation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

export async function publishLmsPulseHubHighlight(payload: LmsPulseHubPayload) {
  try {
    const [profileRes, companyRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,full_name,avatar_url,email")
        .eq("id", payload.userId)
        .maybeSingle<{ id: string; full_name: string | null; avatar_url: string | null; email: string | null }>(),
      payload.companyId
        ? supabaseAdmin.from("companies").select("id,name").eq("id", payload.companyId).maybeSingle<{ id: string; name: string | null }>()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const authorName =
      profileRes.data?.full_name?.trim() ||
      profileRes.data?.email?.split("@")[0]?.trim() ||
      "Colaborador";

    const text = `🏅 ${payload.title}\n\n${payload.body}`;
    const insertRes = await supabaseAdmin.from("internal_social_posts").insert({
      author_user_id: payload.userId,
      author_name: authorName,
      author_avatar_url: profileRes.data?.avatar_url ?? null,
      audience_type: "company",
      audience_project_id: null,
      audience_label: companyRes.data?.name?.trim() || "PulseHub",
      text,
      post_type: "achievement",
    });

    if (insertRes.error && !isMissingRelation(insertRes.error)) throw insertRes.error;
    return { posted: !insertRes.error };
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return { posted: false };
  }
}
