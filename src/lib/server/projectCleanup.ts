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

export type CompanyProjectCleanupResult = {
  ok: true;
  company_id: string;
  projects_deleted: number;
  pd_projects_deleted: number;
  project_notifications_deleted: number;
  pulsehub: ProjectPulseHubCleanupResult;
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

async function selectIdsByChunks(table: string, selectColumn: string, filterColumn: string, ids: string[]) {
  const found = new Set<string>();
  const chunkSize = 500;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const res = await supabaseAdmin.from(table).select(selectColumn).in(filterColumn, chunk);
    if (res.error) {
      if (isMissingRelation(res.error.message)) return { ids: found, skipped: true };
      throw new Error(res.error.message);
    }

    for (const row of res.data ?? []) {
      const value = (row as unknown as Record<string, unknown>)[selectColumn];
      if (typeof value === "string" && value.trim()) found.add(value);
    }
  }

  return { ids: found, skipped: false };
}

async function selectIdsByEq(table: string, selectColumn: string, filterColumn: string, value: string) {
  const found = new Set<string>();
  const res = await supabaseAdmin.from(table).select(selectColumn).eq(filterColumn, value);
  if (res.error) {
    if (isMissingRelation(res.error.message)) return { ids: found, skipped: true };
    throw new Error(res.error.message);
  }

  for (const row of res.data ?? []) {
    const id = (row as unknown as Record<string, unknown>)[selectColumn];
    if (typeof id === "string" && id.trim()) found.add(id);
  }

  return { ids: found, skipped: false };
}

async function deleteProjectNotifications(projectIds: string[]) {
  let deleted = 0;
  for (const projectId of projectIds) {
    const res = await supabaseAdmin
      .from("notifications")
      .delete({ count: "exact" })
      .ilike("link", `%${projectId}%`);
    if (res.error) {
      if (isMissingRelation(res.error.message)) return deleted;
      throw new Error(res.error.message);
    }
    deleted += res.count ?? 0;
  }
  return deleted;
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

export async function findCompanyProjectIds(companyId: string) {
  const regularProjectIds = new Set<string>();
  const pdProjectIds = new Set<string>();

  const companyUsersRes = await supabaseAdmin.from("profiles").select("id").eq("company_id", companyId);
  if (companyUsersRes.error) throw new Error(companyUsersRes.error.message);
  const companyUserIds = (companyUsersRes.data ?? []).map((row) => String((row as { id: string }).id)).filter(Boolean);

  const byCompany = await selectIdsByEq("projects", "id", "company_id", companyId);
  for (const id of byCompany.ids) regularProjectIds.add(id);

  if (companyUserIds.length > 0) {
    const ownedRegular = await selectIdsByChunks("projects", "id", "owner_user_id", companyUserIds);
    const memberRegular = await selectIdsByChunks("project_members", "project_id", "user_id", companyUserIds);
    const ownedPd = await selectIdsByChunks("pd_projects", "id", "owner_user_id", companyUserIds);
    const memberPd = await selectIdsByChunks("pd_project_members", "project_id", "user_id", companyUserIds);

    for (const id of ownedRegular.ids) regularProjectIds.add(id);
    for (const id of memberRegular.ids) regularProjectIds.add(id);
    for (const id of ownedPd.ids) pdProjectIds.add(id);
    for (const id of memberPd.ids) pdProjectIds.add(id);
  }

  return {
    projectIds: Array.from(regularProjectIds),
    pdProjectIds: Array.from(pdProjectIds),
  };
}

export async function cleanupCompanyProjectData(companyId: string): Promise<CompanyProjectCleanupResult> {
  const { projectIds, pdProjectIds } = await findCompanyProjectIds(companyId);
  const pulsehub = await cleanupPulseHubProjectData(projectIds);
  const projectNotificationsDeleted = await deleteProjectNotifications([...projectIds, ...pdProjectIds]);

  const regularDelete =
    projectIds.length > 0
      ? await deleteByChunks("projects", "id", projectIds)
      : { deleted: 0, skipped: false };
  const pdDelete =
    pdProjectIds.length > 0
      ? await deleteByChunks("pd_projects", "id", pdProjectIds)
      : { deleted: 0, skipped: false };

  return {
    ok: true,
    company_id: companyId,
    projects_deleted: regularDelete.deleted,
    pd_projects_deleted: pdDelete.deleted,
    project_notifications_deleted: projectNotificationsDeleted,
    pulsehub,
  };
}
