import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CountedDelete = {
  error: { message: string } | null;
  count: number | null;
};

export type ProjectPulseHubCleanupResult = {
  skipped: boolean;
  posts_deleted: number;
  project_boards_deleted: number;
  notifications_deleted: number;
};

function isMissingRelation(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("relation") ||
    normalized.includes("could not find the table")
  );
}

async function deleteByChunks(
  table: string,
  column: string,
  ids: string[],
  entityType?: "post" | "comment"
) {
  let deleted = 0;
  const chunkSize = 500;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    let query = supabaseAdmin.from(table).delete({ count: "exact" }).in(column, chunk);
    if (entityType) query = query.eq("entity_type", entityType);

    const res = (await query) as CountedDelete;
    if (res.error) {
      if (isMissingRelation(res.error.message)) return { deleted, skipped: true };
      throw new Error(res.error.message);
    }
    deleted += res.count ?? 0;
  }

  return { deleted, skipped: false };
}

export async function cleanupPulseHubProjectData(projectIds: string[]): Promise<ProjectPulseHubCleanupResult> {
  const ids = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) {
    return { skipped: false, posts_deleted: 0, project_boards_deleted: 0, notifications_deleted: 0 };
  }

  const postsRes = await supabaseAdmin.from("internal_social_posts").select("id").in("audience_project_id", ids);
  if (postsRes.error) {
    if (isMissingRelation(postsRes.error.message)) {
      return { skipped: true, posts_deleted: 0, project_boards_deleted: 0, notifications_deleted: 0 };
    }
    throw new Error(postsRes.error.message);
  }

  const postIds = (postsRes.data ?? []).map((row) => String((row as { id: string }).id)).filter(Boolean);
  let commentIds: string[] = [];
  if (postIds.length > 0) {
    const commentsRes = await supabaseAdmin.from("internal_social_post_comments").select("id").in("post_id", postIds);
    if (commentsRes.error) {
      if (!isMissingRelation(commentsRes.error.message)) throw new Error(commentsRes.error.message);
    } else {
      commentIds = (commentsRes.data ?? []).map((row) => String((row as { id: string }).id)).filter(Boolean);
    }
  }

  let notificationsDeleted = 0;
  if (postIds.length > 0) {
    const postNotifications = await deleteByChunks("internal_social_notifications", "entity_id", postIds, "post");
    notificationsDeleted += postNotifications.deleted;
  }
  if (commentIds.length > 0) {
    const commentNotifications = await deleteByChunks("internal_social_notifications", "entity_id", commentIds, "comment");
    notificationsDeleted += commentNotifications.deleted;
  }

  const boards = await deleteByChunks("internal_social_project_boards", "project_id", ids);
  const posts = postIds.length > 0 ? await deleteByChunks("internal_social_posts", "id", postIds) : { deleted: 0, skipped: false };

  return {
    skipped: boards.skipped || posts.skipped,
    posts_deleted: posts.deleted,
    project_boards_deleted: boards.deleted,
    notifications_deleted: notificationsDeleted,
  };
}
