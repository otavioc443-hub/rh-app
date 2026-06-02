import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PulseHubSharePost = {
  id: string;
  title: string;
  description: string;
  publisher: string;
  postType: string;
  createdAt: string;
  portalUrl: string;
  shareUrl: string;
  imageUrl: string;
};

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rh-app-seven.vercel.app").replace(/\/$/, "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function plainText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/<u>(.*?)<\/u>/gi, "$1")
    .replace(/Anexo:\s*\S+/gi, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string, max: number) {
  const normalized = plainText(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function postTypeLabel(value: string | null | undefined) {
  if (value === "announcement") return "Comunicado oficial";
  if (value === "campaign") return "Campanha interna";
  if (value === "event") return "Evento";
  if (value === "recognition") return "Reconhecimento";
  return "Publicação";
}

function cleanLine(value: string) {
  return plainText(value)
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

function extractTitle(value: string | null | undefined, fallback: string) {
  const lines = String(value ?? "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  return compact(lines[0] || fallback, 95);
}

export function getPulseHubShareUrl(postId: string) {
  return `${SITE_ORIGIN}/s/pulsehub/${postId}`;
}

export function getPulseHubPortalPostUrl(postId: string) {
  return `${SITE_ORIGIN}/institucional/rede-social?tab=inicio#post-${postId}`;
}

export function getPulseHubShareImageUrl(postId: string) {
  return `${SITE_ORIGIN}/s/pulsehub/${postId}/preview.png?v=5`;
}

export async function getPulseHubSharePost(postId: string): Promise<PulseHubSharePost | null> {
  if (!UUID_RE.test(postId)) return null;

  const { data: post, error } = await supabaseAdmin
    .from("internal_social_posts")
    .select("id,author_name,audience_label,text,post_type,official_author_label,created_at,audience_company_id")
    .eq("id", postId)
    .maybeSingle<{
      id: string;
      author_name: string | null;
      audience_label: string | null;
      text: string | null;
      post_type: string | null;
      official_author_label: string | null;
      created_at: string;
      audience_company_id: string | null;
    }>();

  if (error || !post?.id) return null;

  let companyName: string | null = null;
  if (post.audience_company_id) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", post.audience_company_id)
      .maybeSingle<{ name: string | null }>();
    companyName = company?.name ?? null;
  }

  const publisher = compact(post.official_author_label || companyName || post.audience_label || post.author_name || "Portal de RH", 80);
  const fallbackTitle = `${postTypeLabel(post.post_type)} - ${publisher}`;
  const title = extractTitle(post.text, fallbackTitle);
  const description = `Acesse o link para ver o comunicado completo no Portal de RH.`;

  return {
    id: post.id,
    title,
    description,
    publisher,
    postType: postTypeLabel(post.post_type),
    createdAt: post.created_at,
    portalUrl: getPulseHubPortalPostUrl(post.id),
    shareUrl: getPulseHubShareUrl(post.id),
    imageUrl: getPulseHubShareImageUrl(post.id),
  };
}
