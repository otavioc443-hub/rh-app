import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    }
  | {
      type: "group_message_notify";
      messageId: string;
      groupId: string;
      preview?: string | null;
    };

type DirectoryProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  active: boolean | null;
};

type CollaboratorDirectoryRow = {
  user_id: string | null;
  nome: string | null;
};

function slugifyHandle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function displayName(profile: DirectoryProfile, collaboratorName?: string | null) {
  const full = (profile.full_name ?? "").trim();
  if (full && !full.includes("@")) return full;
  const fallbackName = (collaboratorName ?? "").trim();
  if (fallbackName && !fallbackName.includes("@")) return fallbackName;
  const email = (profile.email ?? "").trim();
  return email || "Colaborador";
}

function buildMentionDirectory(
  profiles: DirectoryProfile[],
  collaborators: CollaboratorDirectoryRow[]
) {
  const collaboratorMap = new Map<string, string>();
  for (const item of collaborators) {
    if (item.user_id) collaboratorMap.set(item.user_id, item.nome ?? "");
  }

  const usedHandles = new Set<string>();
  const byHandle = new Map<string, { id: string; label: string }>();
  for (const profile of [...profiles].sort((a, b) => a.id.localeCompare(b.id))) {
    if (profile.active !== true) continue;
    const label = displayName(profile, collaboratorMap.get(profile.id));
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
    byHandle.set(nextHandle, { id: profile.id, label });
  }

  return byHandle;
}

function extractMentionHandles(text: string) {
  const matches = text.match(/(^|[\s(])@([a-z0-9._-]{2,50})/gi) ?? [];
  const handles = new Set<string>();
  for (const item of matches) {
    const handle = item.trim().replace(/^@/, "").toLowerCase();
    if (handle) handles.add(handle);
  }
  return [...handles];
}

function extractHashtags(text: string) {
  const matches = text.match(/(^|[\s(])#([a-z0-9][a-z0-9_-]{1,49})/gi) ?? [];
  const tags = new Set<string>();
  for (const item of matches) {
    const tag = item.trim().replace(/^#/, "").toLowerCase();
    if (tag) tags.add(tag);
  }
  return [...tags];
}

function compactText(value: string | null | undefined, max = 160) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

async function getRequesterUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return { user: null, status: 401 as const, token };
    return { user: data.user, status: 200 as const, token };
  }

  const supabaseServer = await getServerSupabase();
  const { data } = await supabaseServer.auth.getUser();
  return { user: data?.user ?? null, status: data?.user ? (200 as const) : (401 as const), token };
}

async function getRequesterSupabase(token: string | null): Promise<SupabaseClient> {
  if (token) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return getServerSupabase();
}

async function loadDirectory(supabaseUser: SupabaseClient) {
  const [profilesRes, collaboratorsRes] = await Promise.all([
    supabaseUser.from("profiles").select("id,full_name,email,active"),
    supabaseUser.from("colaboradores").select("user_id,nome"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (collaboratorsRes.error) throw new Error(collaboratorsRes.error.message);

  return buildMentionDirectory(
    (profilesRes.data ?? []) as DirectoryProfile[],
    (collaboratorsRes.data ?? []) as CollaboratorDirectoryRow[]
  );
}

async function syncPost(
  supabaseUser: SupabaseClient,
  requesterUserId: string,
  body: Extract<SyncBody, { type: "post_sync" }>
) {
  const { data: post, error: postError } = await supabaseUser
    .from("internal_social_posts")
    .select("id,author_user_id,audience_type,audience_project_id,post_type")
    .eq("id", body.postId)
    .maybeSingle<{
      id: string;
      author_user_id: string;
      audience_type: "company" | "project";
      audience_project_id: string | null;
      post_type: string | null;
    }>();
  if (postError) throw new Error(postError.message);
  if (!post?.id || post.author_user_id !== requesterUserId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const directory = await loadDirectory(supabaseUser);
  const mentionedUsers = extractMentionHandles(body.text)
    .map((handle) => ({ handle, mention: directory.get(handle) }))
    .filter((item): item is { handle: string; mention: { id: string; label: string } } => Boolean(item.mention))
    .filter((item) => item.mention.id !== requesterUserId);
  const hashtags = extractHashtags(body.text);

  await supabaseAdmin.from("internal_social_mentions").delete().eq("post_id", body.postId);
  await supabaseAdmin.from("internal_social_hashtags").delete().eq("post_id", body.postId);

  if (mentionedUsers.length) {
    await supabaseAdmin.from("internal_social_mentions").insert(
      mentionedUsers.map((item) => ({
        post_id: body.postId,
        mentioned_user_id: item.mention.id,
        mentioned_by_user_id: requesterUserId,
        handle: item.handle,
      }))
    );
  }

  if (hashtags.length) {
    await supabaseAdmin.from("internal_social_hashtags").insert(
      hashtags.map((tag) => ({
        post_id: body.postId,
        tag,
      }))
    );
  }

  if (mentionedUsers.length) {
    await supabaseAdmin.from("internal_social_notifications").insert(
      mentionedUsers.map((item) => ({
        user_id: item.mention.id,
        actor_user_id: requesterUserId,
        kind: "mention",
        entity_type: "post",
        entity_id: body.postId,
        title: "Voce foi mencionado em uma publicacao",
        body: compactText(body.text),
        link_url: "/institucional/rede-social",
      }))
    );
  }

  const postType = String(body.postType ?? post.post_type ?? "social");
  if (body.broadcastOfficial !== true || !["announcement", "campaign"].includes(postType)) {
    return NextResponse.json({ ok: true });
  }

  let targetUserIds: string[] = [];
  if (post.audience_type === "project" && post.audience_project_id) {
    const { data: members, error: membersError } = await supabaseUser
      .from("project_members")
      .select("user_id")
      .eq("project_id", post.audience_project_id);
    if (membersError) throw new Error(membersError.message);
    targetUserIds = ((members ?? []) as Array<{ user_id: string | null }>)
      .map((item) => item.user_id ?? "")
      .filter(Boolean);
  } else {
    const { data: profiles, error: profilesError } = await supabaseUser
      .from("profiles")
      .select("id,active")
      .eq("active", true);
    if (profilesError) throw new Error(profilesError.message);
    targetUserIds = ((profiles ?? []) as Array<{ id: string; active: boolean | null }>)
      .filter((item) => item.active === true)
      .map((item) => item.id);
  }

  const dedupedTargetUserIds = Array.from(new Set(targetUserIds)).filter((userId) => userId !== requesterUserId);
  if (dedupedTargetUserIds.length) {
    await supabaseAdmin.from("internal_social_notifications").insert(
      dedupedTargetUserIds.map((userId) => ({
        user_id: userId,
        actor_user_id: requesterUserId,
        kind: postType === "campaign" ? "campaign" : "announcement",
        entity_type: "post",
        entity_id: body.postId,
        title: postType === "campaign" ? "Nova campanha interna" : "Novo comunicado oficial",
        body: compactText(body.text),
        link_url: "/institucional/rede-social",
      }))
    );
  }

  return NextResponse.json({ ok: true });
}

async function syncComment(
  supabaseUser: SupabaseClient,
  requesterUserId: string,
  body: Extract<SyncBody, { type: "comment_sync" }>
) {
  const [commentRes, postRes] = await Promise.all([
    supabaseUser
      .from("internal_social_post_comments")
      .select("id,author_user_id")
      .eq("id", body.commentId)
      .maybeSingle<{ id: string; author_user_id: string }>(),
    supabaseUser
      .from("internal_social_posts")
      .select("id,author_user_id")
      .eq("id", body.postId)
      .maybeSingle<{ id: string; author_user_id: string }>(),
  ]);
  if (commentRes.error) throw new Error(commentRes.error.message);
  if (postRes.error) throw new Error(postRes.error.message);
  if (!commentRes.data?.id || commentRes.data.author_user_id !== requesterUserId || !postRes.data?.id) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const directory = await loadDirectory(supabaseUser);
  const mentionedUsers = extractMentionHandles(body.text)
    .map((handle) => ({ handle, mention: directory.get(handle) }))
    .filter((item): item is { handle: string; mention: { id: string; label: string } } => Boolean(item.mention))
    .filter((item) => item.mention.id !== requesterUserId);
  const hashtags = extractHashtags(body.text);

  await supabaseAdmin.from("internal_social_mentions").delete().eq("comment_id", body.commentId);
  await supabaseAdmin.from("internal_social_hashtags").delete().eq("comment_id", body.commentId);

  if (mentionedUsers.length) {
    await supabaseAdmin.from("internal_social_mentions").insert(
      mentionedUsers.map((item) => ({
        comment_id: body.commentId,
        mentioned_user_id: item.mention.id,
        mentioned_by_user_id: requesterUserId,
        handle: item.handle,
      }))
    );

    await supabaseAdmin.from("internal_social_notifications").insert(
      mentionedUsers.map((item) => ({
        user_id: item.mention.id,
        actor_user_id: requesterUserId,
        kind: "mention",
        entity_type: "comment",
        entity_id: body.commentId,
        title: "Voce foi mencionado em um comentario",
        body: compactText(body.text),
        link_url: "/institucional/rede-social",
      }))
    );
  }

  if (hashtags.length) {
    await supabaseAdmin.from("internal_social_hashtags").insert(
      hashtags.map((tag) => ({
        comment_id: body.commentId,
        tag,
      }))
    );
  }

  if (body.notifyPostAuthor === true && postRes.data.author_user_id !== requesterUserId) {
    await supabaseAdmin.from("internal_social_notifications").insert({
      user_id: postRes.data.author_user_id,
      actor_user_id: requesterUserId,
      kind: "comment",
      entity_type: "comment",
      entity_id: body.commentId,
      title: "Novo comentario na sua publicacao",
      body: compactText(body.text),
      link_url: "/institucional/rede-social",
    });
  }

  return NextResponse.json({ ok: true });
}

async function notifyReaction(
  supabaseUser: SupabaseClient,
  requesterUserId: string,
  body: Extract<SyncBody, { type: "reaction_notify" }>
) {
  const { data: post, error } = await supabaseUser
    .from("internal_social_posts")
    .select("id,author_user_id")
    .eq("id", body.postId)
    .maybeSingle<{ id: string; author_user_id: string }>();
  if (error) throw new Error(error.message);
  if (!post?.id || post.author_user_id === requesterUserId) {
    return NextResponse.json({ ok: true });
  }

  await supabaseAdmin.from("internal_social_notifications").insert({
    user_id: post.author_user_id,
    actor_user_id: requesterUserId,
    kind: "reaction",
    entity_type: "post",
    entity_id: body.postId,
    title: "Nova reacao na sua publicacao",
    body: `Reacao recebida: ${body.emoji}`,
    link_url: "/institucional/rede-social",
  });

  return NextResponse.json({ ok: true });
}

async function notifyMessage(
  supabaseUser: SupabaseClient,
  requesterUserId: string,
  body: Extract<SyncBody, { type: "message_notify" }>
) {
  const { data: message, error } = await supabaseUser
    .from("internal_social_direct_messages")
    .select("id,from_user_id,to_user_id")
    .eq("id", body.messageId)
    .maybeSingle<{ id: string; from_user_id: string; to_user_id: string }>();
  if (error) throw new Error(error.message);
  if (!message?.id || message.from_user_id !== requesterUserId || message.to_user_id !== body.toUserId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  await supabaseAdmin.from("internal_social_notifications").insert({
    user_id: body.toUserId,
    actor_user_id: requesterUserId,
    kind: "message",
    entity_type: "message",
    entity_id: body.messageId,
    title: "Nova mensagem direta",
    body: compactText(body.preview),
    link_url: `/institucional/rede-social?tab=messages&user=${encodeURIComponent(requesterUserId)}`,
  });

  return NextResponse.json({ ok: true });
}

async function notifyGroupMessage(
  supabaseUser: SupabaseClient,
  requesterUserId: string,
  body: Extract<SyncBody, { type: "group_message_notify" }>
) {
  const { data: message, error } = await supabaseUser
    .from("internal_social_group_messages")
    .select("id,group_id,from_user_id")
    .eq("id", body.messageId)
    .maybeSingle<{ id: string; group_id: string; from_user_id: string }>();
  if (error) throw new Error(error.message);
  if (!message?.id || message.from_user_id !== requesterUserId || message.group_id !== body.groupId) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { data: group, error: groupError } = await supabaseUser
    .from("internal_social_message_groups")
    .select("id,name")
    .eq("id", body.groupId)
    .maybeSingle<{ id: string; name: string }>();
  if (groupError) throw new Error(groupError.message);

  const { data: members, error: membersError } = await supabaseUser
    .from("internal_social_message_group_members")
    .select("user_id")
    .eq("group_id", body.groupId);
  if (membersError) throw new Error(membersError.message);

  const recipients = ((members ?? []) as Array<{ user_id: string }>).map((item) => item.user_id).filter((userId) => userId !== requesterUserId);
  if (!recipients.length) return NextResponse.json({ ok: true });

  await supabaseAdmin.from("internal_social_notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      actor_user_id: requesterUserId,
      kind: "message",
      entity_type: "message",
      entity_id: body.messageId,
      title: `Nova mensagem em ${group?.name ?? "grupo"}`,
      body: compactText(body.preview),
      link_url: `/institucional/rede-social?tab=messages&group=${encodeURIComponent(body.groupId)}`,
    }))
  );

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const requester = await getRequesterUser(req);
    if (!requester.user) return NextResponse.json({ error: "Nao autenticado" }, { status: requester.status });

    const supabaseUser = await getRequesterSupabase(requester.token);
    const body = (await req.json().catch(() => null)) as SyncBody | null;
    if (!body?.type) return NextResponse.json({ error: "Payload invalido" }, { status: 400 });

    if (body.type === "post_sync") {
      return await syncPost(supabaseUser, requester.user.id, body);
    }
    if (body.type === "comment_sync") {
      return await syncComment(supabaseUser, requester.user.id, body);
    }
    if (body.type === "reaction_notify") {
      return await notifyReaction(supabaseUser, requester.user.id, body);
    }
    if (body.type === "message_notify") {
      return await notifyMessage(supabaseUser, requester.user.id, body);
    }
    if (body.type === "group_message_notify") {
      return await notifyGroupMessage(supabaseUser, requester.user.id, body);
    }

    return NextResponse.json({ error: "Tipo nao suportado" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
