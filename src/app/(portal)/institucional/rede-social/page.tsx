"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { resolvePortalAvatarUrl } from "@/lib/avatarUrl";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: string | null;
  avatar_url?: string | null;
  cargo?: string | null;
  setor?: string | null;
};

type CollaboratorDirectoryRow = {
  user_id: string | null;
  nome: string | null;
  cargo: string | null;
  setor: string | null;
  data_nascimento?: string | null;
  data_admissao?: string | null;
  is_active?: boolean | null;
};

type Project = {
  id: string;
  name: string;
};

type Group = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover_color: string;
  is_private: boolean;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: "owner" | "moderator" | "member";
};

type PostType = "social" | "announcement" | "campaign" | "event" | "recognition";

type PostRow = {
  id: string;
  author_user_id: string;
  author_name: string;
  author_avatar_url: string | null;
  audience_type: "company" | "project" | "group";
  audience_project_id: string | null;
  audience_group_id?: string | null;
  audience_label: string;
  text: string;
  post_type?: PostType;
  official_author_label?: string | null;
  hidden_at?: string | null;
  hidden_reason?: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  author_name: string;
  text: string;
  created_at: string;
};

type AttachmentType = "image" | "video" | "link";

type AttachmentRow = {
  id: string;
  post_id: string;
  type: AttachmentType;
  url: string;
  label: string | null;
  resolvedUrl?: string;
};

type DraftAttachment = {
  type: AttachmentType;
  url: string;
  label: string;
  storagePath?: string;
};

type ReactionRow = {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
};

type MessageRow = {
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  text: string;
  created_at: string;
};

type FeedPost = PostRow & {
  attachments: AttachmentRow[];
  comments: CommentRow[];
  reactions: ReactionRow[];
  poll?: FeedPoll | null;
  reportsCount?: number;
  isReportedByMe?: boolean;
};

type FeedPoll = {
  id: string;
  post_id: string;
  question: string;
  allow_multiple: boolean;
  options: FeedPollOption[];
};

type FeedPollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  votes: number;
  votedByMe: boolean;
};

type NotificationRow = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  kind: "comment" | "reaction" | "mention" | "message" | "announcement" | "campaign";
  entity_type: "post" | "comment" | "message" | "system";
  entity_id: string | null;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

type ReportRow = {
  id: string;
  reporter_user_id: string;
  target_type: "post" | "comment";
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type SocialHighlightRow = {
  userId: string;
  name: string;
  subtitle: string;
  dateLabel: string;
  avatarUrl: string | null;
};

type SyncBody =
  | {
      type: "post_sync";
      postId: string;
      text: string;
      postType?: string | null;
      broadcastOfficial?: boolean;
    }
  | {
      type: "comment_sync";
      postId: string;
      commentId: string;
      text: string;
      notifyPostAuthor?: boolean;
    }
  | {
      type: "reaction_notify";
      postId: string;
      emoji: string;
    }
  | {
      type: "message_notify";
      messageId: string;
      toUserId: string;
      preview?: string | null;
    };

type SearchSuggestionItem = {
  key: string;
  kind: "person" | "post" | "project" | "conversation";
  id: string;
};

type EmojiGroup = {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
};

const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "smileys",
    label: "Rostos",
    icon: "😀",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🙂", "😉", "😊", "😇", "😍", "😘", "😗", "😙", "😚", "😋", "😎", "🤓"],
  },
  {
    id: "feelings",
    label: "Humor",
    icon: "😌",
    emojis: ["😌", "😴", "😪", "🤤", "😮", "😯", "😲", "😳", "😕", "😟", "🙁", "☹️", "😮‍💨", "😢", "😭", "😤", "😠", "😡", "🤔", "🤭"],
  },
  {
    id: "people",
    label: "Pessoas",
    icon: "🙌",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👀", "👋", "👌", "✌️", "🤞", "🤘", "🤙", "☝️", "👆", "👇", "👉", "👈", "💁"],
  },
  {
    id: "hearts",
    label: "Corações",
    icon: "❤️",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️"],
  },
  {
    id: "nature",
    label: "Natureza",
    icon: "🌿",
    emojis: ["🌞", "🌈", "⭐", "🔥", "⚡", "☁️", "🌧️", "🌊", "🌱", "🌿", "🌳", "🌵", "🌷", "🌹", "🌻", "🍀", "🍁", "🦋", "🐝", "🐞"],
  },
  {
    id: "animals",
    label: "Animais",
    icon: "🐶",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦄"],
  },
  {
    id: "food",
    label: "Comidas",
    icon: "🍕",
    emojis: ["☕", "🍵", "🧃", "🥤", "🍎", "🍉", "🍓", "🍇", "🥑", "🍔", "🍟", "🍕", "🌮", "🥗", "🍿", "🍩", "🎂", "🍪", "🍫", "🍻"],
  },
  {
    id: "activities",
    label: "Atividades",
    icon: "🎉",
    emojis: ["🎉", "🎊", "🏆", "🥇", "⚽", "🏀", "🎯", "🎮", "🎵", "🎤", "🎬", "📚", "✈️", "🏖️", "🏡", "🛠️", "💡", "📈", "🧠", "🚀"],
  },
  {
    id: "travel",
    label: "Viagens",
    icon: "✈️",
    emojis: ["✈️", "🚗", "🚕", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚚", "🚲", "🛵", "🏍️", "🚂", "🚆", "🚇", "🚤", "⛵", "🚢", "🚁"],
  },
  {
    id: "objects",
    label: "Objetos",
    icon: "💻",
    emojis: ["📱", "💻", "⌚", "📷", "🎧", "🔔", "🔒", "🔑", "💡", "📝", "📌", "📎", "📦", "📄", "💰", "💳", "🛒", "🎁", "🔋", "📚"],
  },
  {
    id: "symbols",
    label: "Símbolos",
    icon: "✅",
    emojis: ["✅", "☑️", "✔️", "❌", "⚠️", "⛔", "🚫", "❗", "❓", "💯", "🔝", "🔄", "♻️", "➕", "➖", "➗", "➡️", "⬆️", "⬇️", "⭐"],
  },
  {
    id: "flags",
    label: "Bandeiras",
    icon: "🏳️",
    emojis: ["🏁", "🚩", "🏳️", "🏴", "🇧🇷", "🇺🇸", "🇵🇹", "🇪🇸", "🇫🇷", "🇮🇹", "🇩🇪", "🇦🇷", "🇨🇦", "🇯🇵", "🇨🇳", "🇲🇽", "🇬🇧", "🇦🇴", "🇨🇱", "🇺🇾"],
  },
];
const REACTION_EMOJIS = ["👍", "❤️", "🎉", "👏", "🔥", "🚀"] as const;
const MIGRATION = "supabase/sql/2026-03-03_create_internal_social_network_tables.sql";
const MEDIA_BUCKET_MIGRATION = "supabase/sql/2026-03-03_create_internal_social_media_bucket.sql";
const SOCIAL_BOARD_MIGRATION = "supabase/sql/2026-03-03_add_pinned_post_and_project_board_to_internal_social.sql";
const QUICKWINS_MIGRATION = "supabase/sql/2026-03-19_expand_pulsehub_quickwins.sql";
const COMMUNITIES_MIGRATION = "supabase/sql/2026-03-19_expand_pulsehub_communities_polls_moderation.sql";
const HOME_ANALYTICS_MIGRATION = "supabase/sql/2026-03-19_expand_pulsehub_home_analytics_moderation_controls.sql";
const PINNED_POST_KEY = "internal-social-pinned-post-id";

function displayName(profile?: Profile | null) {
  const full = (profile?.full_name ?? "").trim();
  if (full && !full.includes("@")) return full;
  return (profile?.email ?? "Colaborador").trim() || "Colaborador";
}

function profileRoleLine(profile?: Profile | null) {
  const parts = [(profile?.cargo ?? "").trim(), (profile?.setor ?? "").trim()].filter(Boolean);
  return parts.length ? parts.join(" | ") : "Cargo e setor não informados";
}

function slugifyHandle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildMentionDirectory(items: Profile[]) {
  const usedHandles = new Set<string>();
  const byHandle = new Map<string, { id: string; label: string }>();
  const byUserId = new Map<string, { handle: string; label: string }>();

  for (const profile of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const label = displayName(profile);
    const base =
      slugifyHandle(label) ||
      slugifyHandle((profile.email ?? "").split("@")[0] ?? "") ||
      profile.id.slice(0, 8).toLowerCase();
    if (!base) continue;
    let nextHandle = base;
    let suffix = 2;
    while (usedHandles.has(nextHandle)) {
      nextHandle = `${base}-${suffix}`;
      suffix += 1;
    }
    usedHandles.add(nextHandle);
    const payload = { handle: nextHandle, label };
    byHandle.set(nextHandle, { id: profile.id, label });
    byUserId.set(profile.id, payload);
  }

  return { byHandle, byUserId };
}

function postTypeLabel(value: PostType | string | null | undefined) {
  if (value === "announcement") return "Comunicado";
  if (value === "campaign") return "Campanha";
  if (value === "event") return "Evento";
  if (value === "recognition") return "Reconhecimento";
  return "Social";
}

function isOfficialPostType(value: PostType | string | null | undefined) {
  return value === "announcement" || value === "campaign";
}

function roleOfficialLabel(role: string | null | undefined) {
  if (role === "rh") return "RH";
  if (role === "diretoria") return "Diretoria";
  if (role === "admin") return "Admin";
  return null;
}

function formatMonthDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function daysUntilDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function extractHashtagsFromValue(value: string) {
  const matches = value.match(/(^|[\s(])#([a-z0-9][a-z0-9_-]{1,49})/gi) ?? [];
  const tags = new Set<string>();
  for (const item of matches) {
    const normalized = item.trim();
    const hashIndex = normalized.indexOf("#");
    const tag = (hashIndex >= 0 ? normalized.slice(hashIndex + 1) : normalized).toLowerCase();
    if (tag) tags.add(tag);
  }
  return [...tags];
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function conversationDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hoje";
  const today = new Date();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((base.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function lastSeenLabel(value: string | null | undefined) {
  if (!value) return "Offline";
  const date = new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "Offline";
  const diffMinutes = Math.max(0, Math.round((Date.now() - ms) / (1000 * 60)));
  if (diffMinutes < 1) return "Offline • último acesso agora";
  if (diffMinutes < 60) return `Offline • último acesso há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Offline • último acesso há ${diffHours} h`;
  return `Offline • último acesso em ${date.toLocaleDateString("pt-BR")}`;
}

function highlightMatch(text: string, term: string) {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function splitMessageContent(text: string) {
  const lines = text.split("\n");
  const attachmentLines = lines.filter((line) => line.trim().toLowerCase().startsWith("anexo:"));
  const bodyLines = lines.filter((line) => !line.trim().toLowerCase().startsWith("anexo:"));
  const attachmentRefs = attachmentLines
    .map((line) => line.replace(/^anexo:\s*/i, "").trim())
    .filter(Boolean);
  return {
    body: bodyLines.join("\n").trim(),
    attachmentRefs,
  };
}

function inferAttachmentTypeFromUrl(url: string): AttachmentType {
  const lower = url.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|#|$)/.test(lower)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(lower)) return "video";
  return "link";
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("could not find the table") || lower.includes("schema cache") || lower.includes("does not exist")) {
    return `A rede social interna ainda não está configurada no banco. Rode a migration ${MIGRATION} no Supabase e tente novamente.`;
  }
  if (lower.includes("internal_social_notifications") || lower.includes("internal_social_saved_posts") || lower.includes("internal_social_mentions")) {
    return `Os recursos novos do PulseHub dependem da migration ${QUICKWINS_MIGRATION}. Rode a migration no Supabase e tente novamente.`;
  }
  if (
    lower.includes("internal_social_groups") ||
    lower.includes("internal_social_polls") ||
    lower.includes("internal_social_reports") ||
    lower.includes("audience_group_id")
  ) {
    return `Comunidades, enquetes e moderacao dependem da migration ${COMMUNITIES_MIGRATION}. Rode a migration no Supabase e tente novamente.`;
  }
  if (lower.includes("hidden_at") || lower.includes("hidden_reason")) {
    return `Os controles ampliados de moderacao dependem da migration ${HOME_ANALYTICS_MIGRATION}. Rode a migration no Supabase e tente novamente.`;
  }
  return message;
}

function isSchemaCompatError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("does not exist") || lower.includes("could not find the table") || lower.includes("column");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInlineRichText(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>");
}

function linkifySocialText(
  value: string,
  mentionDirectory?: Map<string, { id: string; label: string }>
) {
  return value
    .replace(/(^|[\s(])@([a-z0-9._-]{2,50})/gi, (match, prefix: string, handle: string) => {
      const mention = mentionDirectory?.get(handle.toLowerCase());
      if (!mention) return match;
      return `${prefix}<a href="/institucional/rede-social/membros/${mention.id}" class="font-semibold text-[#0a66c2] no-underline hover:underline">@${escapeHtml(mention.label)}</a>`;
    })
    .replace(/(^|[\s(])#([a-z0-9][a-z0-9_-]{1,49})/gi, (_match, prefix: string, tag: string) => {
      const safeTag = escapeHtml(tag.toLowerCase());
      return `${prefix}<a href="/institucional/rede-social?tag=${encodeURIComponent(tag.toLowerCase())}" class="font-semibold text-emerald-700 no-underline hover:underline">#${safeTag}</a>`;
    });
}

function renderRichTextHtml(value: string, mentionDirectory?: Map<string, { id: string; label: string }>) {
  const lines = value.split("\n");
  const parts: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    parts.push(`<p>${paragraph.map((line) => linkifySocialText(formatInlineRichText(line), mentionDirectory)).join("<br />")}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;
    parts.push(
      `<ul>${listItems.map((item) => `<li>${linkifySocialText(formatInlineRichText(item), mentionDirectory)}</li>`).join("")}</ul>`
    );
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.trimStart().startsWith("- ")) {
      flushParagraph();
      listItems.push(line.trimStart().slice(2));
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return parts.join("");
}

function RichText({
  value,
  className,
  mentionDirectory,
}: {
  value: string;
  className?: string;
  mentionDirectory?: Map<string, { id: string; label: string }>;
}) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderRichTextHtml(value, mentionDirectory) }} />;
}

function emojiToCodepoints(value: string) {
  return Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter(Boolean)
    .join("-");
}

function isCountryFlagEmoji(value: string) {
  const chars = Array.from(value);
  return chars.length === 2 && chars.every((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code >= 0x1f1e6 && code <= 0x1f1ff;
  });
}

function EmojiGlyph({ emoji, className }: { emoji: string; className?: string }) {
  if (isCountryFlagEmoji(emoji)) {
    return (
      <Image
        src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${emojiToCodepoints(emoji)}.svg`}
        alt={emoji}
        width={20}
        height={20}
        unoptimized
        className={className ?? "h-5 w-5"}
      />
    );
  }

  return <span className={className}>{emoji}</span>;
}

type EmojiPickerProps = {
  groups: EmojiGroup[];
  onSelect: (emoji: string) => void;
  className?: string;
  panelClassName?: string;
};

type RichTextAction = "bold" | "italic" | "underline" | "bullet";

function RichTextToolbar({
  onAction,
  compact = false,
}: {
  onAction: (action: RichTextAction) => void;
  compact?: boolean;
}) {
  const buttonClass = compact
    ? "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    : "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onAction("bold")} className={buttonClass}>B</button>
      <button type="button" onClick={() => onAction("italic")} className={`${buttonClass} italic`}>I</button>
      <button type="button" onClick={() => onAction("underline")} className={`${buttonClass} underline`}>U</button>
      <button type="button" onClick={() => onAction("bullet")} className={buttonClass}>Lista</button>
    </div>
  );
}

function EmojiPicker({ groups, onSelect, className, panelClassName }: EmojiPickerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeGroupId, setActiveGroupId] = useState(groups[0]?.id ?? "");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    function syncActiveGroup() {
      const currentContainer = scrollRef.current;
      if (!currentContainer) return;
      const top = currentContainer.scrollTop + 12;
      let current = groups[0]?.id ?? "";
      for (const group of groups) {
        const section = sectionRefs.current[group.id];
        if (!section) continue;
        if (section.offsetTop <= top) current = group.id;
      }
      setActiveGroupId((prev) => (prev === current ? prev : current));
    }

    syncActiveGroup();
    container.addEventListener("scroll", syncActiveGroup, { passive: true });
    return () => container.removeEventListener("scroll", syncActiveGroup);
  }, [groups]);

  function scrollToGroup(groupId: string) {
    const container = scrollRef.current;
    const section = sectionRefs.current[groupId];
    if (!container || !section) return;
    container.scrollTo({ top: section.offsetTop, behavior: "smooth" });
    setActiveGroupId(groupId);
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap gap-2">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            title={group.label}
            aria-label={group.label}
            onClick={() => scrollToGroup(group.id)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-lg transition ${
              activeGroupId === group.id
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <EmojiGlyph emoji={group.icon} className="h-5 w-5 text-[1.2rem] leading-none" />
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        className={`overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 ${panelClassName ?? "max-h-56"}`}
      >
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.id}
              ref={(node) => {
                sectionRefs.current[group.id] = node;
              }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <EmojiGlyph emoji={group.icon} className="h-4 w-4 text-base leading-none" />
                <span>{group.label}</span>
              </div>
              <div className="grid grid-cols-7 gap-2 sm:grid-cols-8">
                {group.emojis.map((emoji) => (
                  <button
                    key={`${group.id}-${emoji}`}
                    type="button"
                    onClick={() => onSelect(emoji)}
                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 text-lg transition hover:bg-slate-100"
                  >
                    <EmojiGlyph emoji={emoji} className="h-6 w-6 text-[1.35rem] leading-none" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const PROJECT_BOARD_TEMPLATE = [
  "Contexto:",
  "",
  "Riscos:",
  "",
  "Combinados:",
  "",
  "Proximos passos:",
].join("\n");

export default function InternalSocialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMemberRow[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState<PostType>("social");
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [scopeType, setScopeType] = useState<"company" | "project" | "group">("company");
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageAttachments, setMessageAttachments] = useState<DraftAttachment[]>([]);
  const [messageDropActive, setMessageDropActive] = useState(false);
  const [showMessageEmojiPicker, setShowMessageEmojiPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [editingPostId, setEditingPostId] = useState("");
  const [editingPostText, setEditingPostText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentText, setEditingCommentText] = useState("");
  const [pinnedPostId, setPinnedPostId] = useState("");
  const [projectTeamMap, setProjectTeamMap] = useState<Record<string, Profile[]>>({});
  const [projectBoardProjectId, setProjectBoardProjectId] = useState("");
  const [projectNotes, setProjectNotes] = useState<Record<string, string>>({});
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"inicio" | "network" | "communities" | "projects" | "messages">("inicio");
  const [messageFilter, setMessageFilter] = useState<"all" | "online" | "with_history">("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [search, setSearch] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [searchDropdownIndex, setSearchDropdownIndex] = useState(-1);
  const [feedFilter, setFeedFilter] = useState<"all" | "official" | "saved">("all");
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; lastSeenAt: string | null }>>({});
  const [messageMediaUrls, setMessageMediaUrls] = useState<Record<string, string>>({});
  const [readThreadAt, setReadThreadAt] = useState<Record<string, string>>({});
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [birthdayHighlights, setBirthdayHighlights] = useState<SocialHighlightRow[]>([]);
  const [newHireHighlights, setNewHireHighlights] = useState<SocialHighlightRow[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showComposerMentionPicker, setShowComposerMentionPicker] = useState(false);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [communityFilter, setCommunityFilter] = useState<"all" | "joined" | "discover">("all");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const messageFileInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editingPostTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function resolvePostAttachmentUrls(items: AttachmentRow[]) {
    const toResolve = items.filter((item) => item.url && !isAbsoluteUrl(item.url));
    if (!toResolve.length) return items;

    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    const res = await fetch("/api/institucional/rede-social/media-urls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        items: toResolve.map((item) => ({
          kind: "post",
          ownerId: item.post_id,
          path: item.url,
        })),
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      items?: Array<{ ownerId: string; path: string; signedUrl: string }>;
    };

    if (!res.ok) return items;

    const signedMap = new Map<string, string>();
    for (const item of json.items ?? []) {
      signedMap.set(`${item.ownerId}:${item.path}`, item.signedUrl);
    }

    return items.map((item) => ({
      ...item,
      resolvedUrl: signedMap.get(`${item.post_id}:${item.url}`) ?? (isAbsoluteUrl(item.url) ? item.url : ""),
    }));
  }

  async function resolveMessageAttachmentUrls(items: MessageRow[]) {
    const attachmentItems = items.flatMap((item) => {
      const parsed = splitMessageContent(item.text);
      return parsed.attachmentRefs
        .filter((ref) => !isAbsoluteUrl(ref))
        .map((ref) => ({
          kind: "message" as const,
          ownerId: item.id,
          path: ref,
        }));
    });

    if (!attachmentItems.length) {
      setMessageMediaUrls({});
      return;
    }

    const deduped = Array.from(
      new Map(attachmentItems.map((item) => [`${item.ownerId}:${item.path}`, item])).values()
    );

    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    const res = await fetch("/api/institucional/rede-social/media-urls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ items: deduped }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      items?: Array<{ ownerId: string; path: string; signedUrl: string }>;
    };

    if (!res.ok) {
      setMessageMediaUrls({});
      return;
    }

    const nextMap: Record<string, string> = {};
    for (const item of json.items ?? []) {
      nextMap[`${item.ownerId}:${item.path}`] = item.signedUrl;
    }
    setMessageMediaUrls(nextMap);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user) throw new Error("Sessao invalida.");
      const userId = auth.data.user.id;

      const [profilesRes, memberRes, msgRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,role,avatar_url").order("full_name", { ascending: true }),
        supabase.from("project_members").select("project_id").eq("user_id", userId),
        supabase
          .from("internal_social_direct_messages")
          .select("id,from_user_id,from_name,to_user_id,text,created_at")
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .order("created_at", { ascending: true }),
      ]);

      const postsResWithQuickWins = await supabase
        .from("internal_social_posts")
        .select(
          "id,author_user_id,author_name,author_avatar_url,audience_type,audience_project_id,audience_group_id,audience_label,text,post_type,official_author_label,hidden_at,hidden_reason,created_at"
        )
        .order("created_at", { ascending: false });
      let postsError = postsResWithQuickWins.error;
      let postRowsSource = (postsResWithQuickWins.data ?? []) as PostRow[];
      if (postsError && isSchemaCompatError(postsError.message)) {
        const legacyPostsRes = await supabase
          .from("internal_social_posts")
          .select("id,author_user_id,author_name,author_avatar_url,audience_type,audience_project_id,audience_label,text,created_at")
          .order("created_at", { ascending: false });
        postsError = legacyPostsRes.error;
        postRowsSource = ((legacyPostsRes.data ?? []) as PostRow[]).map((item) => ({
          ...item,
          audience_group_id: null,
          post_type: "social",
          official_author_label: null,
          hidden_at: null,
          hidden_reason: null,
        }));
      }

      if (profilesRes.error) throw new Error(profilesRes.error.message);
      if (memberRes.error) throw new Error(memberRes.error.message);
      if (postsError) throw new Error(postsError.message);
      if (msgRes.error) throw new Error(msgRes.error.message);

      const baseProfiles = (profilesRes.data ?? []) as Profile[];
      let nextProfiles = baseProfiles.map((profile) => ({
        ...profile,
        avatar_url: resolvePortalAvatarUrl(profile.avatar_url ?? null),
      }));

      if (baseProfiles.length) {
        const collaboratorRes = await supabase
          .from("colaboradores")
          .select("user_id,nome,cargo,setor,data_nascimento,data_admissao,is_active")
          .in(
            "user_id",
            baseProfiles.map((item) => item.id)
          );
        if (!collaboratorRes.error) {
          const collaboratorByUserId = new Map<string, CollaboratorDirectoryRow>();
          for (const item of (collaboratorRes.data ?? []) as CollaboratorDirectoryRow[]) {
            if (item.user_id) collaboratorByUserId.set(item.user_id, item);
          }

          nextProfiles = nextProfiles.map((profile) => {
            const collaborator = collaboratorByUserId.get(profile.id);
            const fallbackName = (collaborator?.nome ?? "").trim();
            const currentFullName = (profile.full_name ?? "").trim();
            const safeFullName =
              currentFullName && !currentFullName.includes("@")
                ? currentFullName
                : fallbackName && !fallbackName.includes("@")
                  ? fallbackName
                  : currentFullName || fallbackName || null;
            return {
              ...profile,
              full_name: safeFullName,
              cargo: (collaborator?.cargo ?? "").trim() || null,
              setor: (collaborator?.setor ?? "").trim() || null,
            };
          });

          const birthdayRows = nextProfiles
            .map((profile) => {
              const collaborator = collaboratorByUserId.get(profile.id);
              const birthDate = (collaborator?.data_nascimento ?? "").trim();
              if (!birthDate || collaborator?.is_active === false) return null;
              const daysLeft = daysUntilDate(birthDate);
              if (daysLeft === null || daysLeft > 30) return null;
              return {
                userId: profile.id,
                name: displayName(profile),
                subtitle: profileRoleLine(profile),
                dateLabel: daysLeft === 0 ? "Hoje" : formatMonthDay(birthDate),
                avatarUrl: profile.avatar_url ?? null,
                sortOrder: daysLeft,
              };
            })
            .filter(
              (
                item
              ): item is SocialHighlightRow & {
                sortOrder: number;
              } => Boolean(item)
            )
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .slice(0, 4)
            .map((item) => ({
              userId: item.userId,
              name: item.name,
              subtitle: item.subtitle,
              dateLabel: item.dateLabel,
              avatarUrl: item.avatarUrl,
            }));
          setBirthdayHighlights(birthdayRows);

          const now = Date.now();
          const newHires = nextProfiles
            .map((profile) => {
              const collaborator = collaboratorByUserId.get(profile.id);
              const admissionDate = (collaborator?.data_admissao ?? "").trim();
              const admissionMs = admissionDate ? new Date(`${admissionDate}T00:00:00`).getTime() : Number.NaN;
              if (!admissionDate || Number.isNaN(admissionMs) || collaborator?.is_active === false) return null;
              const ageDays = Math.round((now - admissionMs) / (1000 * 60 * 60 * 24));
              if (ageDays < 0 || ageDays > 45) return null;
              return {
                userId: profile.id,
                name: displayName(profile),
                subtitle: profileRoleLine(profile),
                dateLabel: formatMonthDay(admissionDate),
                avatarUrl: profile.avatar_url ?? null,
                sortOrder: ageDays,
              };
            })
            .filter(
              (
                item
              ): item is SocialHighlightRow & {
                sortOrder: number;
              } => Boolean(item)
            )
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .slice(0, 4)
            .map((item) => ({
              userId: item.userId,
              name: item.name,
              subtitle: item.subtitle,
              dateLabel: item.dateLabel,
              avatarUrl: item.avatarUrl,
            }));
          setNewHireHighlights(newHires);
        } else {
          setBirthdayHighlights([]);
          setNewHireHighlights([]);
        }
      } else {
        setBirthdayHighlights([]);
        setNewHireHighlights([]);
      }
      setProfiles(nextProfiles);
      setMe(nextProfiles.find((item) => item.id === userId) ?? null);
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (token && nextProfiles.length) {
          const presenceRes = await fetch("/api/institucional/presence", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ userIds: nextProfiles.map((item) => item.id) }),
          });
          const presenceJson = (await presenceRes.json().catch(() => ({}))) as {
            presence?: Record<string, { online: boolean; lastSeenAt: string | null }>;
          };
          setPresenceMap(presenceRes.ok ? presenceJson.presence ?? {} : {});
        } else {
          setPresenceMap({});
        }
      } catch {
        setPresenceMap({});
      }

      const projectIds = Array.from(new Set(((memberRes.data ?? []) as Array<{ project_id: string }>).map((item) => item.project_id)));
      if (projectIds.length) {
        const projectRes = await supabase.from("projects").select("id,name").in("id", projectIds).order("name", { ascending: true });
        if (projectRes.error) throw new Error(projectRes.error.message);
        const nextProjects = (projectRes.data ?? []) as Project[];
        setProjects(nextProjects);
        setProjectBoardProjectId((prev) => prev || nextProjects[0]?.id || "");
        const teamRes = await supabase.from("project_members").select("project_id,user_id").in("project_id", projectIds);
        if (teamRes.error) throw new Error(teamRes.error.message);
        const nextProjectTeamMap: Record<string, Profile[]> = {};
        for (const row of (teamRes.data ?? []) as Array<{ project_id: string; user_id: string }>) {
          const profile = nextProfiles.find((item) => item.id === row.user_id);
          if (!profile) continue;
          if (!nextProjectTeamMap[row.project_id]) nextProjectTeamMap[row.project_id] = [];
          if (!nextProjectTeamMap[row.project_id].some((item) => item.id === profile.id)) {
            nextProjectTeamMap[row.project_id].push(profile);
          }
        }
        setProjectTeamMap(nextProjectTeamMap);
        try {
          const boardRes = await supabase
            .from("internal_social_project_boards")
            .select("project_id,notes")
            .in("project_id", projectIds);
          if (!boardRes.error) {
            const nextNotes: Record<string, string> = {};
            for (const row of (boardRes.data ?? []) as Array<{ project_id: string; notes: string | null }>) {
              nextNotes[row.project_id] = row.notes ?? "";
            }
            setProjectNotes(nextNotes);
          } else if (!isSchemaCompatError(boardRes.error.message)) {
            throw new Error(boardRes.error.message);
          }
        } catch (boardErr) {
          if (!isSchemaCompatError(boardErr instanceof Error ? boardErr.message : "")) throw boardErr;
        }
      } else {
        setProjects([]);
        setProjectBoardProjectId("");
        setProjectTeamMap({});
      }

      try {
        const [groupsRes, groupMembersRes] = await Promise.all([
          supabase
            .from("internal_social_groups")
            .select("id,name,slug,description,cover_color,is_private")
            .order("name", { ascending: true }),
          supabase
            .from("internal_social_group_members")
            .select("group_id,user_id,role"),
        ]);
        if (!groupsRes.error) {
          const nextGroups = (groupsRes.data ?? []) as Group[];
          setGroups(nextGroups);
          setSelectedCommunityId((prev) => prev || nextGroups[0]?.id || "");
        } else if (isSchemaCompatError(groupsRes.error.message)) {
          setGroups([]);
          setSelectedCommunityId("");
        } else {
          throw new Error(groupsRes.error.message);
        }
        if (!groupMembersRes.error) {
          setGroupMembers((groupMembersRes.data ?? []) as GroupMemberRow[]);
        } else if (isSchemaCompatError(groupMembersRes.error.message)) {
          setGroupMembers([]);
        } else {
          throw new Error(groupMembersRes.error.message);
        }
      } catch (groupsErr) {
        if (!isSchemaCompatError(groupsErr instanceof Error ? groupsErr.message : "")) throw groupsErr;
        setGroups([]);
        setGroupMembers([]);
        setSelectedCommunityId("");
      }

      const postRows = postRowsSource;
      const postIds = postRows.map((item) => item.id);
      const [attachmentsRes, commentsRes, reactionsRes, pollsRes, pollOptionsRes, pollVotesRes, reportsRes] = await Promise.all([
        postIds.length
          ? supabase
              .from("internal_social_post_attachments")
              .select("id,post_id,type,url,label")
              .in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase
              .from("internal_social_post_comments")
              .select("id,post_id,author_user_id,author_name,text,created_at")
              .in("post_id", postIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from("internal_social_post_reactions").select("id,post_id,user_id,emoji").in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from("internal_social_polls").select("id,post_id,question,allow_multiple").in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from("internal_social_poll_options").select("id,poll_id,label,position")
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase.from("internal_social_poll_votes").select("id,poll_id,option_id,user_id")
          : Promise.resolve({ data: [], error: null }),
        postIds.length
          ? supabase
              .from("internal_social_reports")
              .select("id,reporter_user_id,target_type,post_id,comment_id,reason,details,status,reviewed_by,reviewed_at,created_at")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);
      if (commentsRes.error) throw new Error(commentsRes.error.message);
      if (reactionsRes.error) throw new Error(reactionsRes.error.message);
      if (pollsRes.error && !isSchemaCompatError(pollsRes.error.message)) throw new Error(pollsRes.error.message);
      if (pollOptionsRes.error && !isSchemaCompatError(pollOptionsRes.error.message)) throw new Error(pollOptionsRes.error.message);
      if (pollVotesRes.error && !isSchemaCompatError(pollVotesRes.error.message)) throw new Error(pollVotesRes.error.message);
      if (reportsRes.error && !isSchemaCompatError(reportsRes.error.message)) throw new Error(reportsRes.error.message);

      const resolvedAttachments = await resolvePostAttachmentUrls((attachmentsRes.data ?? []) as AttachmentRow[]);
      const attachmentMap = new Map<string, AttachmentRow[]>();
      for (const item of resolvedAttachments) {
        const list = attachmentMap.get(item.post_id) ?? [];
        list.push(item);
        attachmentMap.set(item.post_id, list);
      }

      const commentMap = new Map<string, CommentRow[]>();
      for (const item of (commentsRes.data ?? []) as CommentRow[]) {
        const list = commentMap.get(item.post_id) ?? [];
        list.push(item);
        commentMap.set(item.post_id, list);
      }

      const reactionMap = new Map<string, ReactionRow[]>();
      for (const item of (reactionsRes.data ?? []) as ReactionRow[]) {
        const list = reactionMap.get(item.post_id) ?? [];
        list.push(item);
        reactionMap.set(item.post_id, list);
      }

      const pollsByPostId = new Map<string, FeedPoll>();
      const pollIds = new Set<string>();
      for (const poll of (pollsRes.data ?? []) as Array<{ id: string; post_id: string; question: string; allow_multiple: boolean }>) {
        pollsByPostId.set(poll.post_id, {
          id: poll.id,
          post_id: poll.post_id,
          question: poll.question,
          allow_multiple: poll.allow_multiple,
          options: [],
        });
        pollIds.add(poll.id);
      }
      const votesByOptionId = new Map<string, number>();
      const myVotes = new Set<string>();
      for (const vote of (pollVotesRes.data ?? []) as Array<{ poll_id: string; option_id: string; user_id: string }>) {
        if (!pollIds.has(vote.poll_id)) continue;
        votesByOptionId.set(vote.option_id, (votesByOptionId.get(vote.option_id) ?? 0) + 1);
        if (vote.user_id === userId) myVotes.add(vote.option_id);
      }
      for (const option of (pollOptionsRes.data ?? []) as Array<{ id: string; poll_id: string; label: string; position: number }>) {
        const poll = [...pollsByPostId.values()].find((item) => item.id === option.poll_id);
        if (!poll) continue;
        poll.options.push({
          id: option.id,
          poll_id: option.poll_id,
          label: option.label,
          position: option.position,
          votes: votesByOptionId.get(option.id) ?? 0,
          votedByMe: myVotes.has(option.id),
        });
        poll.options.sort((a, b) => a.position - b.position);
      }

      const reportRows = ((reportsRes.data ?? []) as ReportRow[]).filter((item) => item.target_type === "post");
      setReports(reportRows);
      const reportsByPostId = new Map<string, ReportRow[]>();
      for (const report of reportRows) {
        if (!report.post_id) continue;
        const list = reportsByPostId.get(report.post_id) ?? [];
        list.push(report);
        reportsByPostId.set(report.post_id, list);
      }

      setPosts(
        postRows.map((item) => ({
          ...item,
          attachments: attachmentMap.get(item.id) ?? [],
          comments: commentMap.get(item.id) ?? [],
          reactions: reactionMap.get(item.id) ?? [],
          poll: pollsByPostId.get(item.id) ?? null,
          reportsCount: reportsByPostId.get(item.id)?.length ?? 0,
          isReportedByMe: (reportsByPostId.get(item.id) ?? []).some((report) => report.reporter_user_id === userId),
        }))
      );

      try {
        const savedRes = await supabase.from("internal_social_saved_posts").select("post_id").eq("user_id", userId);
        if (!savedRes.error) {
          setSavedPostIds(((savedRes.data ?? []) as Array<{ post_id: string }>).map((item) => item.post_id));
        } else if (isSchemaCompatError(savedRes.error.message)) {
          setSavedPostIds([]);
        } else {
          throw new Error(savedRes.error.message);
        }
      } catch (savedErr) {
        if (!isSchemaCompatError(savedErr instanceof Error ? savedErr.message : "")) throw savedErr;
        setSavedPostIds([]);
      }

      try {
        const notificationsRes = await supabase
          .from("internal_social_notifications")
          .select("id,user_id,actor_user_id,kind,entity_type,entity_id,title,body,link_url,read_at,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!notificationsRes.error) {
          setNotifications((notificationsRes.data ?? []) as NotificationRow[]);
        } else if (isSchemaCompatError(notificationsRes.error.message)) {
          setNotifications([]);
        } else {
          throw new Error(notificationsRes.error.message);
        }
      } catch (notificationsErr) {
        if (!isSchemaCompatError(notificationsErr instanceof Error ? notificationsErr.message : "")) throw notificationsErr;
        setNotifications([]);
      }

      try {
        const pinnedRes = await supabase
          .from("internal_social_posts")
          .select("id")
          .eq("is_pinned", true)
          .limit(1)
          .maybeSingle<{ id: string }>();
        if (!pinnedRes.error) {
          setPinnedPostId(pinnedRes.data?.id ?? "");
        } else if (typeof window !== "undefined" && isSchemaCompatError(pinnedRes.error.message)) {
          setPinnedPostId(window.localStorage.getItem(PINNED_POST_KEY) ?? "");
        } else {
          throw new Error(pinnedRes.error.message);
        }
      } catch (pinnedErr) {
        if (!isSchemaCompatError(pinnedErr instanceof Error ? pinnedErr.message : "")) throw pinnedErr;
      }
      const nextMessages = (msgRes.data ?? []) as MessageRow[];
      setMessages(nextMessages);
      await resolveMessageAttachmentUrls(nextMessages);
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao carregar rede social."));
    } finally {
      setLoading(false);
    }
  }

  // `load` is intentionally invoked on mount and realtime updates; keeping this effect stable avoids unnecessary refetch churn.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void load();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const user = params.get("user");
    const project = params.get("project");
    const tag = params.get("tag");
    const community = params.get("community");
    if (tab === "inicio" || tab === "network" || tab === "communities" || tab === "projects" || tab === "messages") {
      setActiveTab(tab);
    }
    if (user) setSelectedUserId(user);
    if (project) setProjectBoardProjectId(project);
    if (community) setSelectedCommunityId(community);
    if (tag) {
      setSearch(`#${tag}`);
      setSearchSubmitted(true);
      setActiveTab("inicio");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPinnedPostId(window.localStorage.getItem(PINNED_POST_KEY) ?? "");
    try {
      const raw = window.localStorage.getItem("internal-social-project-notes");
      if (raw) setProjectNotes(JSON.parse(raw) as Record<string, string>);
    } catch {}
  }, []);

  // Realtime refresh depends on the authenticated user channel; `load` remains intentionally stable by call-site.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!me?.id) return;
    const channel = supabase
      .channel(`internal-social-live-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_social_posts" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_social_post_comments" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_social_post_reactions" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_social_direct_messages" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me?.id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const profile of profiles) map.set(profile.id, profile);
    return map;
  }, [profiles]);
  const mentionDirectory = useMemo(() => buildMentionDirectory(profiles), [profiles]);
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );
  const canPublishOfficial = me?.role === "admin" || me?.role === "diretoria" || me?.role === "rh";
  const composerMentionOptions = useMemo(() => {
    const term = mentionQuery.trim().toLowerCase();
    return profiles
      .filter((item) => item.id !== me?.id)
      .filter((item) => {
        const mentionMeta = mentionDirectory.byUserId.get(item.id);
        if (!mentionMeta) return false;
        if (!term) return true;
        const haystack = `${mentionMeta.handle} ${mentionMeta.label} ${(item.cargo ?? "").trim()} ${(item.setor ?? "").trim()}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 10);
  }, [mentionDirectory.byUserId, mentionQuery, me?.id, profiles]);

  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const searchPlaceholder = useMemo(() => {
    if (activeTab === "network") return "Pesquisar membros da rede";
    if (activeTab === "communities") return "Pesquisar comunidades";
    if (activeTab === "projects") return "Pesquisar projetos";
    if (activeTab === "messages") return "Pesquisar conversas";
    return "Pesquisar publicações na rede";
  }, [activeTab]);
  const contacts = useMemo(() => profiles.filter((item) => item.id !== me?.id), [profiles, me?.id]);
  const activeThread = useMemo(() => {
    if (!me?.id || !selectedUserId) return [] as MessageRow[];
    return messages.filter(
      (item) =>
        (item.from_user_id === me.id && item.to_user_id === selectedUserId) ||
        (item.from_user_id === selectedUserId && item.to_user_id === me.id)
    );
  }, [messages, me?.id, selectedUserId]);
  const canModeratePosts = me?.role === "admin" || me?.role === "diretoria";
  const visiblePostsForRole = useMemo(
    () => posts.filter((item) => canModeratePosts || !item.hidden_at),
    [canModeratePosts, posts]
  );
  const pinnedPost = useMemo(
    () => visiblePostsForRole.find((item) => item.id === pinnedPostId) ?? null,
    [visiblePostsForRole, pinnedPostId]
  );
  const feedPosts = useMemo(
    () => visiblePostsForRole.filter((item) => item.id !== pinnedPostId),
    [visiblePostsForRole, pinnedPostId]
  );
  const editingPost = useMemo(() => posts.find((item) => item.id === editingPostId) ?? null, [editingPostId, posts]);
  const selectedProjectBoard = useMemo(
    () => projects.find((item) => item.id === projectBoardProjectId) ?? null,
    [projects, projectBoardProjectId]
  );
  const selectedCommunity = useMemo(
    () => groups.find((item) => item.id === selectedCommunityId) ?? null,
    [groups, selectedCommunityId]
  );
  const joinedGroupIds = useMemo(
    () =>
      new Set(
        groupMembers.filter((item) => item.user_id === me?.id).map((item) => item.group_id)
      ),
    [groupMembers, me?.id]
  );
  const onlineUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [userId, meta] of Object.entries(presenceMap)) {
      if (meta.online) ids.add(userId);
    }
    return ids;
  }, [presenceMap]);
  const recentConversationContacts = useMemo(() => {
      const lastByUser = new Map<string, number>();
      for (const item of messages) {
        if (!me?.id) continue;
        const otherId = item.from_user_id === me.id ? item.to_user_id : item.from_user_id;
        const stamp = new Date(item.created_at).getTime();
        const prev = lastByUser.get(otherId) ?? 0;
        if (stamp > prev) lastByUser.set(otherId, stamp);
      }
      return [...contacts].sort((a, b) => {
        const aOnline = presenceMap[a.id]?.online ? 1 : 0;
        const bOnline = presenceMap[b.id]?.online ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return (lastByUser.get(b.id) ?? 0) - (lastByUser.get(a.id) ?? 0);
      });
    }, [contacts, me?.id, messages, presenceMap]);
  const filteredConversationContacts = useMemo(() => {
    if (messageFilter === "online") {
      return recentConversationContacts.filter((contact) => onlineUserIds.has(contact.id));
    }
    if (messageFilter === "with_history") {
      return recentConversationContacts.filter((contact) =>
        messages.some(
          (item) =>
            (item.from_user_id === me?.id && item.to_user_id === contact.id) ||
            (item.from_user_id === contact.id && item.to_user_id === me?.id)
        )
      );
    }
    return recentConversationContacts;
  }, [messageFilter, messages, me?.id, onlineUserIds, recentConversationContacts]);
  const visibleContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    return contacts.filter((contact) => {
      const haystack = [
        displayName(contact),
        (contact.cargo ?? "").trim(),
        (contact.setor ?? "").trim(),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [contacts, searchTerm]);
  const visibleProjects = useMemo(() => {
    if (!searchTerm) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(searchTerm));
  }, [projects, searchTerm]);
  const visibleGroups = useMemo(() => {
    const base = groups.filter((group) => {
      if (communityFilter === "joined") return joinedGroupIds.has(group.id);
      if (communityFilter === "discover") return !joinedGroupIds.has(group.id);
      return true;
    });
    if (!searchTerm) return base;
    return base.filter((group) => `${group.name} ${group.description}`.toLowerCase().includes(searchTerm));
  }, [communityFilter, groups, joinedGroupIds, searchTerm]);
  const officialPosts = useMemo(
    () => feedPosts.filter((item) => isOfficialPostType(item.post_type)).slice(0, 4),
    [feedPosts]
  );
  const topHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (post.hidden_at && !canModeratePosts) continue;
      for (const tag of extractHashtagsFromValue(post.text ?? "")) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [canModeratePosts, posts]);
  const engagementHighlights = useMemo(() => {
    const postCount = posts.filter((item) => !item.hidden_at).length;
    const officialCount = posts.filter((item) => !item.hidden_at && isOfficialPostType(item.post_type)).length;
    const pollCount = posts.filter((item) => item.poll).length;
    const openReports = reports.filter((item) => item.status === "open").length;
    return { postCount, officialCount, pollCount, openReports };
  }, [posts, reports]);
  const topAuthors = useMemo(() => {
    const counts = new Map<string, { userId: string; name: string; total: number }>();
    for (const post of posts) {
      if (post.hidden_at && !canModeratePosts) continue;
      const current = counts.get(post.author_user_id) ?? {
        userId: post.author_user_id,
        name: post.author_name || displayName(profileById.get(post.author_user_id)),
        total: 0,
      };
      current.total += 1;
      counts.set(post.author_user_id, current);
    }
    return [...counts.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [canModeratePosts, posts, profileById]);
  const visibleProjectTeamMap = useMemo(() => {
    if (!searchTerm) return projectTeamMap;
    const next: Record<string, Profile[]> = {};
    for (const [projectKey, members] of Object.entries(projectTeamMap)) {
      next[projectKey] = members.filter((member) => {
        const haystack = [
          displayName(member),
          (member.cargo ?? "").trim(),
          (member.setor ?? "").trim(),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchTerm);
      });
    }
    return next;
  }, [projectTeamMap, searchTerm]);
  const visibleFeedPosts = useMemo(() => {
    const filteredByMode = feedPosts.filter((post) => {
      if (feedFilter === "official") return isOfficialPostType(post.post_type);
      if (feedFilter === "saved") return savedPostIds.includes(post.id);
      return true;
    });
    if (!searchTerm) return filteredByMode;
    return filteredByMode.filter((post) => {
      const commentText = post.comments.map((item) => item.text).join(" ");
      const haystack = [post.author_name, post.audience_label, post.text, commentText].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [feedFilter, feedPosts, savedPostIds, searchTerm]);
  const visiblePinnedPost = useMemo(() => {
    if (!pinnedPost) return null;
    if (!searchTerm) return pinnedPost;
    const commentText = pinnedPost.comments.map((item) => item.text).join(" ");
    const haystack = [pinnedPost.author_name, pinnedPost.audience_label, pinnedPost.text, commentText].join(" ").toLowerCase();
    return haystack.includes(searchTerm) ? pinnedPost : null;
  }, [pinnedPost, searchTerm]);
  const visibleConversationContacts = useMemo(() => {
    if (!searchTerm) return filteredConversationContacts;
    return filteredConversationContacts.filter((contact) => {
      const haystack = [
        displayName(contact),
        (contact.cargo ?? "").trim(),
        (contact.setor ?? "").trim(),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [filteredConversationContacts, searchTerm]);
  const visibleMessagePanelContacts = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    if (!term) return visibleConversationContacts;
    return visibleConversationContacts.filter((contact) => {
      const haystack = [displayName(contact), (contact.cargo ?? "").trim(), (contact.setor ?? "").trim()]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [messageSearch, visibleConversationContacts]);
  const globalPeopleResults = useMemo(() => {
    if (!searchTerm) return [] as Profile[];
    return contacts.filter((contact) => {
      const haystack = [displayName(contact), (contact.cargo ?? "").trim(), (contact.setor ?? "").trim()].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [contacts, searchTerm]);
  const globalProjectResults = useMemo(() => {
    if (!searchTerm) return [] as Project[];
    return projects.filter((project) => project.name.toLowerCase().includes(searchTerm));
  }, [projects, searchTerm]);
  const globalPostResults = useMemo(() => {
    if (!searchTerm) return [] as FeedPost[];
    return posts.filter((post) => {
      const commentText = post.comments.map((item) => item.text).join(" ");
      const haystack = [post.author_name, post.audience_label, post.text, commentText].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [posts, searchTerm]);
  const globalConversationResults = useMemo(() => {
    if (!searchTerm) return [] as Profile[];
    return recentConversationContacts.filter((contact) => {
      const haystack = [
        displayName(contact),
        (contact.cargo ?? "").trim(),
        (contact.setor ?? "").trim(),
        messages
          .filter(
            (item) =>
              (item.from_user_id === me?.id && item.to_user_id === contact.id) ||
              (item.from_user_id === contact.id && item.to_user_id === me?.id)
          )
          .map((item) => item.text)
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [me?.id, messages, recentConversationContacts, searchTerm]);
  const searchSuggestions = useMemo(
    () => ({
      people: globalPeopleResults.slice(0, 3),
      posts: globalPostResults.slice(0, 3),
      projects: globalProjectResults.slice(0, 3),
      conversations: globalConversationResults.slice(0, 3),
    }),
    [globalConversationResults, globalPeopleResults, globalPostResults, globalProjectResults]
  );
  const searchSuggestionItems = useMemo<SearchSuggestionItem[]>(
    () => [
      ...searchSuggestions.people.map((person) => ({ key: `person-${person.id}`, kind: "person" as const, id: person.id })),
      ...searchSuggestions.posts.map((post) => ({ key: `post-${post.id}`, kind: "post" as const, id: post.id })),
      ...searchSuggestions.projects.map((project) => ({
        key: `project-${project.id}`,
        kind: "project" as const,
        id: project.id,
      })),
      ...searchSuggestions.conversations.map((person) => ({
        key: `conversation-${person.id}`,
        kind: "conversation" as const,
        id: person.id,
      })),
    ],
    [searchSuggestions]
  );
  const searchSuggestionIndexMap = useMemo(() => {
    const next = new Map<string, number>();
    searchSuggestionItems.forEach((item, index) => next.set(item.key, index));
    return next;
  }, [searchSuggestionItems]);
  const hasSearchSuggestions = useMemo(
    () =>
      searchTerm.length > 0 &&
      !searchSubmitted &&
      (searchSuggestions.people.length > 0 ||
        searchSuggestions.posts.length > 0 ||
        searchSuggestions.projects.length > 0 ||
        searchSuggestions.conversations.length > 0),
    [searchSubmitted, searchSuggestions, searchTerm]
  );
  function submitGeneralSearch() {
    if (!search.trim()) return;
    setSearchSubmitted(true);
    setSearchDropdownIndex(-1);
  }
  function selectSearchSuggestion(item: SearchSuggestionItem) {
    setSearchDropdownIndex(-1);
    if (item.kind === "person") {
      router.push(`/institucional/rede-social/membros/${item.id}`);
      return;
    }
    if (item.kind === "post") {
      setActiveTab("inicio");
      setSearchSubmitted(true);
      return;
    }
    if (item.kind === "project") {
      setActiveTab("projects");
      setProjectBoardProjectId(item.id);
      setSearchSubmitted(false);
      router.push(`/institucional/rede-social?tab=projects&project=${encodeURIComponent(item.id)}`);
      return;
    }
    setActiveTab("messages");
    setSelectedUserId(item.id);
    setSearchSubmitted(false);
    router.push(`/institucional/rede-social?tab=messages&user=${encodeURIComponent(item.id)}`);
  }
  const selectedMessageProfile = useMemo(
    () => profileById.get(selectedUserId) ?? contacts.find((item) => item.id === selectedUserId) ?? null,
    [contacts, profileById, selectedUserId]
  );

  const markThreadAsRead = useCallback((userId: string) => {
    if (!userId || !me?.id) return;
    const latestThreadAt = messages
      .filter(
        (item) =>
          (item.from_user_id === me.id && item.to_user_id === userId) ||
          (item.from_user_id === userId && item.to_user_id === me.id)
      )
      .map((item) => item.created_at)
      .sort()
      .at(-1);
    if (!latestThreadAt) return;
    setReadThreadAt((prev) => (prev[userId] === latestThreadAt ? prev : { ...prev, [userId]: latestThreadAt }));
  }, [me?.id, messages]);

  useEffect(() => {
    if (activeTab !== "messages" || !selectedUserId) return;
    markThreadAsRead(selectedUserId);
  }, [activeTab, markThreadAsRead, selectedUserId]);

  useEffect(() => {
    if (activeTab !== "messages" || !selectedUserId || !activeThread.length) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeTab, activeThread, selectedUserId]);

  useEffect(() => {
    if (activeTab !== "messages") return;
    if (!visibleMessagePanelContacts.length || !selectedUserId) {
      if (selectedUserId && !visibleMessagePanelContacts.length) setSelectedUserId("");
      return;
    }
    const selectedStillVisible = visibleMessagePanelContacts.some((contact) => contact.id === selectedUserId);
    if (!selectedStillVisible) {
      setSelectedUserId("");
    }
  }, [activeTab, selectedUserId, visibleMessagePanelContacts]);

  useEffect(() => {
    function handleDocumentPointerDown(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchDropdownIndex(-1);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocumentPointerDown);
    return () => document.removeEventListener("mousedown", handleDocumentPointerDown);
  }, []);

  useEffect(() => {
    if ((!composerExpanded && !editingPostId) || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    const frame = window.requestAnimationFrame(() => {
      if (editingPostId) editingPostTextareaRef.current?.focus();
      else composerTextareaRef.current?.focus();
    });
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (editingPostId) {
        cancelEditPost();
      } else {
        setComposerExpanded(false);
        setShowComposerEmojiPicker(false);
      }
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [composerExpanded, editingPostId]);

  function applyRichTextAction(
    action: RichTextAction,
    value: string,
    setValue: (nextValue: string) => void,
    textarea: HTMLTextAreaElement | null
  ) {
    if (!textarea) return;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    let nextValue = value;
    let nextStart = start;
    let nextEnd = end;

    if (action === "bullet") {
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEndCandidate = value.indexOf("\n", end);
      const lineEnd = lineEndCandidate === -1 ? value.length : lineEndCandidate;
      const segment = value.slice(lineStart, lineEnd);
      const updatedSegment = segment
        .split("\n")
        .map((line) => (line.trim() ? (line.trimStart().startsWith("- ") ? line : `- ${line}`) : line))
        .join("\n");
      nextValue = `${value.slice(0, lineStart)}${updatedSegment}${value.slice(lineEnd)}`;
      nextStart = lineStart;
      nextEnd = lineStart + updatedSegment.length;
    } else {
      const marker = action === "bold" ? "**" : action === "italic" ? "*" : "++";
      const fallback = action === "bold" ? "texto em negrito" : action === "italic" ? "texto em itálico" : "texto sublinhado";
      const content = selected || fallback;
      nextValue = `${value.slice(0, start)}${marker}${content}${marker}${value.slice(end)}`;
      const cursorBase = start + marker.length;
      nextStart = cursorBase;
      nextEnd = cursorBase + content.length;
    }

    setValue(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextStart, nextEnd);
    });
  }

  function insertTextAtCursor(
    value: string,
    setValue: (nextValue: string) => void,
    textarea: HTMLTextAreaElement | null,
    insertion: string
  ) {
    if (!textarea) {
      setValue(`${value}${insertion}`);
      return;
    }
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    const nextCursor = start + insertion.length;
    setValue(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function syncPulseHubEvent(payload: SyncBody) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      await fetch("/api/institucional/rede-social/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Mantem a acao principal funcionando mesmo se a sincronizacao auxiliar falhar.
    }
  }

  async function toggleSavedPost(postId: string) {
    if (!me?.id) return;
    setError("");
    const alreadySaved = savedPostIds.includes(postId);
    try {
      if (alreadySaved) {
        const res = await supabase
          .from("internal_social_saved_posts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", me.id);
        if (res.error) throw new Error(res.error.message);
        setSavedPostIds((prev) => prev.filter((item) => item !== postId));
      } else {
        const res = await supabase.from("internal_social_saved_posts").insert({
          post_id: postId,
          user_id: me.id,
        });
        if (res.error) throw new Error(res.error.message);
        setSavedPostIds((prev) => [...prev, postId]);
      }
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao atualizar post salvo."));
    }
  }

  async function markNotificationsAsRead(ids?: string[]) {
    if (!me?.id) return;
    const unreadIds = (ids ?? notifications.filter((item) => !item.read_at).map((item) => item.id)).filter(Boolean);
    if (!unreadIds.length) return;
    try {
      const nowIso = new Date().toISOString();
      const res = await supabase
        .from("internal_social_notifications")
        .update({ read_at: nowIso })
        .in("id", unreadIds)
        .eq("user_id", me.id);
      if (res.error) throw new Error(res.error.message);
      setNotifications((prev) =>
        prev.map((item) => (unreadIds.includes(item.id) ? { ...item, read_at: item.read_at ?? nowIso } : item))
      );
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao atualizar notificacoes."));
    }
  }

  async function uploadMedia(file: File) {
    if (!file) return;
    setUploadingMedia(true);
    setError("");
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const form = new FormData();
      form.append("file", file);
      form.append("context", "post");
      const res = await fetch("/api/institucional/rede-social/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        attachmentType?: AttachmentType;
        url?: string;
        label?: string;
        path?: string;
      };
      if (!res.ok || !json.url || !json.attachmentType) {
        const message = json.error || "Não foi possível enviar a mídia.";
        const lower = message.toLowerCase();
        if (lower.includes("bucket") || lower.includes("not found")) {
          throw new Error(
            `O bucket de mídia da rede social ainda não está configurado. Rode a migration ${MEDIA_BUCKET_MIGRATION} no Supabase e tente novamente.`
          );
        }
        throw new Error(message);
      }
      const attachmentType = json.attachmentType;
      const attachmentUrl = json.url;
      setDraftAttachments((prev) => [
        ...prev,
        {
          type: attachmentType,
          url: attachmentUrl,
          label: json.label || file.name,
          storagePath: json.path || undefined,
        },
      ]);
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao enviar mídia."));
    } finally {
      setUploadingMedia(false);
    }
  }

  async function uploadMessageAttachment(file: File) {
    if (!file) return;
    setUploadingMedia(true);
    setError("");
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const form = new FormData();
      form.append("file", file);
      form.append("context", "message");
      const res = await fetch("/api/institucional/rede-social/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        attachmentType?: AttachmentType;
        url?: string;
        label?: string;
        path?: string;
      };
      if (!res.ok || !json.url || !json.attachmentType) {
        const message = json.error || "Não foi possível enviar o anexo.";
        const lower = message.toLowerCase();
        if (lower.includes("bucket") || lower.includes("not found")) {
          throw new Error(
            `O bucket de mídia da rede social ainda não está configurado. Rode a migration ${MEDIA_BUCKET_MIGRATION} no Supabase e tente novamente.`
          );
        }
        throw new Error(message);
      }
      const attachmentType = json.attachmentType;
      const attachmentUrl = json.url;
      setMessageAttachments((prev) => [
        ...prev,
        {
          type: attachmentType,
          url: attachmentUrl,
          label: json.label || file.name,
          storagePath: json.path || undefined,
        },
      ]);
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao enviar anexo da mensagem."));
    } finally {
      setUploadingMedia(false);
    }
  }

  async function submitPost() {
    if (!me?.id || (!postText.trim() && !draftAttachments.length && !pollEnabled)) return;
    setBusy(true);
    setError("");
    try {
      const normalizedPostType = canPublishOfficial ? postType : "social";
      let res = await supabase
        .from("internal_social_posts")
        .insert({
          author_user_id: me.id,
          author_name: currentName,
          author_avatar_url: resolvePortalAvatarUrl(me.avatar_url ?? null),
          audience_type: scopeType,
          audience_project_id: scopeType === "project" ? projectId || null : null,
          audience_group_id: scopeType === "group" ? groupId || null : null,
          audience_label:
            scopeType === "project"
              ? projects.find((item) => item.id === projectId)?.name ?? "Equipe de projeto"
              : scopeType === "group"
                ? groups.find((item) => item.id === groupId)?.name ?? "Comunidade"
              : "Toda a empresa",
          text: postText.trim(),
          post_type: normalizedPostType,
          official_author_label: isOfficialPostType(normalizedPostType) ? roleOfficialLabel(me.role) : null,
        })
        .select("id")
        .single<{ id: string }>();
      if (res.error && isSchemaCompatError(res.error.message)) {
        res = await supabase
          .from("internal_social_posts")
          .insert({
            author_user_id: me.id,
            author_name: currentName,
            author_avatar_url: resolvePortalAvatarUrl(me.avatar_url ?? null),
            audience_type: scopeType,
            audience_project_id: scopeType === "project" ? projectId || null : null,
            audience_group_id: scopeType === "group" ? groupId || null : null,
            audience_label:
              scopeType === "project"
                ? projects.find((item) => item.id === projectId)?.name ?? "Equipe de projeto"
                : scopeType === "group"
                  ? groups.find((item) => item.id === groupId)?.name ?? "Comunidade"
                : "Toda a empresa",
            text: postText.trim(),
          })
          .select("id")
          .single<{ id: string }>();
      }
      if (res.error) throw new Error(res.error.message);
      if (draftAttachments.length) {
        const attachRes = await supabase.from("internal_social_post_attachments").insert(
          draftAttachments.map((item) => ({
            post_id: res.data.id,
            type: item.type,
            url: item.storagePath || item.url,
            label: item.label,
          }))
        );
        if (attachRes.error) throw new Error(attachRes.error.message);
      }
      if (pollEnabled) {
        const cleanQuestion = pollQuestion.trim();
        const cleanOptions = pollOptions.map((item) => item.trim()).filter(Boolean).slice(0, 4);
        if (!cleanQuestion || cleanOptions.length < 2) {
          throw new Error("Preencha a pergunta e pelo menos duas opcoes da enquete.");
        }
        const pollRes = await supabase
          .from("internal_social_polls")
          .insert({
            post_id: res.data.id,
            question: cleanQuestion,
            allow_multiple: false,
          })
          .select("id")
          .single<{ id: string }>();
        if (pollRes.error) throw new Error(pollRes.error.message);
        const optionsRes = await supabase.from("internal_social_poll_options").insert(
          cleanOptions.map((label, index) => ({
            poll_id: pollRes.data.id,
            label,
            position: index,
          }))
        );
        if (optionsRes.error) throw new Error(optionsRes.error.message);
      }
      await syncPulseHubEvent({
        type: "post_sync",
        postId: res.data.id,
        text: postText.trim(),
        postType: normalizedPostType,
        broadcastOfficial: isOfficialPostType(normalizedPostType),
      });
      setPostText("");
      setPostType("social");
      setDraftAttachments([]);
      setScopeType("company");
      setProjectId("");
      setGroupId("");
      setComposerExpanded(false);
      setShowComposerMentionPicker(false);
      setMentionQuery("");
      setPollEnabled(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao publicar."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleReaction(post: FeedPost, emoji: string) {
    if (!me?.id) return;
    setError("");
    try {
      const existing = post.reactions.find((item) => item.user_id === me.id && item.emoji === emoji);
      if (existing) {
        const delRes = await supabase.from("internal_social_post_reactions").delete().eq("id", existing.id);
        if (delRes.error) throw new Error(delRes.error.message);
      } else {
        const addRes = await supabase.from("internal_social_post_reactions").insert({ post_id: post.id, user_id: me.id, emoji });
        if (addRes.error) throw new Error(addRes.error.message);
        await syncPulseHubEvent({ type: "reaction_notify", postId: post.id, emoji });
      }
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao reagir."));
    }
  }

  async function submitComment(postId: string) {
    if (!me?.id) return;
    const content = (commentDrafts[postId] ?? "").trim();
    if (!content) return;
    setError("");
    try {
      const res = await supabase
        .from("internal_social_post_comments")
        .insert({
        post_id: postId,
        author_user_id: me.id,
        author_name: currentName,
        text: content,
      })
        .select("id")
        .single<{ id: string }>();
      if (res.error) throw new Error(res.error.message);
      await syncPulseHubEvent({
        type: "comment_sync",
        postId,
        commentId: res.data.id,
        text: content,
        notifyPostAuthor: true,
      });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao comentar."));
    }
  }

  async function sendMessage() {
    const trimmedMessage = messageText.trim();
    if (!me?.id || !selectedUserId || (!trimmedMessage && !messageAttachments.length)) return;
    setBusy(true);
    setError("");
    try {
      const composedText = [
        trimmedMessage,
        ...messageAttachments.map((item) => `Anexo: ${item.storagePath || item.url}`),
      ]
        .filter(Boolean)
        .join("\n");
      const res = await supabase
        .from("internal_social_direct_messages")
        .insert({
          from_user_id: me.id,
          from_name: currentName,
          to_user_id: selectedUserId,
          text: composedText,
        })
        .select("id")
        .single<{ id: string }>();
      if (res.error) throw new Error(res.error.message);
      await syncPulseHubEvent({
        type: "message_notify",
        messageId: res.data.id,
        toUserId: selectedUserId,
        preview: trimmedMessage || "Anexo compartilhado.",
      });
      setMessageText("");
      setMessageAttachments([]);
      setShowMessageEmojiPicker(false);
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao enviar mensagem."));
    } finally {
      setBusy(false);
    }
  }

  async function togglePinnedPost(postId: string) {
    const next = pinnedPostId === postId ? "" : postId;
    setPinnedPostId(next);
    try {
      const clearRes = await supabase.from("internal_social_posts").update({ is_pinned: false }).eq("is_pinned", true);
      if (clearRes.error) throw new Error(clearRes.error.message);
      if (next) {
        const pinRes = await supabase.from("internal_social_posts").update({ is_pinned: true }).eq("id", next);
        if (pinRes.error) throw new Error(pinRes.error.message);
      }
    } catch (err) {
      if (typeof window !== "undefined" && isSchemaCompatError(err instanceof Error ? err.message : "")) {
        if (next) window.localStorage.setItem(PINNED_POST_KEY, next);
        else window.localStorage.removeItem(PINNED_POST_KEY);
      } else {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao destacar publicação."));
        setPinnedPostId(pinnedPostId);
      }
    }
  }

  function startEditComment(comment: CommentRow) {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
  }

  function cancelEditComment() {
    setEditingCommentId("");
    setEditingCommentText("");
  }

  async function saveEditedComment(commentId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await supabase.from("internal_social_post_comments").update({ text: editingCommentText.trim() }).eq("id", commentId);
      if (res.error) throw new Error(res.error.message);
      const comment = posts.flatMap((item) => item.comments).find((item) => item.id === commentId);
      if (comment) {
        await syncPulseHubEvent({
          type: "comment_sync",
          postId: comment.post_id,
          commentId,
          text: editingCommentText.trim(),
          notifyPostAuthor: false,
        });
      }
      cancelEditComment();
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao editar comentario."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(comment: CommentRow) {
    if (!window.confirm("Deseja excluir este comentario?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await supabase.from("internal_social_post_comments").delete().eq("id", comment.id);
      if (res.error) throw new Error(res.error.message);
      if (editingCommentId === comment.id) cancelEditComment();
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao excluir comentario."));
    } finally {
      setBusy(false);
    }
  }

  function startEditPost(post: FeedPost) {
    setEditingPostId(post.id);
    setEditingPostText(post.text);
  }

  function cancelEditPost() {
    setEditingPostId("");
    setEditingPostText("");
  }

  async function saveEditedPost() {
    if (!editingPostId) return;
    setBusy(true);
    setError("");
    try {
      const res = await supabase
        .from("internal_social_posts")
        .update({ text: editingPostText.trim() })
        .eq("id", editingPostId);
      if (res.error) throw new Error(res.error.message);
      const editingMeta = posts.find((item) => item.id === editingPostId);
      await syncPulseHubEvent({
        type: "post_sync",
        postId: editingPostId,
        text: editingPostText.trim(),
        postType: editingMeta?.post_type ?? "social",
        broadcastOfficial: false,
      });
      cancelEditPost();
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao editar publicação."));
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post: FeedPost) {
    const authorAction = post.author_user_id === me?.id ? "excluir sua publicação" : "excluir esta publicação";
    if (!window.confirm(`Deseja ${authorAction}?`)) return;
    setBusy(true);
    setError("");
    try {
      const [reactionsRes, commentsRes, attachmentsRes] = await Promise.all([
        supabase.from("internal_social_post_reactions").delete().eq("post_id", post.id),
        supabase.from("internal_social_post_comments").delete().eq("post_id", post.id),
        supabase.from("internal_social_post_attachments").delete().eq("post_id", post.id),
      ]);
      if (reactionsRes.error) throw new Error(reactionsRes.error.message);
      if (commentsRes.error) throw new Error(commentsRes.error.message);
      if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);
      const postRes = await supabase.from("internal_social_posts").delete().eq("id", post.id);
      if (postRes.error) throw new Error(postRes.error.message);
      if (editingPostId === post.id) cancelEditPost();
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao excluir publicação."));
    } finally {
      setBusy(false);
    }
  }

  function updateProjectNote(projectId: string, value: string) {
    setProjectNotes((prev) => {
      const next = { ...prev, [projectId]: value };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("internal-social-project-notes", JSON.stringify(next));
      }
      return next;
    });
  }

  function applyProjectBoardTemplate(projectId: string) {
    updateProjectNote(projectId, projectNotes[projectId]?.trim() ? projectNotes[projectId] : PROJECT_BOARD_TEMPLATE);
  }

  async function saveProjectNote(projectId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await supabase.from("internal_social_project_boards").upsert({
        project_id: projectId,
        notes: projectNotes[projectId] ?? "",
        updated_by: me?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error.message);
    } catch (err) {
      if (isSchemaCompatError(err instanceof Error ? err.message : "")) {
        setError(
          `Para persistir quadro colaborativo e post em destaque no banco, rode a migration ${SOCIAL_BOARD_MIGRATION} no Supabase e tente novamente.`
        );
      } else {
        setError(normalizeError(err instanceof Error ? err.message : "Erro ao salvar quadro colaborativo."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleGroupMembership(group: Group) {
    if (!me?.id) return;
    const joined = joinedGroupIds.has(group.id);
    setBusy(true);
    setError("");
    try {
      if (joined) {
        const res = await supabase
          .from("internal_social_group_members")
          .delete()
          .eq("group_id", group.id)
          .eq("user_id", me.id);
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await supabase.from("internal_social_group_members").insert({
          group_id: group.id,
          user_id: me.id,
          role: "member",
        });
        if (res.error) throw new Error(res.error.message);
      }
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao atualizar comunidade."));
    } finally {
      setBusy(false);
    }
  }

  async function voteOnPoll(post: FeedPost, optionId: string) {
    if (!me?.id || !post.poll) return;
    setBusy(true);
    setError("");
    try {
      const myOptionIds = post.poll.options.filter((item) => item.votedByMe).map((item) => item.id);
      if (post.poll.allow_multiple) {
        if (myOptionIds.includes(optionId)) {
          const res = await supabase
            .from("internal_social_poll_votes")
            .delete()
            .eq("poll_id", post.poll.id)
            .eq("option_id", optionId)
            .eq("user_id", me.id);
          if (res.error) throw new Error(res.error.message);
        } else {
          const res = await supabase.from("internal_social_poll_votes").insert({
            poll_id: post.poll.id,
            option_id: optionId,
            user_id: me.id,
          });
          if (res.error) throw new Error(res.error.message);
        }
      } else {
        if (myOptionIds.length) {
          const clearRes = await supabase
            .from("internal_social_poll_votes")
            .delete()
            .eq("poll_id", post.poll.id)
            .eq("user_id", me.id);
          if (clearRes.error) throw new Error(clearRes.error.message);
        }
        if (!myOptionIds.includes(optionId)) {
          const res = await supabase.from("internal_social_poll_votes").insert({
            poll_id: post.poll.id,
            option_id: optionId,
            user_id: me.id,
          });
          if (res.error) throw new Error(res.error.message);
        }
      }
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao votar na enquete."));
    } finally {
      setBusy(false);
    }
  }

  async function reportPost(post: FeedPost) {
    if (!me?.id) return;
    const reason = window.prompt("Motivo da denuncia (ex.: conteudo inadequado, spam, conduta imprópria):", "conteudo inadequado");
    if (!reason?.trim()) return;
    const details = window.prompt("Detalhes adicionais (opcional):", "") ?? "";
    setBusy(true);
    setError("");
    try {
      const res = await supabase.from("internal_social_reports").insert({
        reporter_user_id: me.id,
        target_type: "post",
        post_id: post.id,
        reason: reason.trim(),
        details: details.trim() || null,
      });
      if (res.error) throw new Error(res.error.message);
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao denunciar publicacao."));
    } finally {
      setBusy(false);
    }
  }

  async function updateReportStatus(reportId: string, status: ReportRow["status"]) {
    if (!me?.id) return;
    setBusy(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      const reportRes = await supabase
        .from("internal_social_reports")
        .update({
          status,
          reviewed_by: me.id,
          reviewed_at: nowIso,
        })
        .eq("id", reportId);
      if (reportRes.error) throw new Error(reportRes.error.message);

      const actionRes = await supabase.from("internal_social_moderation_actions").insert({
        report_id: reportId,
        moderator_user_id: me.id,
        action: status === "reviewing" ? "reviewing" : status === "resolved" ? "resolved" : "dismissed",
        target_type: "report",
        target_id: reportId,
        notes: null,
      });
      if (actionRes.error) throw new Error(actionRes.error.message);
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao atualizar denuncia."));
    } finally {
      setBusy(false);
    }
  }

  async function setPostModerationState(post: FeedPost, hide: boolean) {
    if (!me?.id) return;
    const reason = hide ? window.prompt("Motivo para ocultar a publicacao:", post.hidden_reason ?? "moderacao interna") : "";
    if (hide && !reason?.trim()) return;
    const normalizedReason = hide ? reason?.trim() ?? null : null;
    setBusy(true);
    setError("");
    try {
      const res = await supabase
        .from("internal_social_posts")
        .update({
          hidden_at: hide ? new Date().toISOString() : null,
          hidden_reason: normalizedReason,
        })
        .eq("id", post.id);
      if (res.error) throw new Error(res.error.message);

      const actionRes = await supabase.from("internal_social_moderation_actions").insert({
        moderator_user_id: me.id,
        action: hide ? "hide_post" : "restore_post",
        target_type: "post",
        target_id: post.id,
        notes: hide ? normalizedReason : "restaurado",
      });
      if (actionRes.error) throw new Error(actionRes.error.message);
      await load();
    } catch (err) {
      setError(normalizeError(err instanceof Error ? err.message : "Erro ao atualizar visibilidade da publicacao."));
    } finally {
      setBusy(false);
    }
  }

  const currentName = displayName(me);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff_0%,_#eef4ff_22%,_#f4f2ee_58%,_#f1ede6_100%)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-2.5 text-sm font-semibold tracking-[0.01em] text-slate-900 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.45)]">
                PulseHub
              </div>
              <div ref={searchBoxRef} className="relative hidden md:block">
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchSubmitted(false);
                    setSearchDropdownIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && hasSearchSuggestions) {
                      event.preventDefault();
                      setSearchDropdownIndex((current) => (current >= searchSuggestionItems.length - 1 ? 0 : current + 1));
                      return;
                    }
                    if (event.key === "ArrowUp" && hasSearchSuggestions) {
                      event.preventDefault();
                      setSearchDropdownIndex((current) => (current <= 0 ? searchSuggestionItems.length - 1 : current - 1));
                      return;
                    }
                    if (event.key === "Escape") {
                      setSearchDropdownIndex(-1);
                      return;
                    }
                    if (event.key === "Enter" && search.trim()) {
                      event.preventDefault();
                      if (hasSearchSuggestions && searchDropdownIndex >= 0) {
                        const selectedSuggestion = searchSuggestionItems[searchDropdownIndex];
                        if (selectedSuggestion) selectSearchSuggestion(selectedSuggestion);
                        return;
                      }
                      submitGeneralSearch();
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="h-12 min-w-[300px] rounded-full border border-slate-300/80 bg-gradient-to-r from-slate-50 to-white px-5 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSearchSubmitted(false);
                      setSearchDropdownIndex(-1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400 hover:text-slate-700"
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                ) : null}
                {hasSearchSuggestions ? (
                  <div className="absolute left-0 top-14 z-30 w-[440px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]">
                  {searchSuggestions.people.length ? (
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pessoas</p>
                        <div className="space-y-2">
                          {searchSuggestions.people.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => selectSearchSuggestion({ key: `person-${person.id}`, kind: "person", id: person.id })}
                              className={`block w-full rounded-xl border-l-2 px-2 py-1 text-left ${
                                searchSuggestionIndexMap.get(`person-${person.id}`) === searchDropdownIndex
                                  ? "border-[#0a66c2] bg-slate-100"
                                  : "border-transparent hover:bg-slate-50"
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{highlightMatch(displayName(person), searchTerm)}</p>
                              <p className="text-xs text-slate-500">{highlightMatch(profileRoleLine(person), searchTerm)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {searchSuggestions.posts.length ? (
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Publicacoes</p>
                        <div className="space-y-2">
                          {searchSuggestions.posts.map((post) => (
                            <button
                              key={post.id}
                              type="button"
                              onClick={() => selectSearchSuggestion({ key: `post-${post.id}`, kind: "post", id: post.id })}
                              className={`block w-full rounded-xl border-l-2 px-2 py-1 text-left ${
                                searchSuggestionIndexMap.get(`post-${post.id}`) === searchDropdownIndex
                                  ? "border-[#0a66c2] bg-slate-100"
                                  : "border-transparent hover:bg-slate-50"
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{highlightMatch(post.author_name, searchTerm)}</p>
                              <p className="truncate text-xs text-slate-500">{highlightMatch(post.text || post.audience_label, searchTerm)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {searchSuggestions.projects.length ? (
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Projetos</p>
                        <div className="space-y-2">
                          {searchSuggestions.projects.map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => selectSearchSuggestion({ key: `project-${project.id}`, kind: "project", id: project.id })}
                              className={`block w-full rounded-xl border-l-2 px-2 py-1 text-left ${
                                searchSuggestionIndexMap.get(`project-${project.id}`) === searchDropdownIndex
                                  ? "border-[#0a66c2] bg-slate-100"
                                  : "border-transparent hover:bg-slate-50"
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{highlightMatch(project.name, searchTerm)}</p>
                            </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {searchSuggestions.conversations.length ? (
                    <div className="px-4 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mensagens</p>
                        <div className="space-y-2">
                          {searchSuggestions.conversations.map((person) => (
                            <button
                              key={`message-${person.id}`}
                              type="button"
                              onClick={() =>
                                selectSearchSuggestion({
                                  key: `conversation-${person.id}`,
                                  kind: "conversation",
                                  id: person.id,
                                })
                              }
                              className={`block w-full rounded-xl border-l-2 px-2 py-1 text-left ${
                                searchSuggestionIndexMap.get(`conversation-${person.id}`) === searchDropdownIndex
                                  ? "border-[#0a66c2] bg-slate-100"
                                  : "border-transparent hover:bg-slate-50"
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{highlightMatch(displayName(person), searchTerm)}</p>
                              <p className="text-xs text-slate-500">{highlightMatch(profileRoleLine(person), searchTerm)}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={submitGeneralSearch}
                      className="w-full border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-[#0a66c2] hover:bg-slate-50"
                    >
                      Ver todos os resultados
                    </button>
                  </div>
                ) : null}
            </div>
          </div>
          <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 text-sm shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)] lg:flex">
            {[
              { id: "inicio", label: "Início" },
              { id: "network", label: "Minha rede" },
              { id: "communities", label: "Comunidades" },
              { id: "projects", label: "Projetos" },
              { id: "messages", label: "Mensagens" },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id as "inicio" | "network" | "communities" | "projects" | "messages");
                    setSearchSubmitted(false);
                  }}
                  className={`relative rounded-full px-4 py-2 font-medium transition ${
                    active
                      ? "bg-slate-900 text-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute inset-x-3 -bottom-2 h-0.5 rounded-full transition ${
                      active ? "bg-[#0a66c2]" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !notificationsOpen;
                  setNotificationsOpen(nextOpen);
                  if (nextOpen) void markNotificationsAsRead();
                }}
                className="relative inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.45)] hover:bg-slate-50"
              >
                Alertas
                {unreadNotificationsCount ? (
                  <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {unreadNotificationsCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-14 z-30 w-[22rem] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Notificacoes</p>
                      <p className="text-xs text-slate-500">Atualizadas em tempo real apos recarregar o feed.</p>
                    </div>
                    {unreadNotificationsCount ? (
                      <button
                        type="button"
                        onClick={() => void markNotificationsAsRead()}
                        className="text-xs font-semibold text-[#0a66c2] hover:underline"
                      >
                        Marcar tudo
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-[26rem] overflow-y-auto">
                    {notifications.length ? (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (!item.read_at) void markNotificationsAsRead([item.id]);
                            setNotificationsOpen(false);
                            router.push(item.link_url || "/institucional/rede-social");
                          }}
                          className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                            item.read_at ? "bg-white" : "bg-blue-50/50"
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          {item.body ? <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p> : null}
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {when(item.created_at)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-sm text-slate-500">Nenhuma notificacao por enquanto.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-xs font-semibold text-white shadow-[0_14px_30px_-18px_rgba(59,130,246,0.8)]">
              {initials(currentName)}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        {activeTab !== "inicio" ? (
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(120deg,#020617_0%,#0f172a_18%,#102c5c_52%,#312e81_100%)] px-6 py-7 text-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Institucional</p>
                <h1 className="mt-2 text-2xl font-semibold">PulseHub</h1>
                <p className="mt-2 max-w-3xl text-sm text-blue-100/90">
                  Ambiente colaborativo para relacionamento entre membros, equipes de projeto e conversas da empresa.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {searchSubmitted && searchTerm ? (
          <section className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Busca geral</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Principais resultados para &quot;{search}&quot;</p>
              </div>
              <button
                type="button"
                onClick={() => setSearchSubmitted(false)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Fechar resultados
              </button>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-sm font-semibold text-slate-900">Pessoas</p>
                <div className="mt-3 space-y-3">
                  {globalPeopleResults.length ? (
                      globalPeopleResults.slice(0, 6).map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => router.push(`/institucional/rede-social/membros/${person.id}`)}
                          className="block w-full rounded-xl bg-white px-3 py-3 text-left hover:bg-slate-100"
                        >
                          <p className="text-sm font-semibold text-slate-900">{highlightMatch(displayName(person), searchTerm)}</p>
                          <p className="text-xs text-slate-500">{highlightMatch(profileRoleLine(person), searchTerm)}</p>
                        </button>
                      ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum membro encontrado.</p>
                  )}
                </div>
              </section>
              <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-sm font-semibold text-slate-900">Publicações</p>
                <div className="mt-3 space-y-3">
                  {globalPostResults.length ? (
                    globalPostResults.slice(0, 6).map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => {
                          setActiveTab("inicio");
                          setSearchSubmitted(false);
                        }}
                        className="block w-full rounded-xl bg-white px-3 py-3 text-left hover:bg-slate-100"
                      >
                        <p className="text-sm font-semibold text-slate-900">{highlightMatch(post.author_name, searchTerm)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{highlightMatch(post.text || post.audience_label, searchTerm)}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma publicação encontrada.</p>
                  )}
                </div>
              </section>
              <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-sm font-semibold text-slate-900">Projetos</p>
                <div className="mt-3 space-y-3">
                  {globalProjectResults.length ? (
                    globalProjectResults.slice(0, 6).map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setActiveTab("projects");
                          setProjectBoardProjectId(project.id);
                          setSearchSubmitted(false);
                          router.push(`/institucional/rede-social?tab=projects&project=${encodeURIComponent(project.id)}`);
                        }}
                        className="block w-full rounded-xl bg-white px-3 py-3 text-left hover:bg-slate-100"
                      >
                        <p className="text-sm font-semibold text-slate-900">{highlightMatch(project.name, searchTerm)}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum projeto encontrado.</p>
                  )}
                </div>
              </section>
              <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-sm font-semibold text-slate-900">Mensagens</p>
                <div className="mt-3 space-y-3">
                  {globalConversationResults.length ? (
                    globalConversationResults.slice(0, 6).map((person) => (
                      <button
                        key={`search-message-${person.id}`}
                        type="button"
                        onClick={() => {
                          setActiveTab("messages");
                          setSelectedUserId(person.id);
                          setSearchSubmitted(false);
                          router.push(`/institucional/rede-social?tab=messages&user=${encodeURIComponent(person.id)}`);
                        }}
                        className="block w-full rounded-xl bg-white px-3 py-3 text-left hover:bg-slate-100"
                      >
                        <p className="text-sm font-semibold text-slate-900">{highlightMatch(displayName(person), searchTerm)}</p>
                        <p className="text-xs text-slate-500">{highlightMatch(profileRoleLine(person), searchTerm)}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma conversa encontrada.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {!searchSubmitted && activeTab === "inicio" ? (
          <main id="feed" className="mx-auto max-w-3xl space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(37,99,235,0.65)]">
                  {initials(currentName)}
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <button
                    type="button"
                    onClick={() => setComposerExpanded(true)}
                    className="flex h-14 w-full items-center rounded-full border border-slate-300 bg-gradient-to-r from-slate-50 to-white px-5 text-left text-base font-medium text-slate-500 transition hover:border-slate-400 hover:bg-white hover:shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)]"
                  >
                    Começar publicação
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destaques</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Aniversariantes</p>
                  </div>
                  <Link href="/agenda/aniversariantes" className="text-sm font-semibold text-[#0a66c2] hover:underline">
                    Ver agenda
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {birthdayHighlights.length ? (
                    birthdayHighlights.map((item) => (
                      <Link
                        key={`birthday-${item.userId}`}
                        href={`/institucional/rede-social/membros/${item.userId}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                        <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700">{item.dateLabel}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum aniversario nos proximos 30 dias.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Boas-vindas</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Novos membros</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    ate 45 dias
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {newHireHighlights.length ? (
                    newHireHighlights.map((item) => (
                      <Link
                        key={`hire-${item.userId}`}
                        href={`/institucional/rede-social/membros/${item.userId}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{item.dateLabel}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma admissao recente para destacar.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Painel</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Analytics do PulseHub</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    resumo operacional
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Posts ativos</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{engagementHighlights.postCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Comunicados</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{engagementHighlights.officialCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Enquetes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{engagementHighlights.pollCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Denuncias abertas</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{engagementHighlights.openReports}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Assuntos em alta</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topHashtags.length ? (
                        topHashtags.map((item) => (
                          <button
                            key={`tag-${item.tag}`}
                            type="button"
                            onClick={() => {
                              setSearch(`#${item.tag}`);
                              setSearchSubmitted(true);
                              setActiveTab("inicio");
                            }}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            #{item.tag} • {item.count}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Nenhuma hashtag em destaque.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Autores com mais posts</p>
                    <div className="mt-3 space-y-2">
                      {topAuthors.length ? (
                        topAuthors.map((author) => (
                          <div key={`author-${author.userId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <span className="truncate text-sm font-semibold text-slate-900">{author.name}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              {author.total} post(s)
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">Sem dados de autoria ainda.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.32)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Canal oficial</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Comunicados recentes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedFilter("official")}
                    className="text-sm font-semibold text-[#0a66c2] hover:underline"
                  >
                    Ver feed oficial
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {officialPosts.length ? (
                    officialPosts.map((post) => (
                      <div key={`official-${post.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{post.author_name}</p>
                            <p className="text-xs text-slate-500">{when(post.created_at)}</p>
                          </div>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            {postTypeLabel(post.post_type)}
                          </span>
                        </div>
                        {post.text ? (
                          <RichText
                            className="mt-3 text-sm text-slate-700 [&_p]:whitespace-pre-wrap"
                            value={post.text}
                            mentionDirectory={mentionDirectory.byHandle}
                          />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum comunicado recente no feed.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "Todos" },
                { id: "official", label: "Comunicados" },
                { id: "saved", label: "Salvos" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFeedFilter(item.id as "all" | "official" | "saved")}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    feedFilter === item.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Use @handle e #assunto nas publicacoes
              </p>
            </section>

            {activeTab === "inicio" && visiblePinnedPost ? (
              <section className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(254,243,199,0.7))] p-5 shadow-[0_24px_70px_-42px_rgba(217,119,6,0.4)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Post em destaque</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{highlightMatch(visiblePinnedPost.author_name, searchTerm)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePinnedPost(visiblePinnedPost.id)}
                    className="rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Desafixar
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    {postTypeLabel(visiblePinnedPost.post_type)}
                  </span>
                  {visiblePinnedPost.official_author_label ? (
                    <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                      {visiblePinnedPost.official_author_label}
                    </span>
                  ) : null}
                </div>
                {visiblePinnedPost.text ? (
                  <RichText
                    className="text-sm leading-6 text-slate-800 [&_p]:whitespace-pre-wrap"
                    value={visiblePinnedPost.text}
                    mentionDirectory={mentionDirectory.byHandle}
                  />
                ) : null}
              </section>
            ) : null}

            {loading ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)]">Carregando feed...</div>
            ) : visibleFeedPosts.length ? (
                <section className="space-y-4">
                  {visibleFeedPosts.map((post) => {
                    const authorName = post.author_name || displayName(profileById.get(post.author_user_id));
                    const authorAvatar = resolvePortalAvatarUrl(post.author_avatar_url) || profileById.get(post.author_user_id)?.avatar_url || null;
                    const canManagePost = post.author_user_id === me?.id || canModeratePosts;
                    return (
                      <article key={post.id} className="rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.32)] backdrop-blur">
                        {post.hidden_at ? (
                          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                            Publicacao oculta pela moderacao em {when(post.hidden_at)}.
                            {post.hidden_reason ? ` Motivo: ${post.hidden_reason}` : ""}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 rounded-full">
                              {authorAvatar ? (
                                <div
                                  className="h-full w-full rounded-full bg-cover bg-center"
                                  style={{ backgroundImage: `url(${authorAvatar})` }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-sm font-semibold text-white">
                                  {initials(authorName)}
                                </div>
                              )}
                              {onlineUserIds.has(post.author_user_id) ? (
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                              ) : null}
                            </div>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{highlightMatch(authorName, searchTerm)}</p>
                            <p className="text-xs text-slate-500">{post.audience_label} • {when(post.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {post.audience_type === "company" ? "Feed geral" : post.audience_type === "group" ? "Comunidade" : "Equipe"}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              isOfficialPostType(post.post_type)
                                ? "border border-amber-200 bg-amber-50 text-amber-700"
                                : "border border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            {postTypeLabel(post.post_type)}
                          </span>
                          {post.official_author_label ? (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                              {post.official_author_label}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void toggleSavedPost(post.id)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              savedPostIds.includes(post.id)
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {savedPostIds.includes(post.id) ? "Salvo" : "Salvar"}
                          </button>
                          {post.author_user_id !== me?.id ? (
                            <button
                              type="button"
                              onClick={() => void reportPost(post)}
                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                post.isReportedByMe
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {post.isReportedByMe ? "Denunciado" : "Denunciar"}
                            </button>
                          ) : null}
                          {canManagePost ? (
                            <>
                              <button
                                type="button"
                                onClick={() => togglePinnedPost(post.id)}
                                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 hover:bg-amber-100"
                              >
                                {pinnedPostId === post.id ? "Desafixar" : "Fixar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditPost(post)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void deletePost(post)}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                              >
                                Excluir
                              </button>
                              {canModeratePosts && post.author_user_id !== me?.id ? (
                                <button
                                  type="button"
                                  onClick={() => void setPostModerationState(post, !post.hidden_at)}
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                    post.hidden_at
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  }`}
                                >
                                  {post.hidden_at ? "Restaurar" : "Ocultar"}
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                      {post.text ? (
                        <RichText
                          className="mt-4 space-y-3 text-sm leading-6 text-slate-800 [&_li]:ml-5 [&_li]:list-disc [&_p]:whitespace-pre-wrap"
                          value={post.text}
                          mentionDirectory={mentionDirectory.byHandle}
                        />
                      ) : null}
                      {post.attachments.length ? (
                        <div className="mt-4 space-y-3">
                          {post.attachments.map((attachment) => (
                            <div key={attachment.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              {(() => {
                                const mediaUrl = attachment.resolvedUrl || attachment.url;
                                return attachment.type === "image" ? (
                                  <Image
                                    src={mediaUrl}
                                    alt={attachment.label ?? "Imagem do post"}
                                    width={1200}
                                    height={900}
                                    unoptimized
                                    className="max-h-[280px] w-full object-cover"
                                  />
                                ) : attachment.type === "video" ? (
                                  <video
                                    controls
                                    className="max-h-[280px] w-full bg-slate-950"
                                    src={mediaUrl}
                                  />
                                ) : (
                                  <a
                                    href={mediaUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block px-4 py-3 text-sm font-semibold text-blue-700 hover:underline"
                                  >
                                    {attachment.label || mediaUrl}
                                  </a>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {post.poll ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">{post.poll.question}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {post.poll.allow_multiple ? "Voce pode marcar mais de uma opcao." : "Escolha uma opcao."}
                          </p>
                          <div className="mt-3 space-y-2">
                            {post.poll.options.map((option) => {
                              const totalVotes = post.poll?.options.reduce((sum, current) => sum + current.votes, 0) ?? 0;
                              const width = totalVotes > 0 ? `${Math.round((option.votes / totalVotes) * 100)}%` : "0%";
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => void voteOnPoll(post, option.id)}
                                  className={`relative block w-full overflow-hidden rounded-2xl border px-4 py-3 text-left ${
                                    option.votedByMe
                                      ? "border-blue-300 bg-blue-50"
                                      : "border-slate-200 bg-white hover:bg-slate-100"
                                  }`}
                                >
                                  <span
                                    className="absolute inset-y-0 left-0 bg-blue-100/70"
                                    style={{ width }}
                                  />
                                  <span className="relative flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                                    <span className="text-xs font-semibold text-slate-500">{option.votes} voto(s)</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        {REACTION_EMOJIS.map((emoji) => {
                          const count = post.reactions.filter((item) => item.emoji === emoji).length;
                          const active = !!post.reactions.find((item) => item.user_id === me?.id && item.emoji === emoji);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => void toggleReaction(post, emoji)}
                              className={`rounded-full border px-3 py-1 text-sm font-semibold ${active ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                            >
                              {emoji} {count || ""}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-500">
                        <span>{post.reactions.length} reacao(oes)</span>
                        <span>{post.comments.length} comentario(s)</span>
                        {post.reportsCount ? <span>{post.reportsCount} denuncia(s)</span> : null}
                      </div>

                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-4">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {comment.author_name || displayName(profileById.get(comment.author_user_id))}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-400">{when(comment.created_at)}</p>
                                {comment.author_user_id === me?.id || canModeratePosts ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditComment(comment)}
                                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteComment(comment)}
                                      className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 hover:text-rose-700"
                                    >
                                      Excluir
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editingCommentText}
                                  onChange={(event) => setEditingCommentText(event.target.value)}
                                  rows={3}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEditComment}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void saveEditedComment(comment.id)}
                                    className="rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                  >
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <RichText
                                className="mt-1 text-sm text-slate-700 [&_p]:whitespace-pre-wrap"
                                value={comment.text}
                                mentionDirectory={mentionDirectory.byHandle}
                              />
                            )}
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            value={commentDrafts[post.id] ?? ""}
                            onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                            placeholder="Escreva um comentario. Use @handle e #assunto."
                            className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => void submitComment(post.id)}
                            className="rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            Comentar
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.3)]">Nenhuma publicação ainda.</div>
            )}
          </main>
        ) : null}

        {!searchSubmitted && activeTab === "network" ? (
            <section id="minha-rede" className="mx-auto max-w-5xl space-y-6">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-12 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.55),_transparent_35%),linear-gradient(120deg,#0f172a_0%,#1d4ed8_55%,#2563eb_100%)]" />
                <div className="px-5 pb-5">
                  <div className="-mt-6 relative h-14 w-14 rounded-full border-4 border-white shadow-sm">
                    {me?.avatar_url ? (
                      <div
                        className="h-full w-full rounded-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${me.avatar_url})` }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-semibold text-white">
                        {initials(currentName)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div className="mt-3">
                    <p className="text-lg font-semibold text-slate-900">{currentName}</p>
                    <p className="mt-1 text-sm text-slate-500">{profileRoleLine(me)}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Rede interna para compartilhamento entre areas, projetos e liderancas.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Minha rede</p>
                <div className="mt-4 space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Membros da empresa</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {contacts.length ? (
                        visibleContacts.map((contact) => (
                            <Link
                              key={contact.id}
                              href={`/institucional/rede-social/membros/${contact.id}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-left transition hover:border-slate-300 hover:bg-white"
                            >
                              <div className="mx-auto h-14 w-14 rounded-full">
                                {contact.avatar_url ? (
                                  <div
                                    className="h-full w-full rounded-full bg-cover bg-center"
                                    style={{ backgroundImage: `url(${contact.avatar_url})` }}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-sm font-semibold text-white">
                                    {initials(displayName(contact))}
                                  </div>
                                )}
                              </div>
                              <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">{highlightMatch(displayName(contact), searchTerm)}</p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a66c2]">
                                @{mentionDirectory.byUserId.get(contact.id)?.handle ?? contact.id.slice(0, 8).toLowerCase()}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{highlightMatch((contact.cargo ?? "").trim() || "Cargo não informado", searchTerm)}</p>
                              <p className="mt-1 text-xs text-slate-400">{highlightMatch((contact.setor ?? "").trim() || "Setor não informado", searchTerm)}</p>
                              <span
                                className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  onlineUserIds.has(contact.id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {onlineUserIds.has(contact.id) ? "Online" : "Offline"}
                              </span>
                            </Link>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500 sm:col-span-2 lg:col-span-3 xl:col-span-5">
                          Nenhum membro listado na rede interna.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-900">Membros por projeto</p>
                    <div className="mt-3 space-y-4">
                      {visibleProjects.length ? (
                        visibleProjects.map((project) => (
                          <div key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">{highlightMatch(project.name, searchTerm)}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                              {(visibleProjectTeamMap[project.id] ?? []).length ? (
                                (visibleProjectTeamMap[project.id] ?? []).map((member) => (
                                  <Link
                                    key={member.id}
                                    href={`/institucional/rede-social/membros/${member.id}`}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-slate-300"
                                  >
                                    <p className="text-sm font-semibold text-slate-900">{highlightMatch(displayName(member), searchTerm)}</p>
                                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a66c2]">
                                      @{mentionDirectory.byUserId.get(member.id)?.handle ?? member.id.slice(0, 8).toLowerCase()}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">{highlightMatch((member.cargo ?? "").trim() || "Cargo não informado", searchTerm)}</p>
                                    <p className="mt-1 text-xs text-slate-400">{highlightMatch((member.setor ?? "").trim() || "Setor não informado", searchTerm)}</p>
                                    <span
                                      className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                                        onlineUserIds.has(member.id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {onlineUserIds.has(member.id) ? "Online" : "Offline"}
                                    </span>
                                  </Link>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500 sm:col-span-2 lg:col-span-3 xl:col-span-5">
                                  Nenhum membro listado neste projeto.
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                          Nenhum projeto vinculado ao seu perfil.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </section>
        ) : null}

        {!searchSubmitted && activeTab === "communities" ? (
          <section id="comunidades" className="mx-auto max-w-6xl space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Comunidades</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">Grupos internos por tema, area ou iniciativa</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "Todas" },
                    { id: "joined", label: "Minhas" },
                    { id: "discover", label: "Descobrir" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCommunityFilter(item.id as "all" | "joined" | "discover")}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        communityFilter === item.id
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[320px,1fr]">
                <div className="space-y-3">
                  {visibleGroups.length ? (
                    visibleGroups.map((group) => {
                      const memberCount = groupMembers.filter((item) => item.group_id === group.id).length;
                      const joined = joinedGroupIds.has(group.id);
                      const active = selectedCommunityId === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setSelectedCommunityId(group.id)}
                          className={`block w-full rounded-3xl border p-4 text-left transition ${
                            active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 hover:bg-white"
                          }`}
                        >
                          <div
                            className="mb-3 h-2 rounded-full"
                            style={{ backgroundColor: group.cover_color || "#0f172a" }}
                          />
                          <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>{group.name}</p>
                          <p className={`mt-1 text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{group.description}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${active ? "text-slate-200" : "text-slate-400"}`}>
                              {memberCount} membro(s)
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${joined ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                              {joined ? "Participando" : "Disponivel"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Nenhuma comunidade encontrada para o filtro atual.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedCommunity ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div
                            className="mb-3 h-2 w-32 rounded-full"
                            style={{ backgroundColor: selectedCommunity.cover_color || "#0f172a" }}
                          />
                          <p className="text-xl font-semibold text-slate-900">{selectedCommunity.name}</p>
                          <p className="mt-2 max-w-2xl text-sm text-slate-600">{selectedCommunity.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleGroupMembership(selectedCommunity)}
                          className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                            joinedGroupIds.has(selectedCommunity.id)
                              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              : "bg-[#0a66c2] text-white hover:bg-[#004182]"
                          }`}
                        >
                          {joinedGroupIds.has(selectedCommunity.id) ? "Sair da comunidade" : "Entrar na comunidade"}
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Membros</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">
                            {groupMembers.filter((item) => item.group_id === selectedCommunity.id).length}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Posts</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">
                            {posts.filter((item) => item.audience_type === "group" && item.audience_group_id === selectedCommunity.id).length}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Privacidade</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCommunity.is_private ? "Privada" : "Aberta"}</p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">Feed da comunidade</p>
                        <div className="mt-3 space-y-3">
                          {posts.filter((item) => item.audience_type === "group" && item.audience_group_id === selectedCommunity.id).length ? (
                            posts
                              .filter((item) => item.audience_type === "group" && item.audience_group_id === selectedCommunity.id)
                              .slice(0, 6)
                              .map((post) => (
                                <div key={`community-post-${post.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{post.author_name}</p>
                                      <p className="text-xs text-slate-500">{when(post.created_at)}</p>
                                    </div>
                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      {postTypeLabel(post.post_type)}
                                    </span>
                                  </div>
                                  {post.text ? (
                                    <RichText
                                      className="mt-3 text-sm text-slate-700 [&_p]:whitespace-pre-wrap"
                                      value={post.text}
                                      mentionDirectory={mentionDirectory.byHandle}
                                    />
                                  ) : null}
                                </div>
                              ))
                          ) : (
                            <p className="text-sm text-slate-500">Ainda nao ha publicacoes nesta comunidade.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                      Selecione uma comunidade para ver detalhes e participar.
                    </div>
                  )}

                  {canModeratePosts ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Moderacao</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">Fila inicial de denuncias</p>
                        </div>
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          {reports.filter((item) => item.status === "open").length} abertas
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {reports.length ? (
                          reports.slice(0, 8).map((report) => (
                            <div key={report.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{report.reason}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Status: {report.status} • {when(report.created_at)}
                                  </p>
                                  {report.details ? <p className="mt-2 text-sm text-slate-600">{report.details}</p> : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void updateReportStatus(report.id, "reviewing")}
                                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                                  >
                                    Em analise
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void updateReportStatus(report.id, "resolved")}
                                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                  >
                                    Resolver
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void updateReportStatus(report.id, "dismissed")}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    Descartar
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Nenhuma denuncia registrada.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </section>
        ) : null}

        {!searchSubmitted && activeTab === "projects" ? (
          <section id="projetos" className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Projetos</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Ambiente colaborativo de informacoes</p>
              </div>
              <select
                value={projectBoardProjectId}
                onChange={(event) => setProjectBoardProjectId(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">Selecione o projeto</option>
                    {visibleProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                ))}
              </select>
            </div>

            {selectedProjectBoard ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[320px,1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-semibold text-slate-900">{selectedProjectBoard.name}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Informacoes basicas</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Membros: {(projectTeamMap[selectedProjectBoard.id] ?? []).length}</p>
                    <p>Publicacoes: {posts.filter((item) => item.audience_project_id === selectedProjectBoard.id).length}</p>
                    <p>Escopo social: equipe do projeto e feed colaborativo interno.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Quadro colaborativo do projeto</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use este espaco para registrar contexto, combinados e informacoes compartilhadas sobre o projeto.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {["Contexto", "Riscos", "Combinados", "Proximos passos"].map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {item}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={projectNotes[selectedProjectBoard.id] ?? ""}
                    onChange={(event) => updateProjectNote(selectedProjectBoard.id, event.target.value)}
                    rows={6}
                    placeholder="Ex.: status da equipe, informacoes relevantes, combinados internos, riscos e proximas acoes."
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-300"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => applyProjectBoardTemplate(selectedProjectBoard.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Aplicar modelo
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveProjectNote(selectedProjectBoard.id)}
                      className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Salvar quadro
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Selecione um projeto para visualizar os dados basicos e registrar informacoes colaborativas.
              </div>
            )}
          </section>
        ) : null}

        {!searchSubmitted && activeTab === "messages" ? (
          <section id="mensagens" className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 grid-cols-[360px_minmax(0,1fr)]">
              <div className="border-r border-slate-200 bg-slate-50/70 p-4">
                <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">Mensagens</p>
                      <p className="mt-1 text-xs text-slate-500">Caixa de conversa entre membros da empresa.</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      aria-label="Nova conversa"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-3">
                    <input
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                      placeholder="Pesquisar mensagens"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { id: "all" as const, label: "Todos" },
                      { id: "online" as const, label: "Online" },
                      { id: "with_history" as const, label: "Com conversa" },
                    ].map((filterItem) => (
                      <button
                        key={filterItem.id}
                        type="button"
                        onClick={() => setMessageFilter(filterItem.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          messageFilter === filterItem.id
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {filterItem.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {visibleMessagePanelContacts.length ? (
                    visibleMessagePanelContacts.map((contact) => {
                      const contactThread = messages
                        .filter(
                          (item) =>
                            (item.from_user_id === me?.id && item.to_user_id === contact.id) ||
                            (item.from_user_id === contact.id && item.to_user_id === me?.id)
                        )
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                      const last = contactThread[0];
                      const lastMessage = last ? splitMessageContent(last.text) : null;
                      const online = onlineUserIds.has(contact.id);
                      const unreadCount = messages.filter((item) => {
                        if (item.from_user_id !== contact.id || item.to_user_id !== me?.id) return false;
                        const readAt = readThreadAt[contact.id];
                        return !readAt || item.created_at > readAt;
                      }).length;
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserId(contact.id);
                            markThreadAsRead(contact.id);
                          }}
                          className={`flex w-full items-start gap-3 rounded-2xl border-l-4 px-3 py-3 text-left transition ${
                            contact.id === selectedUserId
                              ? "border-blue-300 border-l-[#0a66c2] bg-blue-50 shadow-sm"
                              : unreadCount > 0
                                ? "border-blue-200 border-l-blue-300 bg-blue-50/40 hover:bg-blue-50"
                                : "border-slate-200 border-l-transparent bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="relative mt-0.5 h-11 w-11 shrink-0 rounded-full">
                            {contact.avatar_url ? (
                              <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${contact.avatar_url})` }} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-xs font-semibold text-white">
                                {initials(displayName(contact))}
                              </div>
                            )}
                            {online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">{highlightMatch(displayName(contact), searchTerm)}</p>
                              <div className="flex shrink-0 items-center gap-2">
                                {unreadCount > 0 ? (
                                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#0a66c2] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                    {unreadCount}
                                  </span>
                                ) : null}
                              <span className="text-[11px] text-slate-400">{last ? when(last.created_at) : "Sem conversa"}</span>
                              </div>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {online ? "Online agora" : lastSeenLabel(presenceMap[contact.id]?.lastSeenAt)}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {last
                                ? lastMessage?.body || (lastMessage?.attachmentRefs?.length ? "Anexo compartilhado." : "")
                                : "Clique para iniciar a conversa."}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Nenhuma conversa encontrada para os filtros atuais.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-[680px] flex-col p-4">
                {selectedUserId && selectedMessageProfile ? (
                  <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="h-10 w-10 rounded-full">
                        {selectedMessageProfile.avatar_url ? (
                          <div
                            className="h-full w-full rounded-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${selectedMessageProfile.avatar_url})` }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-xs font-semibold text-white">
                            {initials(displayName(selectedMessageProfile))}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{displayName(selectedMessageProfile)}</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              onlineUserIds.has(selectedUserId) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {onlineUserIds.has(selectedUserId) ? "Online" : "Offline"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{profileRoleLine(selectedMessageProfile)}</p>
                        <p className="text-xs text-slate-400">
                          {onlineUserIds.has(selectedUserId) ? "Online agora" : lastSeenLabel(presenceMap[selectedUserId]?.lastSeenAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4" onMouseDown={() => markThreadAsRead(selectedUserId)}>
                      <div className="space-y-3">
                        {activeThread.length ? (
                          activeThread.map((item, index) => {
                            const mine = item.from_user_id === me?.id;
                            const parsedMessage = splitMessageContent(item.text);
                            const currentDay = new Date(item.created_at).toDateString();
                            const previousDay = index > 0 ? new Date(activeThread[index - 1].created_at).toDateString() : "";
                            const showDivider = index === 0 || currentDay !== previousDay;
                            return (
                              <div key={item.id} className="space-y-3">
                                {showDivider ? (
                                  <div className="flex items-center gap-3 py-1">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      {conversationDayLabel(item.created_at)}
                                    </span>
                                    <div className="h-px flex-1 bg-slate-200" />
                                  </div>
                                ) : null}
                                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                      mine ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-800"
                                    }`}
                                  >
                                    {parsedMessage.body ? <p className="whitespace-pre-wrap">{parsedMessage.body}</p> : null}
                                    {parsedMessage.attachmentRefs.length ? (
                                      <div className="mt-2 space-y-2">
                                        {parsedMessage.attachmentRefs.map((attachmentRef) => {
                                          const attachmentUrl =
                                            messageMediaUrls[`${item.id}:${attachmentRef}`] ||
                                            (isAbsoluteUrl(attachmentRef) ? attachmentRef : attachmentRef);
                                          const attachmentType = inferAttachmentTypeFromUrl(attachmentRef);
                                          return (
                                            <div
                                              key={`${item.id}-${attachmentRef}`}
                                              className={`overflow-hidden rounded-xl border px-3 py-2 text-xs ${
                                                mine ? "border-white/15 bg-white/10" : "border-slate-200 bg-slate-50"
                                              }`}
                                            >
                                              <p className={`font-semibold ${mine ? "text-slate-200" : "text-slate-600"}`}>Anexo</p>
                                              {attachmentType === "image" ? (
                                                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg">
                                                  <Image
                                                    src={attachmentUrl}
                                                    alt="Imagem anexada"
                                                    width={640}
                                                    height={360}
                                                    unoptimized
                                                    className="max-h-56 w-full object-cover"
                                                  />
                                                </a>
                                              ) : attachmentType === "video" ? (
                                                <video src={attachmentUrl} controls className="mt-2 max-h-56 w-full rounded-lg bg-slate-950" />
                                              ) : null}
                                              <a
                                                href={attachmentUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`mt-2 block truncate underline ${mine ? "text-white" : "text-[#0a66c2]"}`}
                                              >
                                                Abrir anexo
                                              </a>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : null}
                                    <p className={`mt-2 text-[11px] ${mine ? "text-slate-300" : "text-slate-400"}`}>{when(item.created_at)}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                            Nenhuma mensagem ainda nesta conversa.
                          </div>
                        )}
                        <div ref={threadEndRef} />
                      </div>
                    </div>
                    <div className="border-t border-slate-200 bg-white px-4 py-4">
                      <input
                        ref={messageFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        className="hidden"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          files.forEach((file) => {
                            void uploadMessageAttachment(file);
                          });
                          event.currentTarget.value = "";
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                        <button
                          type="button"
                          onClick={() => messageFileInputRef.current?.click()}
                          className="rounded-full border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50"
                        >
                          Anexo
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMessageEmojiPicker((prev) => !prev)}
                          className="rounded-full border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50"
                        >
                          🙂
                        </button>
                      </div>
                      {showMessageEmojiPicker ? (
                        <EmojiPicker
                          groups={EMOJI_GROUPS}
                          className="mt-3"
                          panelClassName="max-h-56"
                          onSelect={(emoji) => {
                            setMessageText((prev) => `${prev}${prev ? " " : ""}${emoji}`);
                            setShowMessageEmojiPicker(false);
                          }}
                        />
                      ) : null}
                      {messageAttachments.length ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {messageAttachments.map((attachment, index) => (
                            <div
                              key={`${attachment.url}-${index}`}
                              className={`overflow-hidden rounded-2xl border px-3 py-3 ${
                                messageDropActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              {attachment.type === "image" ? (
                                <Image
                                  src={attachment.url}
                                  alt={attachment.label}
                                  width={640}
                                  height={360}
                                  unoptimized
                                  className="h-32 w-full rounded-xl object-cover"
                                />
                              ) : attachment.type === "video" ? (
                                <video src={attachment.url} controls className="h-32 w-full rounded-xl bg-slate-950 object-cover" />
                              ) : null}
                              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                                <span className="truncate font-semibold text-slate-600">{attachment.label}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMessageAttachments((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
                                  }
                                  className="font-semibold text-rose-600 hover:text-rose-700"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <textarea
                          value={messageText}
                          onChange={(event) => setMessageText(event.target.value)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setMessageDropActive(true);
                          }}
                          onDragLeave={(event) => {
                            event.preventDefault();
                            setMessageDropActive(false);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            setMessageDropActive(false);
                            const files = Array.from(event.dataTransfer.files ?? []);
                            files.forEach((file) => {
                              void uploadMessageAttachment(file);
                            });
                          }}
                          placeholder="Escreva uma mensagem"
                          rows={3}
                          className={`min-h-[88px] flex-1 resize-none rounded-2xl border px-3 py-3 text-sm text-slate-900 ${
                            messageDropActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                          }`}
                        />
                        <button
                          type="button"
                          disabled={busy || (!messageText.trim() && !messageAttachments.length) || !selectedUserId}
                          onClick={() => void sendMessage()}
                          className="self-end rounded-2xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[520px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                            Nenhuma mensagem ainda nesta conversa. Selecione um membro da lista para abrir o histórico ou iniciar uma nova conversa.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {editingPost ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="flex h-[min(92vh,860px)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_40px_120px_-36px_rgba(15,23,42,0.55)] md:mx-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(37,99,235,0.65)]">
                  {initials(editingPost.author_name || currentName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{editingPost.author_name || currentName}</p>
                  <p className="text-sm text-slate-500">Editando publicação em {editingPost.audience_label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelEditPost}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fechar edição de publicação"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4 pb-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Editar publicação</p>
                  <p className="mt-1 text-sm text-slate-600">Ajuste o texto e a formatação antes de salvar.</p>
                </div>

                {editingPost.attachments.length ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mídia atual</p>
                      <p className="mt-1 text-sm text-slate-600">A imagem ou vídeo do post é exibido aqui apenas para referência visual.</p>
                    </div>
                    {editingPost.attachments.map((attachment) => (
                      <div key={attachment.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                        {(() => {
                          const mediaUrl = attachment.resolvedUrl || attachment.url;
                          return attachment.type === "image" ? (
                            <Image
                              src={mediaUrl}
                              alt={attachment.label ?? "Imagem do post"}
                              width={1200}
                              height={900}
                              unoptimized
                              className="max-h-[280px] w-full object-cover"
                            />
                          ) : attachment.type === "video" ? (
                            <video controls src={mediaUrl} className="max-h-[280px] w-full bg-slate-950" />
                          ) : (
                            <a
                              href={mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block px-4 py-3 text-sm font-semibold text-blue-700 hover:underline"
                            >
                              Abrir anexo
                            </a>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : null}

                <textarea
                  ref={editingPostTextareaRef}
                  value={editingPostText}
                  onChange={(event) => setEditingPostText(event.target.value)}
                  rows={8}
                  className="min-h-[220px] w-full resize-none rounded-[1.5rem] border border-transparent bg-white px-2 py-2 text-[16px] leading-7 text-slate-700 outline-none placeholder:text-slate-400 focus:border-transparent focus:ring-0"
                />

                <RichTextToolbar
                  onAction={(action) =>
                    applyRichTextAction(action, editingPostText, setEditingPostText, editingPostTextareaRef.current)
                  }
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
              <button
                type="button"
                onClick={cancelEditPost}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy || !editingPostText.trim()}
                onClick={() => void saveEditedPost()}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {composerExpanded ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="flex h-[min(92vh,920px)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_40px_120px_-36px_rgba(15,23,42,0.55)] md:mx-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-blue-700 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(37,99,235,0.65)]">
                  {initials(currentName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900">{currentName}</p>
                  <p className="text-sm text-slate-500">
                    Publicar em
                    {" "}
                    {scopeType === "project"
                      ? projects.find((item) => item.id === projectId)?.name ?? "equipe de projeto"
                      : scopeType === "group"
                        ? groups.find((item) => item.id === groupId)?.name ?? "comunidade"
                        : "toda a empresa"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComposerExpanded(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fechar criação de publicação"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="space-y-4 pb-2">
              <div className={`grid gap-3 ${canPublishOfficial ? "md:grid-cols-[1fr,1fr,1fr,1fr]" : "md:grid-cols-[1fr,1fr,1fr]"}`}>
                <select
                  value={scopeType}
                  onChange={(event) => {
                    const raw = event.target.value;
                    const next = raw === "project" ? "project" : raw === "group" ? "group" : "company";
                    setScopeType(next);
                    if (next !== "project") setProjectId("");
                    if (next !== "group") setGroupId("");
                  }}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.4)]"
                >
                  <option value="company">Toda a empresa</option>
                  <option value="project">Equipe de projeto</option>
                  <option value="group">Comunidade</option>
                </select>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={scopeType !== "project"}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.4)] disabled:bg-slate-100"
                >
                  <option value="">Selecione o projeto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                  disabled={scopeType !== "group"}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.4)] disabled:bg-slate-100"
                >
                  <option value="">Selecione a comunidade</option>
                  {groups
                    .filter((item) => joinedGroupIds.has(item.id))
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                </select>
                {canPublishOfficial ? (
                  <select
                    value={postType}
                    onChange={(event) => setPostType((event.target.value as PostType) || "social")}
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.4)]"
                  >
                    <option value="social">Post social</option>
                    <option value="announcement">Comunicado oficial</option>
                    <option value="campaign">Campanha interna</option>
                    <option value="event">Evento</option>
                    <option value="recognition">Reconhecimento</option>
                  </select>
                ) : null}
              </div>

              <textarea
                id="social-post-textarea"
                ref={composerTextareaRef}
                value={postText}
                onChange={(event) => setPostText(event.target.value)}
                rows={6}
                placeholder="Sobre o que você quer falar?"
                className="min-h-[180px] w-full resize-none rounded-[1.5rem] border border-transparent bg-white px-2 py-2 text-[16px] leading-7 text-slate-700 outline-none placeholder:text-slate-400 focus:border-transparent focus:ring-0"
              />

              {isOfficialPostType(postType) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Este post sera tratado como comunicacao institucional e podera gerar notificacoes para o publico-alvo.
                </div>
              ) : null}

              <RichTextToolbar
                onAction={(action) => applyRichTextAction(action, postText, setPostText, composerTextareaRef.current)}
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Enquete</p>
                    <p className="text-xs text-slate-500">Adicione uma pergunta com 2 a 4 opcoes.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPollEnabled((prev) => !prev);
                      if (pollEnabled) {
                        setPollQuestion("");
                        setPollOptions(["", ""]);
                      }
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      pollEnabled ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {pollEnabled ? "Remover enquete" : "Adicionar enquete"}
                  </button>
                </div>
                {pollEnabled ? (
                  <div className="mt-3 space-y-3">
                    <input
                      value={pollQuestion}
                      onChange={(event) => setPollQuestion(event.target.value)}
                      placeholder="Pergunta da enquete"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pollOptions.map((option, index) => (
                        <input
                          key={`poll-option-${index}`}
                          value={option}
                          onChange={(event) =>
                            setPollOptions((prev) => prev.map((item, currentIndex) => (currentIndex === index ? event.target.value : item)))
                          }
                          placeholder={`Opcao ${index + 1}`}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                        />
                      ))}
                    </div>
                    {pollOptions.length < 4 ? (
                      <button
                        type="button"
                        onClick={() => setPollOptions((prev) => [...prev, ""])}
                        className="text-sm font-semibold text-[#0a66c2] hover:underline"
                      >
                        Adicionar opcao
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {draftAttachments.length ? (
                <div className={`grid gap-3 ${draftAttachments.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                  {draftAttachments.map((item, index) => (
                    <div key={`${item.url}-${index}`} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                      {item.type === "image" ? (
                        <Image
                          src={item.url}
                          alt={item.label}
                          width={1200}
                          height={900}
                          unoptimized
                          className={`${draftAttachments.length === 1 ? "max-h-[360px]" : "h-56"} w-full object-cover`}
                        />
                      ) : item.type === "video" ? (
                        <video
                          src={item.url}
                          controls
                          className={`${draftAttachments.length === 1 ? "max-h-[360px]" : "h-56"} w-full bg-slate-950 object-cover`}
                        />
                      ) : null}
                      <div className="flex items-center justify-end gap-3 px-3 py-2 text-xs font-semibold text-slate-600">
                        <button
                          type="button"
                          onClick={() => setDraftAttachments((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                          className="text-slate-500 hover:text-rose-600"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setComposerExpanded(false);
                    setShowComposerEmojiPicker(false);
                    setShowComposerMentionPicker(false);
                    setMentionQuery("");
                    setPostText("");
                    setPostType("social");
                    setDraftAttachments([]);
                    setProjectId("");
                    setGroupId("");
                    setScopeType("company");
                    setPollEnabled(false);
                    setPollQuestion("");
                    setPollOptions(["", ""]);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  {uploadingMedia ? "Enviando mídia..." : "Vídeo ou foto"}
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    disabled={uploadingMedia || busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadMedia(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowComposerMentionPicker((prev) => !prev);
                      setMentionQuery("");
                    }}
                    className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Mencao
                  </button>
                  {showComposerMentionPicker ? (
                    <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-10 w-[22rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
                      <input
                        value={mentionQuery}
                        onChange={(event) => setMentionQuery(event.target.value)}
                        placeholder="Buscar pessoa ou @handle"
                        className="mb-3 h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                      />
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {composerMentionOptions.length ? (
                          composerMentionOptions.map((profile) => {
                            const mentionMeta = mentionDirectory.byUserId.get(profile.id);
                            if (!mentionMeta) return null;
                            return (
                              <button
                                key={`mention-${profile.id}`}
                                type="button"
                                onClick={() => {
                                  insertTextAtCursor(
                                    postText,
                                    setPostText,
                                    composerTextareaRef.current,
                                    `${postText && !postText.endsWith(" ") ? " " : ""}@${mentionMeta.handle} `
                                  );
                                  setShowComposerMentionPicker(false);
                                  setMentionQuery("");
                                }}
                                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                              >
                                <p className="text-sm font-semibold text-slate-900">{mentionMeta.label}</p>
                                <p className="text-xs text-slate-500">@{mentionMeta.handle}</p>
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">Nenhum colaborador encontrado.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowComposerEmojiPicker((prev) => !prev)}
                    className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Emoji
                  </button>
                  {showComposerEmojiPicker ? (
                    <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-10 w-[28rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Adicionar emoji</p>
                      <EmojiPicker
                        groups={EMOJI_GROUPS}
                        panelClassName="max-h-72"
                        onSelect={(emoji) => {
                          setPostText((prev) => `${prev}${emoji}`);
                          composerTextareaRef.current?.focus();
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                disabled={
                  busy ||
                  uploadingMedia ||
                  (!postText.trim() && !draftAttachments.length && !pollEnabled) ||
                  (scopeType === "project" && !projectId) ||
                  (scopeType === "group" && !groupId)
                }
                onClick={() => void submitPost()}
                className="rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

