import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  awardGamificationXp,
  getAdminGamificationDashboard,
  getLearnerGamificationOverview,
  refreshGamificationState,
  registerStudyActivity,
} from "@/lib/lms/gamification";
import { buildCertificatePdf } from "@/lib/lms/pdf";
import { publishLmsPulseHubHighlight } from "@/lib/lms/social";
import { sendPortalEmail } from "@/lib/server/mailer";
import type {
  LmsAdminDashboardData,
  LmsAssignment,
  LmsAssignmentExpanded,
  LmsAssignmentSupportData,
  LmsCertificate,
  LmsCourse,
  LmsCourseAccessLog,
  LmsCourseDetail,
  LmsCourseModule,
  LmsCourseWithCounts,
  LmsDiscussionStatus,
  LmsLessonDiscussion,
  LmsLessonDiscussionAdminRow,
  LmsLearningPath,
  LmsLearningPathCourse,
  LmsLesson,
  LmsLessonProgress,
  LmsMyTrainingCard,
  LmsProgressStatus,
  LmsQuiz,
  LmsQuizAnswer,
  LmsQuizAttempt,
  LmsQuizPayload,
  LmsQuizQuestion,
  LmsQuizQuestionWithOptions,
  LmsQuizReviewRow,
  LmsQuizOption,
  LmsReportRow,
  LmsReportsFilters,
  LmsTeamTrainingRow,
  LmsTeamTrainingsData,
  LmsTrainingAttentionItem,
  LmsUserCourseVisibility,
  LmsUserProgress,
  LmsWeeklyDigest,
} from "@/lib/lms/types";
import { buildStorageRef, getNextLesson, parseStorageRef } from "@/lib/lms/utils";
import type { GuardResult } from "@/lib/server/feedbackGuard";

type Access = Extract<GuardResult, { ok: true }>;

type ProfileMini = {
  id: string;
  full_name: string | null;
  email?: string | null;
  role: string | null;
  company_id: string | null;
  department_id: string | null;
  manager_id?: string | null;
  active?: boolean | null;
};

type DepartmentMini = { id: string; name: string; company_id: string | null };
type CompanyMini = { id: string; name: string | null };

function normalizeEmailHandle(value: string) {
  return value.trim().toLowerCase().replace(/[._\-\s]+/g, "");
}

function buildUserDisplayName(profile: { full_name?: string | null; email?: string | null }, collaboratorName?: string | null) {
  const byCollaborator = (collaboratorName ?? "").trim();
  if (byCollaborator) return byCollaborator;

  const byProfile = (profile.full_name ?? "").trim();
  const byEmail = (profile.email ?? "").trim();
  const emailLocal = byEmail ? byEmail.split("@")[0] ?? "" : "";
  const profileLooksLikeEmailHandle =
    !!byProfile && !!emailLocal && normalizeEmailHandle(byProfile) === normalizeEmailHandle(emailLocal);

  if (byProfile && !byProfile.includes("@") && !profileLooksLikeEmailHandle) return byProfile;

  if (byEmail) {
    return emailLocal
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return byProfile || "Colaborador";
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function startOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getCurrentWeekLabel() {
  const start = startOfCurrentWeek();
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${formatter.format(start)} a ${formatter.format(end)}`;
}

function buildWeeklyDigest(rows: LmsTeamTrainingRow[], progressRows: LmsUserProgress[]): LmsWeeklyDigest {
  const weekStart = startOfCurrentWeek().toISOString();
  return {
    periodLabel: getCurrentWeekLabel(),
    completedThisWeek: progressRows.filter((row) => row.completed_at && row.completed_at >= weekStart).length,
    dueSoon: rows.filter((row) => row.urgency === "due_soon").length,
    overdue: rows.filter((row) => row.urgency === "overdue").length,
    notStarted: rows.filter((row) => row.status === "not_started").length,
  };
}

function buildAdminWeeklyDigest(
  progressRows: LmsUserProgress[],
  rows: Array<Pick<LmsTeamTrainingRow, "urgency">>,
): LmsWeeklyDigest {
  const weekStart = startOfCurrentWeek().toISOString();
  return {
    periodLabel: getCurrentWeekLabel(),
    completedThisWeek: progressRows.filter((row) => row.completed_at && row.completed_at >= weekStart).length,
    dueSoon: rows.filter((row) => row.urgency === "due_soon").length,
    overdue: rows.filter((row) => row.urgency === "overdue").length,
    notStarted: progressRows.filter((row) => row.status === "not_started").length,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendLmsReminderEmail(input: {
  email: string | null | undefined;
  fullName: string | null | undefined;
  courseTitle: string;
  dueDate?: string | null;
}) {
  const email = (input.email ?? "").trim();
  if (!email) return { sent: false, skipped: true as const };

  const dueLine = input.dueDate ? `<p><strong>Prazo:</strong> ${escapeHtml(input.dueDate)}</p>` : "";
  return sendPortalEmail({
    to: email,
    subject: `Lembrete de treinamento: ${input.courseTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">Seu treinamento precisa de atencao</h2>
        <p>Ola, ${escapeHtml((input.fullName ?? "colaborador").trim() || "colaborador")}.</p>
        <p>O treinamento <strong>${escapeHtml(input.courseTitle)}</strong> continua pendente no portal LMS.</p>
        ${dueLine}
        <p>Acesse o portal para retomar o conteudo e evitar atraso.</p>
      </div>
    `,
  });
}

async function sendWeeklySummaryEmail(input: {
  email: string | null | undefined;
  recipientName: string | null | undefined;
  title: string;
  periodLabel: string;
  completed: number;
  dueSoon: number;
  overdue: number;
  notStarted: number;
}) {
  const email = (input.email ?? "").trim();
  if (!email) return { sent: false, skipped: true as const };

  return sendPortalEmail({
    to: email,
    subject: input.title,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">${escapeHtml(input.title)}</h2>
        <p>Ola, ${escapeHtml((input.recipientName ?? "time").trim() || "time")}.</p>
        <p>Resumo do periodo <strong>${escapeHtml(input.periodLabel)}</strong>:</p>
        <ul>
          <li>Concluidos na semana: <strong>${input.completed}</strong></li>
          <li>Vencendo em breve: <strong>${input.dueSoon}</strong></li>
          <li>Em atraso: <strong>${input.overdue}</strong></li>
          <li>Nao iniciados: <strong>${input.notStarted}</strong></li>
        </ul>
        <p>Entre no portal para acompanhar os detalhes e agir sobre os treinamentos prioritarios.</p>
      </div>
    `,
  });
}

function isMissingRelation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /does not exist|Could not find the table|relation .* does not exist/i.test(message);
}

async function maybeSignedUrl(ref: string | null | undefined) {
  const parsed = parseStorageRef(ref);
  if (!parsed) return ref ?? null;
  const { data, error } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60 * 6);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function mapCourseAssets(course: LmsCourse) {
  return {
    ...course,
    thumbnail_url: await maybeSignedUrl(course.thumbnail_url),
    banner_url: await maybeSignedUrl(course.banner_url),
  };
}

async function fetchCompanyAndDepartments(companyId: string | null) {
  const [companyRes, departmentsRes] = await Promise.all([
    companyId
      ? supabaseAdmin.from("companies").select("id,name").eq("id", companyId).maybeSingle<CompanyMini>()
      : Promise.resolve({ data: null, error: null }),
    companyId
      ? supabaseAdmin.from("departments").select("id,name,company_id").eq("company_id", companyId).order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    company: companyRes.data ?? null,
    departments: ((departmentsRes.data ?? []) as DepartmentMini[]) ?? [],
  };
}

async function fetchPublishedCourses(companyId: string | null) {
  let query = supabaseAdmin.from("lms_courses").select("*").neq("status", "archived").order("updated_at", { ascending: false });
  if (companyId) query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  const { data, error } = await query;
  if (error) throw error;
  return Promise.all(((data ?? []) as LmsCourse[]).map((course) => mapCourseAssets(course)));
}

function calculateDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function resolveUrgency(dueDate: string | null, status: LmsProgressStatus): "overdue" | "due_soon" | "on_track" | "none" {
  if (!dueDate || status === "completed") return "none";
  const daysUntilDue = calculateDaysUntilDue(dueDate);
  if (daysUntilDue === null) return "none";
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 7) return "due_soon";
  return "on_track";
}

async function fetchActiveAssignmentGraph() {
  const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
    .from("lms_assignments")
    .select("*")
    .eq("status", "active");
  if (assignmentsError) throw assignmentsError;

  const assignments = (assignmentsData ?? []) as LmsAssignment[];
  const pathIds = assignments.map((item) => item.learning_path_id).filter(Boolean) as string[];
  const { data: pathCoursesData, error: pathCoursesError } = pathIds.length
    ? await supabaseAdmin.from("lms_learning_path_courses").select("*").in("learning_path_id", pathIds)
    : { data: [] as LmsLearningPathCourse[], error: null };
  if (pathCoursesError) throw pathCoursesError;

  return {
    assignments,
    pathCourses: (pathCoursesData ?? []) as LmsLearningPathCourse[],
  };
}

function assignmentMatchesProfile(profile: Pick<ProfileMini, "id" | "department_id" | "company_id" | "role">, assignment: LmsAssignment) {
  if (assignment.assignment_type === "user") return assignment.target_id === profile.id;
  if (assignment.assignment_type === "department") return !!profile.department_id && assignment.target_id === profile.department_id;
  if (assignment.assignment_type === "company") return !!profile.company_id && assignment.target_id === profile.company_id;
  if (assignment.assignment_type === "role") return assignment.target_id === profile.role;
  return false;
}

function dedupeVisibilityRows(rows: LmsUserCourseVisibility[]) {
  const visibilityMap = new Map<string, LmsUserCourseVisibility>();
  for (const row of rows) {
    const current = visibilityMap.get(row.course_id);
    if (!current) {
      visibilityMap.set(row.course_id, row);
      continue;
    }

    const currentDue = current.due_date ? new Date(current.due_date).getTime() : Number.POSITIVE_INFINITY;
    const nextDue = row.due_date ? new Date(row.due_date).getTime() : Number.POSITIVE_INFINITY;
    if (row.mandatory && !current.mandatory) {
      visibilityMap.set(row.course_id, row);
      continue;
    }
    if (nextDue < currentDue) {
      visibilityMap.set(row.course_id, row);
    }
  }

  return Array.from(visibilityMap.values());
}

function buildVisibilityForProfile(
  profile: Pick<ProfileMini, "id" | "department_id" | "company_id" | "role">,
  graph: { assignments: LmsAssignment[]; pathCourses: LmsLearningPathCourse[] },
) {
  const matched = graph.assignments.filter((assignment) => assignmentMatchesProfile(profile, assignment));
  const rows: LmsUserCourseVisibility[] = [];

  for (const assignment of matched) {
    if (assignment.course_id) {
      rows.push({
        user_id: profile.id,
        course_id: assignment.course_id,
        assignment_id: assignment.id,
        assignment_type: assignment.assignment_type,
        learning_path_id: assignment.learning_path_id,
        due_date: assignment.due_date,
        mandatory: assignment.mandatory,
        assigned_at: assignment.assigned_at,
        expires_at: assignment.expires_at,
      });
    }

    if (assignment.learning_path_id) {
      for (const pathCourse of graph.pathCourses.filter((row) => row.learning_path_id === assignment.learning_path_id)) {
        rows.push({
          user_id: profile.id,
          course_id: pathCourse.course_id,
          assignment_id: assignment.id,
          assignment_type: assignment.assignment_type,
          learning_path_id: assignment.learning_path_id,
          due_date: assignment.due_date,
          mandatory: assignment.mandatory || pathCourse.required,
          assigned_at: assignment.assigned_at,
          expires_at: assignment.expires_at,
        });
      }
    }
  }

  return dedupeVisibilityRows(rows);
}

export async function resolveVisibleCoursesForUser(access: Access) {
  const graph = await fetchActiveAssignmentGraph();
  const visibility = buildVisibilityForProfile(
    {
      id: access.userId,
      department_id: access.departmentId,
      company_id: access.companyId,
      role: access.role,
    },
    graph,
  );
  const courseIds = new Set<string>(visibility.map((item) => item.course_id));

  if (!courseIds.size) return [] as LmsUserCourseVisibility[];

  let coursesQuery = supabaseAdmin.from("lms_courses").select("*").in("id", Array.from(courseIds)).eq("status", "published");
  if (access.companyId) coursesQuery = coursesQuery.or(`company_id.eq.${access.companyId},company_id.is.null`);
  const { data: coursesData, error: coursesError } = await coursesQuery;
  if (coursesError) throw coursesError;

  const courses = await Promise.all(((coursesData ?? []) as LmsCourse[]).map((course) => mapCourseAssets(course)));
  return visibility.filter((item) => courses.some((course) => course.id === item.course_id));
}

export async function getMyTrainingsData(access: Access) {
  const [visibility, progressRes, courses] = await Promise.all([
    resolveVisibleCoursesForUser(access),
    supabaseAdmin.from("lms_user_progress").select("*").eq("user_id", access.userId),
    fetchPublishedCourses(access.companyId),
  ]);

  const progressMap = new Map<string, LmsUserProgress>(((progressRes.data ?? []) as LmsUserProgress[]).map((row) => [row.course_id, row]));
  const visibilityMap = new Map<string, LmsUserCourseVisibility>();
  for (const item of visibility) {
    if (!visibilityMap.has(item.course_id)) visibilityMap.set(item.course_id, item);
  }

  const cards: LmsMyTrainingCard[] = courses
    .filter((course) => visibilityMap.has(course.id))
    .map((course) => {
      const progress = progressMap.get(course.id) ?? null;
      const assignment = visibilityMap.get(course.id) ?? null;
      const dueDate = assignment?.due_date ? new Date(assignment.due_date) : null;
      const overdue = dueDate && dueDate < new Date() && progress?.status !== "completed";
      const status = overdue ? "overdue" : (progress?.status ?? "not_started");
      return { course, progress, assignment, status };
    });

  await ensureLmsDeadlineNotifications(access, cards);

  return cards.sort((left, right) => (left.assignment?.due_date ?? "").localeCompare(right.assignment?.due_date ?? ""));
}

async function ensureLmsDeadlineNotifications(access: Access, cards: LmsMyTrainingCard[]) {
  const alerts = cards
    .map((card) => ({
      card,
      urgency: resolveUrgency(card.assignment?.due_date ?? null, card.status),
      daysUntilDue: calculateDaysUntilDue(card.assignment?.due_date ?? null),
    }))
    .filter((item) => item.urgency === "overdue" || item.urgency === "due_soon");

  if (!alerts.length) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const existingRes = await supabaseAdmin
    .from("notifications")
    .select("id,title,type,link,created_at")
    .eq("to_user_id", access.userId)
    .in("type", ["lms_due_soon", "lms_overdue"])
    .gte("created_at", startOfDay.toISOString());

  if (existingRes.error) {
    const text = existingRes.error.message.toLowerCase();
    const ignorable =
      text.includes("does not exist") ||
      text.includes("relation") ||
      text.includes("schema cache") ||
      text.includes("column");
    if (!ignorable) throw existingRes.error;
    return 0;
  }

  const existingKeys = new Set(
    ((existingRes.data ?? []) as Array<{ title: string; type: string; link: string | null }>).map((row) => `${row.type}|${row.link ?? ""}|${row.title}`),
  );

  const payload = alerts
    .map(({ card, urgency, daysUntilDue }) => {
      const type = urgency === "overdue" ? "lms_overdue" : "lms_due_soon";
      const title = urgency === "overdue" ? `Treinamento em atraso: ${card.course.title}` : `Treinamento vencendo: ${card.course.title}`;
      const body =
        urgency === "overdue"
          ? `Seu prazo terminou em ${card.assignment?.due_date}. Retome o treinamento o quanto antes.`
          : `Seu treinamento vence em ${card.assignment?.due_date}. Restam ${daysUntilDue ?? 0} dia(s) para concluir.`;
      const link = `/lms/cursos/${card.course.id}`;
      return {
        key: `${type}|${link}|${title}`,
        record: {
          to_user_id: access.userId,
          title,
          body,
          link,
          type,
        },
      };
    })
    .filter((item) => !existingKeys.has(item.key))
    .map((item) => item.record);

  if (!payload.length) return 0;

  const insertRes = await supabaseAdmin.from("notifications").insert(payload);
  if (insertRes.error) {
    const text = insertRes.error.message.toLowerCase();
    const ignorable =
      text.includes("does not exist") ||
      text.includes("relation") ||
      text.includes("schema cache") ||
      text.includes("column");
    if (!ignorable) throw insertRes.error;
  }
  return payload.length;
}

async function fetchCourseModules(courseId: string) {
  const [modulesRes, lessonsRes] = await Promise.all([
    supabaseAdmin.from("lms_course_modules").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
    supabaseAdmin.from("lms_lessons").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
  ]);
  if (modulesRes.error) throw modulesRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const modules = (modulesRes.data ?? []) as LmsCourseModule[];
  const lessons = (lessonsRes.data ?? []) as LmsLesson[];

  return Promise.all(
    modules.map(async (module) => ({
      ...module,
      lessons: await Promise.all(
        lessons
          .filter((lesson) => lesson.module_id === module.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(async (lesson) => ({
            ...lesson,
            content_url: lesson.content_url ? await maybeSignedUrl(lesson.content_url) : null,
          })),
      ),
    })),
  );
}

async function fetchCourseQuizzes(courseId: string) {
  const { data: quizData, error: quizError } = await supabaseAdmin
    .from("lms_quizzes")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  if (quizError) return [] as LmsQuiz[];
  return (quizData ?? []) as LmsQuiz[];
}

export async function getQuizPayloadByLessonId(lessonId: string): Promise<LmsQuizPayload | null> {
  const { data: quizData, error: quizError } = await supabaseAdmin
    .from("lms_quizzes")
    .select("*")
    .eq("lesson_id", lessonId)
    .maybeSingle<LmsQuiz>();

  if (quizError || !quizData) return null;
  return getQuizPayload(quizData.id);
}

export async function getCourseDetailForLearner(access: Access, courseId: string): Promise<LmsCourseDetail | null> {
  const visible = await resolveVisibleCoursesForUser(access);
  if (!visible.some((row) => row.course_id === courseId)) return null;

  const [courseRes, modules, progressRes, certificateRes, quizzes] = await Promise.all([
    supabaseAdmin.from("lms_courses").select("*").eq("id", courseId).maybeSingle<LmsCourse>(),
    fetchCourseModules(courseId),
    supabaseAdmin.from("lms_user_progress").select("*").eq("user_id", access.userId).eq("course_id", courseId).maybeSingle<LmsUserProgress>(),
    supabaseAdmin.from("lms_certificates").select("*").eq("user_id", access.userId).eq("course_id", courseId).maybeSingle<LmsCertificate>(),
    fetchCourseQuizzes(courseId),
  ]);

  if (courseRes.error || !courseRes.data) return null;

  return {
    course: await mapCourseAssets(courseRes.data),
    modules,
    quiz: quizzes[0] ?? null,
    progress: progressRes.data ?? null,
    certificate: certificateRes.data ?? null,
  };
}

export async function getLessonPlayerData(access: Access, courseId: string, lessonId: string) {
  const detail = await getCourseDetailForLearner(access, courseId);
  if (!detail) return null;

  const { data: lessonProgressRes } = await supabaseAdmin
    .from("lms_lesson_progress")
    .select("*")
    .eq("user_id", access.userId)
    .eq("course_id", courseId);

  const completedLessonIds = new Set<string>(
    ((lessonProgressRes ?? []) as LmsLessonProgress[]).filter((item) => item.completed).map((item) => item.lesson_id),
  );
  const currentLesson = detail.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === lessonId) ?? null;
  if (!currentLesson) return null;

  return {
    ...detail,
    currentLesson,
    completedLessonIds,
    nextLesson: getNextLesson(detail.modules, lessonId),
  };
}

export async function getLessonDiscussions(access: Access, courseId: string, lessonId: string) {
  const detail = await getCourseDetailForLearner(access, courseId);
  if (!detail) throw new Error("Curso nao encontrado.");

  const { data, error } = await supabaseAdmin
    .from("lms_lesson_discussions")
    .select("*")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingRelation(error)) return [] as LmsLessonDiscussion[];
    throw error;
  }

  const rows = (data ?? []) as LmsLessonDiscussion[];
  if (!rows.length) return rows;

  const userIds = Array.from(new Set(rows.flatMap((row) => [row.user_id, row.resolved_by]).filter(Boolean) as string[]));
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id,full_name,role,email").in("id", userIds);
  const profileById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; role: string | null; email?: string | null }>).map((row) => [row.id, row]),
  );

  return rows.map((row) => ({
    ...row,
    status: row.status ?? "pending",
    author_name: buildUserDisplayName(profileById.get(row.user_id) ?? {}),
    author_role: profileById.get(row.user_id)?.role ?? null,
    responder_name: row.resolved_by ? buildUserDisplayName(profileById.get(row.resolved_by) ?? {}) : null,
  }));
}

export async function createLessonDiscussion(access: Access, courseId: string, lessonId: string, message: string) {
  const detail = await getCourseDetailForLearner(access, courseId);
  if (!detail) throw new Error("Curso nao encontrado.");
  const lessonExists = detail.modules.some((module) => module.lessons.some((lesson) => lesson.id === lessonId));
  if (!lessonExists) throw new Error("Aula nao encontrada.");

  const content = message.trim();
  if (!content) throw new Error("Escreva sua duvida antes de enviar.");

  const { data, error } = await supabaseAdmin
    .from("lms_lesson_discussions")
    .insert({
      company_id: access.companyId,
      course_id: courseId,
      lesson_id: lessonId,
      user_id: access.userId,
      message: content,
    })
    .select("*")
    .maybeSingle<LmsLessonDiscussion>();

  if (error) throw error;

  const notificationAudience = new Set<string>();
  if (detail.course.created_by) notificationAudience.add(detail.course.created_by);

  const { data: privilegedProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("active", true)
    .in("role", ["admin", "rh"])
    .or(access.companyId ? `company_id.eq.${access.companyId},company_id.is.null` : "company_id.is.null");

  for (const row of (privilegedProfiles ?? []) as Array<{ id: string }>) {
    if (row.id !== access.userId) notificationAudience.add(row.id);
  }

  if (notificationAudience.size) {
    await supabaseAdmin.from("notifications").insert(
      Array.from(notificationAudience).map((userId) => ({
        to_user_id: userId,
        type: "lms_lesson_question",
        title: "Nova duvida em aula",
        body: `${detail.course.title}: ${content.slice(0, 120)}`,
        data: {
          courseId,
          lessonId,
          questionBy: access.userId,
        },
      })),
    );
  }

  return {
    ...data!,
    status: data?.status ?? "pending",
    author_name: buildUserDisplayName({ full_name: null, email: access.email ?? null }),
    author_role: access.role,
  } satisfies LmsLessonDiscussion;
}

export async function getLmsLessonDiscussionsAdminData(companyId: string | null) {
  const { data, error } = await supabaseAdmin
    .from("lms_lesson_discussions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingRelation(error)) return [] as LmsLessonDiscussionAdminRow[];
    throw error;
  }

  const discussionRows = (data ?? []) as LmsLessonDiscussion[];
  if (!discussionRows.length) return [];

  const courseIds = Array.from(new Set(discussionRows.map((row) => row.course_id)));
  const lessonIds = Array.from(new Set(discussionRows.map((row) => row.lesson_id)));
  const userIds = Array.from(new Set(discussionRows.flatMap((row) => [row.user_id, row.resolved_by]).filter(Boolean) as string[]));

  const [coursesRes, lessonsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("lms_courses").select("id,title,company_id").in("id", courseIds),
    supabaseAdmin.from("lms_lessons").select("id,title").in("id", lessonIds),
    supabaseAdmin.from("profiles").select("id,full_name,email,role,company_id").in("id", userIds),
  ]);

  const coursesById = new Map(
    ((coursesRes.data ?? []) as Array<{ id: string; title: string; company_id: string | null }>).map((row) => [row.id, row]),
  );
  const lessonsById = new Map(((lessonsRes.data ?? []) as Array<{ id: string; title: string }>).map((row) => [row.id, row]));
  const profilesById = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; company_id: string | null }>).map((row) => [row.id, row]),
  );

  return discussionRows
    .filter((row) => {
      if (!companyId) return true;
      const course = coursesById.get(row.course_id);
      return !course?.company_id || course.company_id === companyId;
    })
    .map((row) => ({
      ...row,
      status: row.status ?? "pending",
      course_title: coursesById.get(row.course_id)?.title ?? "Treinamento",
      lesson_title: lessonsById.get(row.lesson_id)?.title ?? "Aula",
      author_name: buildUserDisplayName(profilesById.get(row.user_id) ?? {}),
      author_role: profilesById.get(row.user_id)?.role ?? null,
      responder_name: row.resolved_by ? buildUserDisplayName(profilesById.get(row.resolved_by) ?? {}) : null,
    }));
}

export async function updateLessonDiscussion(
  access: Access,
  discussionId: string,
  payload: { status?: LmsDiscussionStatus; adminResponse?: string | null },
) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from("lms_lesson_discussions")
    .select("*")
    .eq("id", discussionId)
    .maybeSingle<LmsLessonDiscussion>();

  if (currentError || !current) throw currentError ?? new Error("Interacao nao encontrada.");
  if (access.companyId && current.company_id && current.company_id !== access.companyId) {
    throw new Error("Interacao fora da sua empresa.");
  }

  const nextStatus = payload.status ?? current.status ?? "pending";
  const responseText = payload.adminResponse?.trim() ? payload.adminResponse.trim() : null;
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    resolved_by: access.userId,
  };

  if (responseText) {
    updatePayload.admin_response = responseText;
    updatePayload.responded_at = new Date().toISOString();
    if (nextStatus === "pending") updatePayload.status = "answered";
  }

  if (nextStatus === "resolved") {
    updatePayload.resolved_at = new Date().toISOString();
  } else {
    updatePayload.resolved_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from("lms_lesson_discussions")
    .update(updatePayload)
    .eq("id", discussionId)
    .select("*")
    .maybeSingle<LmsLessonDiscussion>();

  if (error || !data) throw error ?? new Error("Nao foi possivel atualizar a interacao.");

  if (responseText || nextStatus === "resolved") {
    const { data: lessonData } = await supabaseAdmin.from("lms_lessons").select("id,title").eq("id", data.lesson_id).maybeSingle<{ id: string; title: string }>();
    const notifyTitle = responseText ? "Sua duvida recebeu resposta" : "Sua duvida foi marcada como resolvida";
    const notifyBody = responseText
      ? `${lessonData?.title ?? "Aula"}: ${responseText.slice(0, 120)}`
      : `A interacao na aula ${lessonData?.title ?? ""} foi finalizada pelo time responsavel.`;
    await supabaseAdmin.from("notifications").insert({
      to_user_id: data.user_id,
      title: notifyTitle,
      body: notifyBody,
      link: `/lms/cursos/${data.course_id}`,
      type: "lms_lesson_answer",
    });
  }

  const [courseRes, lessonRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("lms_courses").select("id,title").eq("id", data.course_id).maybeSingle<{ id: string; title: string }>(),
    supabaseAdmin.from("lms_lessons").select("id,title").eq("id", data.lesson_id).maybeSingle<{ id: string; title: string }>(),
    supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,role")
      .in("id", Array.from(new Set([data.user_id, data.resolved_by].filter(Boolean) as string[]))),
  ]);

  const profilesById = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>).map((row) => [row.id, row]),
  );

  return {
    ...data,
    course_title: courseRes.data?.title ?? "Treinamento",
    lesson_title: lessonRes.data?.title ?? "Aula",
    author_name: buildUserDisplayName(profilesById.get(data.user_id) ?? {}),
    author_role: profilesById.get(data.user_id)?.role ?? null,
    responder_name: data.resolved_by ? buildUserDisplayName(profilesById.get(data.resolved_by) ?? {}) : null,
  } satisfies LmsLessonDiscussionAdminRow;
}

async function getLearnerStats(access: Access) {
  const cards = await getMyTrainingsData(access);
  return {
    total: cards.length,
    completed: cards.filter((item) => item.status === "completed").length,
    inProgress: cards.filter((item) => item.status === "in_progress").length,
    overdue: cards.filter((item) => item.status === "overdue").length,
  };
}

export async function getLmsLandingData(access: Access) {
  const [myTrainings, dashboard, gamification] = await Promise.all([
    getMyTrainingsData(access),
    getLearnerStats(access),
    getLearnerGamificationOverview(access),
  ]);
  const recommended = myTrainings.filter((row) => row.course.onboarding_recommended || row.course.required).slice(0, 3);
  const deadlines = myTrainings
    .filter((row) => row.assignment?.due_date)
    .sort((left, right) => String(left.assignment?.due_date ?? "").localeCompare(String(right.assignment?.due_date ?? "")))
    .slice(0, 4);
  const keepLearning = myTrainings.filter((row) => row.status === "in_progress").slice(0, 4);
  return { myTrainings, recommended, dashboard, gamification, deadlines, keepLearning };
}

export async function getTeamTrainingsData(access: Access): Promise<LmsTeamTrainingsData> {
  const { data: teamProfilesData, error: teamError } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,role,company_id,department_id,manager_id")
    .eq("manager_id", access.userId)
    .eq("active", true);

  if (teamError) throw teamError;
  const teamProfiles = (teamProfilesData ?? []) as ProfileMini[];
  if (!teamProfiles.length) {
    return {
      rows: [],
      summary: {
        totalMembers: 0,
        totalAssignments: 0,
        overdue: 0,
        dueSoon: 0,
        completed: 0,
        averageCompletion: 0,
      },
      urgentRows: [],
      weeklyDigest: {
        periodLabel: getCurrentWeekLabel(),
        completedThisWeek: 0,
        dueSoon: 0,
        overdue: 0,
        notStarted: 0,
      },
    };
  }

  const userIds = teamProfiles.map((profile) => profile.id);
  const [progressRes, courseRes, departmentsRes, graph] = await Promise.all([
    supabaseAdmin.from("lms_user_progress").select("*").in("user_id", userIds),
    access.companyId
      ? supabaseAdmin.from("lms_courses").select("id,title,status,company_id").or(`company_id.eq.${access.companyId},company_id.is.null`)
      : supabaseAdmin.from("lms_courses").select("id,title,status,company_id"),
    supabaseAdmin.from("departments").select("id,name").in("id", teamProfiles.map((row) => row.department_id).filter(Boolean) as string[]),
    fetchActiveAssignmentGraph(),
  ]);

  const progressRows = (progressRes.data ?? []) as LmsUserProgress[];
  const progressMap = new Map(progressRows.map((row) => [`${row.user_id}:${row.course_id}`, row]));
  const coursesById = new Map<string, { id: string; title: string; status?: string | null }>(
    ((courseRes.data ?? []) as Array<{ id: string; title: string; status?: string | null }>).map((row) => [row.id, row]),
  );
  const departmentsById = new Map<string, string>(((departmentsRes.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
  const rows: LmsTeamTrainingRow[] = [];

  for (const profile of teamProfiles) {
    const visibility = buildVisibilityForProfile(profile, graph).filter((item) => coursesById.has(item.course_id));
    for (const assignment of visibility) {
      const progress = progressMap.get(`${profile.id}:${assignment.course_id}`) ?? null;
      const baseStatus = progress?.status ?? "not_started";
      const urgency = resolveUrgency(assignment.due_date, baseStatus);
      rows.push({
        user_id: profile.id,
        full_name: profile.full_name ?? "Colaborador",
        department_name: profile.department_id ? departmentsById.get(profile.department_id) ?? null : null,
        course_id: assignment.course_id,
        course_title: coursesById.get(assignment.course_id)?.title ?? "Curso",
        status: urgency === "overdue" ? "overdue" : baseStatus,
        progress_percent: progress?.progress_percent ?? 0,
        due_date: assignment.due_date,
        mandatory: assignment.mandatory,
        assignment_type: assignment.assignment_type,
        days_until_due: calculateDaysUntilDue(assignment.due_date),
        urgency,
      });
    }
  }

  rows.sort((left, right) => {
    const urgencyWeight = { overdue: 0, due_soon: 1, on_track: 2, none: 3 };
    const byUrgency = urgencyWeight[left.urgency] - urgencyWeight[right.urgency];
    if (byUrgency !== 0) return byUrgency;
    return `${left.full_name}${left.course_title}`.localeCompare(`${right.full_name}${right.course_title}`);
  });

  const completed = rows.filter((row) => row.status === "completed").length;
  const overdue = rows.filter((row) => row.urgency === "overdue").length;
  const dueSoon = rows.filter((row) => row.urgency === "due_soon").length;
  const averageCompletion = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.progress_percent, 0) / rows.length)
    : 0;

  return {
    rows,
    summary: {
      totalMembers: teamProfiles.length,
      totalAssignments: rows.length,
      overdue,
      dueSoon,
      completed,
      averageCompletion,
    },
    urgentRows: rows.filter((row) => row.urgency === "overdue" || row.urgency === "due_soon").slice(0, 8),
    weeklyDigest: buildWeeklyDigest(rows, progressRows),
  };
}

function mapExpandedAssignment(
  assignment: LmsAssignment,
  support: LmsAssignmentSupportData,
  profileNames: Map<string, string>,
  courseById: Map<string, LmsCourse | { title: string }>,
  pathById: Map<string, LmsLearningPath>,
): LmsAssignmentExpanded {
  const targetLookup =
    support.users.find((item) => item.id === assignment.target_id) ??
    support.departments.find((item) => item.id === assignment.target_id) ??
    support.companies.find((item) => item.id === assignment.target_id) ??
    support.roles.find((item) => item.id === assignment.target_id) ??
    null;

  return {
    ...assignment,
    course_title: assignment.course_id ? courseById.get(assignment.course_id)?.title ?? null : null,
    learning_path_title: assignment.learning_path_id ? pathById.get(assignment.learning_path_id)?.title ?? null : null,
    assigned_by_name: assignment.assigned_by ? profileNames.get(assignment.assigned_by) ?? null : null,
    target_label: targetLookup?.label ?? assignment.target_id,
  };
}

export async function buildAssignmentSupportData(companyId: string | null): Promise<LmsAssignmentSupportData> {
  const [profilesRes, collaboratorsRes, departments, companies, courses, paths] = await Promise.all([
    companyId
      ? supabaseAdmin.from("profiles").select("id,full_name,email,company_id").eq("company_id", companyId).eq("active", true).order("full_name", { ascending: true })
      : supabaseAdmin.from("profiles").select("id,full_name,email,company_id").eq("active", true).order("full_name", { ascending: true }),
    supabaseAdmin.from("colaboradores").select("user_id,nome,email"),
    companyId
      ? supabaseAdmin.from("departments").select("id,name").eq("company_id", companyId).order("name", { ascending: true })
      : supabaseAdmin.from("departments").select("id,name").order("name", { ascending: true }),
    companyId
      ? supabaseAdmin.from("companies").select("id,name").eq("id", companyId)
      : supabaseAdmin.from("companies").select("id,name"),
    fetchPublishedCourses(companyId),
    getLmsLearningPathsAdminData(companyId),
  ]);

  const collaboratorNamesByUserId = new Map<string, string>();
  const collaboratorNamesByEmail = new Map<string, string>();
  for (const row of (collaboratorsRes.data ?? []) as Array<{ user_id: string | null; nome: string | null; email?: string | null }>) {
    if (row.user_id && row.nome) collaboratorNamesByUserId.set(row.user_id, row.nome);
    if (row.email && row.nome) collaboratorNamesByEmail.set(row.email.trim().toLowerCase(), row.nome);
  }

  return {
    users: ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((row) => ({
      id: row.id,
      label: buildUserDisplayName(
        row,
        collaboratorNamesByUserId.get(row.id) ?? (row.email ? collaboratorNamesByEmail.get(row.email.trim().toLowerCase()) : undefined),
      ),
    })),
    departments: ((departments.data ?? []) as Array<{ id: string; name: string }>).map((row) => ({ id: row.id, label: row.name })),
    companies: ((companies.data ?? []) as Array<{ id: string; name: string | null }>).map((row) => ({ id: row.id, label: row.name ?? row.id })),
    roles: [
      { id: "colaborador", label: "Colaborador" },
      { id: "coordenador", label: "Coordenador" },
      { id: "gestor", label: "Gestor" },
      { id: "rh", label: "RH" },
      { id: "admin", label: "Admin" },
    ],
    courses: courses.map((course) => ({ id: course.id, label: course.title })),
    learningPaths: paths.map((path) => ({ id: path.id, label: path.title })),
  };
}

export async function getLmsAdminDashboardData(companyId: string | null): Promise<LmsAdminDashboardData> {
  const [coursesRes, progressRes, accessLogsRes, assignmentsRes, departments, profilesRes, gamification, graph] = await Promise.all([
    fetchPublishedCourses(companyId),
    supabaseAdmin.from("lms_user_progress").select("*"),
    supabaseAdmin.from("lms_course_access_logs").select("*"),
    supabaseAdmin.from("lms_assignments").select("*").order("assigned_at", { ascending: false }).limit(8),
    fetchCompanyAndDepartments(companyId),
    supabaseAdmin.from("profiles").select("id,full_name,company_id,department_id").eq("active", true),
    getAdminGamificationDashboard(companyId),
    fetchActiveAssignmentGraph(),
  ]);

  const courses = coursesRes;
  const profiles = ((profilesRes.data ?? []) as ProfileMini[]).filter((profile) => !companyId || profile.company_id === companyId);
  const progressRows = ((progressRes.data ?? []) as LmsUserProgress[]).filter((row) => {
    if (!companyId) return true;
    const profile = profiles.find((item) => item.id === row.user_id);
    return profile?.company_id === companyId;
  });

  const accessLogs = (accessLogsRes.data ?? []) as LmsCourseAccessLog[];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const progressMap = new Map(progressRows.map((row) => [`${row.user_id}:${row.course_id}`, row]));
  const assignmentRows = (assignmentsRes.data ?? []) as LmsAssignment[];
  const assignmentSupport = await buildAssignmentSupportData(companyId);
  const recentAssignments = assignmentRows.map((assignment) => mapExpandedAssignment(assignment, assignmentSupport, new Map(), courseById, new Map())).slice(0, 8);

  const totalCourses = courses.length;
  const publishedCourses = courses.filter((course) => course.status === "published").length;
  const assignedUsers = new Set(progressRows.map((row) => row.user_id)).size;
  const averageCompletion = progressRows.length
    ? progressRows.reduce((sum, row) => sum + row.progress_percent, 0) / progressRows.length
    : 0;

  const mostAccessedCourses = Array.from(
    accessLogs.reduce((map, log) => {
      const current = map.get(log.course_id) ?? 0;
      map.set(log.course_id, current + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([courseId, accessCount]) => ({
      courseId,
      title: courseById.get(courseId)?.title ?? "Curso",
      accessCount,
    }))
    .sort((left, right) => right.accessCount - left.accessCount)
    .slice(0, 5);

  const highestDropOffCourses = courses
    .map((course) => {
      const rows = progressRows.filter((progress) => progress.course_id === course.id);
      return {
        courseId: course.id,
        title: course.title,
        incompleteUsers: rows.filter((row) => row.status !== "completed").length,
      };
    })
    .sort((left, right) => right.incompleteUsers - left.incompleteUsers)
    .slice(0, 5);

  const now = new Date();
  const overdueTrainings = assignmentRows.filter((item) => item.due_date && new Date(item.due_date) < now).length;
  const delayedUsers = new Set(progressRows.filter((row) => row.status === "overdue").map((row) => row.user_id)).size;
  const attentionItems: LmsTrainingAttentionItem[] = [];

  for (const profile of profiles) {
    const visibility = buildVisibilityForProfile(profile, graph).filter((item) => courseById.has(item.course_id));
    for (const assignment of visibility) {
      const progress = progressMap.get(`${profile.id}:${assignment.course_id}`) ?? null;
      const baseStatus = progress?.status ?? "not_started";
      const urgency = resolveUrgency(assignment.due_date, baseStatus);
      if (urgency !== "overdue" && urgency !== "due_soon") continue;
      attentionItems.push({
        user_id: profile.id,
        full_name: profile.full_name ?? "Colaborador",
        department_name: profile.department_id ? departments.departments.find((item) => item.id === profile.department_id)?.name ?? null : null,
        course_id: assignment.course_id,
        course_title: courseById.get(assignment.course_id)?.title ?? "Curso",
        due_date: assignment.due_date,
        days_until_due: calculateDaysUntilDue(assignment.due_date),
        status: urgency === "overdue" ? "overdue" : baseStatus,
        progress_percent: progress?.progress_percent ?? 0,
        urgency,
      });
    }
  }

  attentionItems.sort((left, right) => {
    const urgencyWeight = { overdue: 0, due_soon: 1 };
    const byUrgency = urgencyWeight[left.urgency] - urgencyWeight[right.urgency];
    if (byUrgency !== 0) return byUrgency;
    return (left.days_until_due ?? Number.MAX_SAFE_INTEGER) - (right.days_until_due ?? Number.MAX_SAFE_INTEGER);
  });

  const departmentMap = new Map<string, { name: string; total: number; complete: number }>();
  for (const profile of profiles) {
    const key = profile.department_id ?? "sem-departamento";
    if (!departmentMap.has(key)) {
      departmentMap.set(key, {
        name: profile.department_id ? departments.departments.find((item) => item.id === profile.department_id)?.name ?? "Sem departamento" : "Sem departamento",
        total: 0,
        complete: 0,
      });
    }
    const bucket = departmentMap.get(key)!;
    const userRows = progressRows.filter((row) => row.user_id === profile.id);
    if (!userRows.length) continue;
    bucket.total += userRows.length;
    bucket.complete += userRows.filter((row) => row.status === "completed").length;
  }

  const departmentRanking = Array.from(departmentMap.values())
    .map((row) => ({
      departmentName: row.name,
      completionRate: row.total ? Math.round((row.complete / row.total) * 100) : 0,
    }))
    .sort((left, right) => right.completionRate - left.completionRate)
    .slice(0, 8);

  const completionByStatus = (["not_started", "in_progress", "completed", "overdue"] as const).map((status) => ({
    status,
    total: progressRows.filter((row) => row.status === status).length,
  }));

  const recentCourses: LmsCourseWithCounts[] = courses.slice(0, 5).map((course) => ({
    ...course,
    module_count: 0,
    lesson_count: 0,
    assignment_count: assignmentRows.filter((assignment) => assignment.course_id === course.id).length,
    active_learners: progressRows.filter((progress) => progress.course_id === course.id).length,
  }));

  return {
    totalCourses,
    publishedCourses,
    assignedUsers,
    averageCompletion,
    mostAccessedCourses,
    highestDropOffCourses,
    overdueTrainings,
    delayedUsers,
    departmentRanking,
    dueSoon: assignmentRows.filter((item) => item.due_date && new Date(item.due_date).getTime() - now.getTime() <= 1000 * 60 * 60 * 24 * 7).length,
    completionByStatus,
    recentAssignments,
    recentCourses,
    attentionItems: attentionItems.slice(0, 8),
    gamification,
    weeklyDigest: buildAdminWeeklyDigest(progressRows, attentionItems),
  };
}

export async function getSafeLmsAdminDashboardData(companyId: string | null) {
  try {
    return await getLmsAdminDashboardData(companyId);
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return {
      totalCourses: 0,
      publishedCourses: 0,
      assignedUsers: 0,
      averageCompletion: 0,
      mostAccessedCourses: [],
      highestDropOffCourses: [],
      overdueTrainings: 0,
      delayedUsers: 0,
      departmentRanking: [],
      dueSoon: 0,
      completionByStatus: [],
      recentAssignments: [],
      recentCourses: [],
      attentionItems: [],
      gamification: {
        totalXpDistributed: 0,
        activeLearners: 0,
        activeChallenges: 0,
        averageStreak: 0,
        topDepartments: [],
        topBadges: [],
        seasonLabel: "",
        leaderboard: [],
        seasonCampaign: {
          seasonLabel: "",
          missionTitle: "Campanha mensal de aprendizagem",
          missionDescription: "Acompanhe metas, desafios e ritmo de estudo da empresa em um unico painel.",
          totalChallenges: 0,
          completedChallenges: 0,
          activeBattleCount: 0,
          totalXp: 0,
          streakDays: 0,
          goals: [],
        },
      },
      weeklyDigest: {
        periodLabel: getCurrentWeekLabel(),
        completedThisWeek: 0,
        dueSoon: 0,
        overdue: 0,
        notStarted: 0,
      },
      } satisfies LmsAdminDashboardData;
    }
  }

export async function getLmsCoursesAdminData(companyId: string | null) {
  const [{ data: coursesData, error: coursesError }, modulesRes, lessonsRes, assignmentsRes, progressRes] = await Promise.all([
    companyId
      ? supabaseAdmin.from("lms_courses").select("*").or(`company_id.eq.${companyId},company_id.is.null`).order("updated_at", { ascending: false })
      : supabaseAdmin.from("lms_courses").select("*").order("updated_at", { ascending: false }),
    supabaseAdmin.from("lms_course_modules").select("*"),
    supabaseAdmin.from("lms_lessons").select("*"),
    supabaseAdmin.from("lms_assignments").select("course_id"),
    supabaseAdmin.from("lms_user_progress").select("course_id"),
  ]);

  if (coursesError) throw coursesError;
  const modules = (modulesRes.data ?? []) as LmsCourseModule[];
  const lessons = (lessonsRes.data ?? []) as Array<LmsLesson & { course_id: string }>;
  const assignments = (assignmentsRes.data ?? []) as Array<{ course_id: string | null }>;
  const progress = (progressRes.data ?? []) as Array<{ course_id: string }>;

  const rows = await Promise.all(
    ((coursesData ?? []) as LmsCourse[]).map(async (course) => ({
      ...(await mapCourseAssets(course)),
      module_count: modules.filter((module) => module.course_id === course.id).length,
      lesson_count: lessons.filter((lesson) => lesson.course_id === course.id).length,
      assignment_count: assignments.filter((item) => item.course_id === course.id).length,
      active_learners: progress.filter((item) => item.course_id === course.id).length,
    })),
  );

  return rows as LmsCourseWithCounts[];
}

async function getQuizPayloadForCourse(courseId: string): Promise<LmsQuizPayload | null> {
  const { data: quizRows, error: quizError } = await supabaseAdmin
    .from("lms_quizzes")
    .select("*")
    .eq("course_id", courseId)
    .is("lesson_id", null)
    .order("created_at", { ascending: true });
  if (quizError) return null;
  const quizData = ((quizRows ?? []) as LmsQuiz[])[0] ?? null;
  if (!quizData) return null;

  const { data: questionsData } = await supabaseAdmin.from("lms_quiz_questions").select("*").eq("quiz_id", quizData.id).order("sort_order", { ascending: true });
  const questionIds = ((questionsData ?? []) as LmsQuizQuestion[]).map((row) => row.id);
  const { data: optionsData } = questionIds.length
    ? await supabaseAdmin.from("lms_quiz_options").select("*").in("question_id", questionIds)
    : { data: [] as LmsQuizOption[] };

  return {
    quiz: quizData,
    questions: ((questionsData ?? []) as LmsQuizQuestion[]).map((question) => ({
      ...question,
      options: ((optionsData ?? []) as LmsQuizOption[]).filter((option) => option.question_id === question.id),
    })),
  };
}

async function attachLessonQuizPayloads(modules: Awaited<ReturnType<typeof fetchCourseModules>>) {
  return Promise.all(
    modules.map(async (module) => ({
      ...module,
      lessons: await Promise.all(
        module.lessons.map(async (lesson) => ({
          ...lesson,
          quiz: lesson.lesson_type === "avaliacao" ? await getQuizPayloadByLessonId(lesson.id) : null,
        })),
      ),
    })),
  );
}

async function getCourseEditorDetail(courseId: string, companyId: string | null) {
  const { data: courseData, error: courseError } = await supabaseAdmin.from("lms_courses").select("*").eq("id", courseId).maybeSingle<LmsCourse>();
  if (courseError || !courseData) return null;
  if (companyId && courseData.company_id && courseData.company_id !== companyId) return null;

  const [modules, quizPayload] = await Promise.all([fetchCourseModules(courseId), getQuizPayloadForCourse(courseId)]);
  return {
    course: await mapCourseAssets(courseData),
    modules: await attachLessonQuizPayloads(modules),
    quiz: quizPayload,
  };
}

export async function getLmsCourseEditorData(courseId: string, companyId: string | null) {
  const detail = await getCourseEditorDetail(courseId, companyId);
  const supportData = await buildAssignmentSupportData(companyId);
  return { detail, supportData };
}

export async function getLmsLearningPathsAdminData(companyId: string | null) {
  const [{ data: pathData, error: pathError }, pathCourseRes, coursesRes] = await Promise.all([
    companyId
      ? supabaseAdmin.from("lms_learning_paths").select("*").or(`company_id.eq.${companyId},company_id.is.null`).order("updated_at", { ascending: false })
      : supabaseAdmin.from("lms_learning_paths").select("*").order("updated_at", { ascending: false }),
    supabaseAdmin.from("lms_learning_path_courses").select("*").order("sort_order", { ascending: true }),
    fetchPublishedCourses(companyId),
  ]);
  if (pathError) throw pathError;

  const courseById = new Map(coursesRes.map((course) => [course.id, course.title]));
  return ((pathData ?? []) as LmsLearningPath[]).map((path) => ({
    ...path,
    courses: ((pathCourseRes.data ?? []) as LmsLearningPathCourse[])
      .filter((row) => row.learning_path_id === path.id)
      .map((row) => ({ ...row, course_title: courseById.get(row.course_id) ?? "Curso" })),
  }));
}

export async function getLmsAssignmentsAdminData(companyId: string | null) {
  const [{ data: assignmentsData, error: assignmentsError }, supportData, courses, paths, profilesRes] = await Promise.all([
    supabaseAdmin.from("lms_assignments").select("*").order("assigned_at", { ascending: false }),
    buildAssignmentSupportData(companyId),
    fetchPublishedCourses(companyId),
    getLmsLearningPathsAdminData(companyId),
    supabaseAdmin.from("profiles").select("id,full_name"),
  ]);
  if (assignmentsError) throw assignmentsError;

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const pathById = new Map(paths.map((path) => [path.id, path as LmsLearningPath]));
  const profileNames = new Map(((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [row.id, row.full_name ?? row.id]));

  return {
    assignments: ((assignmentsData ?? []) as LmsAssignment[]).map((assignment) =>
      mapExpandedAssignment(assignment, supportData, profileNames, courseById, pathById),
    ),
    supportData,
  };
}

export async function getLmsReportsData(companyId: string | null, filters?: Partial<LmsReportsFilters>) {
  const [progressRes, profilesRes, coursesRes, departments, companies, attemptsRes] = await Promise.all([
    supabaseAdmin.from("lms_user_progress").select("*"),
    supabaseAdmin.from("profiles").select("id,full_name,company_id,department_id,role,active"),
    companyId
      ? supabaseAdmin.from("lms_courses").select("id,title,category,company_id").or(`company_id.eq.${companyId},company_id.is.null`)
      : supabaseAdmin.from("lms_courses").select("id,title,category,company_id"),
    supabaseAdmin.from("departments").select("id,name"),
    supabaseAdmin.from("companies").select("id,name"),
    supabaseAdmin.from("lms_quiz_attempts").select("user_id,course_id,score,submitted_at"),
  ]);

  const profiles = ((profilesRes.data ?? []) as ProfileMini[]).filter((row) => row.active !== false && (!companyId || row.company_id === companyId));
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const departmentById = new Map(((departments.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
  const companyById = new Map(((companies.data ?? []) as Array<{ id: string; name: string | null }>).map((row) => [row.id, row.name ?? row.id]));
  const courseById = new Map((((coursesRes.data ?? []) as Array<{ id: string; title: string; category: string | null }>) ?? []).map((row) => [row.id, row]));
  const latestAttempts = new Map<string, { score: number | null; submitted_at: string | null }>();

  for (const attempt of (attemptsRes.data ?? []) as Array<{ user_id: string; course_id: string | null; score: number | null; submitted_at: string }>) {
    if (!attempt.course_id) continue;
    const key = `${attempt.user_id}:${attempt.course_id}`;
    const current = latestAttempts.get(key);
    if (!current || new Date(attempt.submitted_at) > new Date(current.submitted_at ?? 0)) {
      latestAttempts.set(key, { score: attempt.score, submitted_at: attempt.submitted_at });
    }
  }

  return ((progressRes.data ?? []) as LmsUserProgress[])
    .filter((row) => profileById.has(row.user_id) && courseById.has(row.course_id))
    .map((row) => {
      const profile = profileById.get(row.user_id)!;
      const course = courseById.get(row.course_id)!;
      const attempt = latestAttempts.get(`${row.user_id}:${row.course_id}`);
      return {
        user_name: profile.full_name ?? "Colaborador",
        department_name: profile.department_id ? departmentById.get(profile.department_id) ?? null : null,
        company_name: profile.company_id ? companyById.get(profile.company_id) ?? null : null,
        course_title: course.title,
        category: course.category ?? null,
        status: row.status,
        progress_percent: row.progress_percent,
        due_date: null,
        completed_at: row.completed_at,
        score: attempt?.score ?? null,
      } satisfies LmsReportRow;
    })
    .filter((row) => {
      if (filters?.status && filters.status !== "all" && row.status !== filters.status) return false;
      if (filters?.departmentId && filters.departmentId !== "all") {
        const depName = departmentById.get(filters.departmentId) ?? filters.departmentId;
        if (row.department_name !== depName) return false;
      }
      return true;
    });
}

async function getLatestQuizAttempt(userId: string, courseId: string) {
  const { data: attemptsData } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  return ((attemptsData ?? []) as LmsQuizAttempt[])[0] ?? null;
}

async function getLatestQuizAttemptByQuiz(userId: string, quizId: string) {
  const { data: attemptsData } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("quiz_id", quizId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  return ((attemptsData ?? []) as LmsQuizAttempt[])[0] ?? null;
}

export async function markLessonCompleted(access: Access, courseId: string, lessonId: string, completed = true) {
  const detail = await getCourseDetailForLearner(access, courseId);
  if (!detail) throw new Error("Curso nao disponivel para este usuario.");

  const lesson = detail.modules.flatMap((module) => module.lessons).find((item) => item.id === lessonId);
  if (!lesson) throw new Error("Aula nao encontrada.");

  const { data: currentLessonProgress } = await supabaseAdmin
    .from("lms_lesson_progress")
    .select("completed")
    .eq("user_id", access.userId)
    .eq("lesson_id", lessonId)
    .maybeSingle<{ completed: boolean }>();
  const wasCompleted = Boolean(currentLessonProgress?.completed);

  const payload = {
    user_id: access.userId,
    lesson_id: lessonId,
    course_id: courseId,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    last_accessed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("lms_lesson_progress").upsert(payload, { onConflict: "user_id,lesson_id" });
  if (error) throw error;

  await supabaseAdmin.from("lms_course_access_logs").insert({
    user_id: access.userId,
    course_id: courseId,
    lesson_id: lessonId,
    action: completed ? "lesson_completed" : "lesson_opened",
  });

  if (completed) {
    await registerStudyActivity(access);
    if (!wasCompleted) {
      await awardGamificationXp(access, "lesson_completed");
      await refreshGamificationState(access);
    }
  }

  return recomputeUserCourseProgress(access, courseId);
}

export async function recomputeUserCourseProgress(access: Access, courseId: string) {
  const detail = await getCourseDetailForLearner(access, courseId);
  if (!detail) throw new Error("Curso nao encontrado.");

  const requiredLessonIds = detail.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.is_required).map((lesson) => lesson.id);
  const { data: progressData, error: progressError } = await supabaseAdmin
    .from("lms_lesson_progress")
    .select("*")
    .eq("user_id", access.userId)
    .eq("course_id", courseId);
  if (progressError) throw progressError;

  const lessonProgress = (progressData ?? []) as LmsLessonProgress[];
  const completedRequired = requiredLessonIds.filter((lessonId) => lessonProgress.some((item) => item.lesson_id === lessonId && item.completed)).length;
  const progressPercent = requiredLessonIds.length ? Math.round((completedRequired / requiredLessonIds.length) * 100) : 100;

  const quizzes = await fetchCourseQuizzes(courseId);
  const quizAttempts = await Promise.all(quizzes.map((quiz) => getLatestQuizAttemptByQuiz(access.userId, quiz.id)));
  const passedQuiz = quizzes.length ? quizzes.every((quiz, index) => Boolean(quizAttempts[index]?.passed)) : true;
  const isCompleted = progressPercent >= 100 && passedQuiz;
  const wasCompleted = detail.progress?.status === "completed";
  const status: LmsProgressStatus = isCompleted ? "completed" : progressPercent > 0 ? "in_progress" : "not_started";

  const upsertPayload = {
    user_id: access.userId,
    course_id: courseId,
    status,
    progress_percent: progressPercent,
    completed_lessons: completedRequired,
    required_lessons: requiredLessonIds.length,
    passed_quiz: passedQuiz,
    started_at: progressPercent > 0 ? detail.progress?.started_at ?? new Date().toISOString() : null,
    completed_at: isCompleted ? detail.progress?.completed_at ?? new Date().toISOString() : null,
    last_lesson_id: lessonProgress.sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())[0]?.lesson_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: progressUpserted, error: upsertError } = await supabaseAdmin
    .from("lms_user_progress")
    .upsert(upsertPayload, { onConflict: "user_id,course_id" })
    .select("*")
    .maybeSingle<LmsUserProgress>();
  if (upsertError) throw upsertError;

  await supabaseAdmin.from("lms_course_access_logs").insert({
    user_id: access.userId,
    course_id: courseId,
    lesson_id: upsertPayload.last_lesson_id,
    action: isCompleted ? "course_completed" : "course_progress_updated",
  });

  if (isCompleted && detail.course.certificate_enabled) {
    await ensureCertificateForUser(access, detail.course);
  }

  if (isCompleted && !wasCompleted) {
    await awardGamificationXp(access, "course_completed");
    await refreshGamificationState(access);
    await publishLmsPulseHubHighlight({
      userId: access.userId,
      companyId: access.companyId,
      title: "Curso concluido no LMS",
      body: `Concluiu o treinamento "${detail.course.title}" e avancou mais uma etapa na jornada de aprendizagem.`,
    });
  }

  return progressUpserted;
}

export async function getQuizPayload(quizId: string): Promise<LmsQuizPayload | null> {
  const { data: quizData, error: quizError } = await supabaseAdmin.from("lms_quizzes").select("*").eq("id", quizId).maybeSingle<LmsQuiz>();
  if (quizError || !quizData) return null;

  const { data: questionsData } = await supabaseAdmin.from("lms_quiz_questions").select("*").eq("quiz_id", quizId).order("sort_order", { ascending: true });
  const questionIds = ((questionsData ?? []) as LmsQuizQuestion[]).map((row) => row.id);
  const { data: optionsData } = questionIds.length
    ? await supabaseAdmin.from("lms_quiz_options").select("*").in("question_id", questionIds)
    : { data: [] as LmsQuizOption[] };

  const payloadQuestions: LmsQuizQuestionWithOptions[] = ((questionsData ?? []) as LmsQuizQuestion[]).map((question) => ({
    ...question,
    options: ((optionsData ?? []) as LmsQuizOption[]).filter((option) => option.question_id === question.id),
  }));

  return { quiz: quizData, questions: payloadQuestions };
}

function toEditorQuizPayload(payload: LmsQuizPayload) {
  return {
    title: payload.quiz.title,
    instructions: payload.quiz.instructions ?? "",
    passing_score: payload.quiz.passing_score,
    max_attempts: payload.quiz.max_attempts,
    randomize_questions: payload.quiz.randomize_questions,
    show_score_on_submit: payload.quiz.show_score_on_submit ?? true,
    show_correct_answers: payload.quiz.show_correct_answers ?? false,
    questions: payload.questions.map((question, index) => ({
      statement: question.statement,
      help_text: question.help_text ?? "",
      question_type: question.question_type,
      sort_order: question.sort_order || index + 1,
      image_url: question.image_url ?? "",
      accepted_answers: question.accepted_answers?.length ? question.accepted_answers : [""],
      requires_manual_review: question.requires_manual_review ?? question.question_type === "essay",
      options: question.options.map((option) => ({
        text: option.text,
        is_correct: option.is_correct,
        image_url: option.image_url ?? "",
      })),
    })),
  };
}

export async function getLmsQuizReviewsAdminData(companyId: string | null) {
  const { data: attemptsData, error: attemptsError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .select("*")
    .in("review_status", ["pending_review", "reviewed"])
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (attemptsError) {
    if (isMissingRelation(attemptsError)) return [] as LmsQuizReviewRow[];
    throw attemptsError;
  }

  const attempts = (attemptsData ?? []) as LmsQuizAttempt[];
  if (!attempts.length) return [];

  const quizIds = Array.from(new Set(attempts.map((item) => item.quiz_id)));
  const userIds = Array.from(new Set(attempts.flatMap((item) => [item.user_id, item.reviewed_by]).filter(Boolean) as string[]));

  const [quizzesRes, profilesRes] = await Promise.all([
    supabaseAdmin.from("lms_quizzes").select("*").in("id", quizIds),
    supabaseAdmin.from("profiles").select("id,full_name,email,role,company_id").in("id", userIds),
  ]);

  const quizzes = (quizzesRes.data ?? []) as LmsQuiz[];
  const profiles = (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null; company_id: string | null }>;
  const quizById = new Map(quizzes.map((row) => [row.id, row]));
  const profileById = new Map(profiles.map((row) => [row.id, row]));

  const relevantAttempts = attempts.filter((attempt) => {
    const author = profileById.get(attempt.user_id);
    if (!companyId) return true;
    return !author?.company_id || author.company_id === companyId;
  });
  if (!relevantAttempts.length) return [];

  const courseIds = Array.from(new Set(relevantAttempts.map((item) => item.course_id).filter(Boolean) as string[]));
  const lessonIds = Array.from(new Set(quizzes.map((item) => item.lesson_id).filter(Boolean) as string[]));
  const questionQuizIds = Array.from(new Set(relevantAttempts.map((item) => item.quiz_id)));

  const [coursesRes, lessonsRes, questionsRes, answersRes] = await Promise.all([
    supabaseAdmin.from("lms_courses").select("id,title,company_id").in("id", courseIds),
    lessonIds.length ? supabaseAdmin.from("lms_lessons").select("id,title").in("id", lessonIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("lms_quiz_questions").select("*").in("quiz_id", questionQuizIds).order("sort_order", { ascending: true }),
    supabaseAdmin.from("lms_quiz_answers").select("*").in("attempt_id", relevantAttempts.map((item) => item.id)),
  ]);

  const questions = (questionsRes.data ?? []) as LmsQuizQuestion[];
  const questionIds = questions.map((row) => row.id);
  const { data: optionsData } = questionIds.length
    ? await supabaseAdmin.from("lms_quiz_options").select("*").in("question_id", questionIds)
    : { data: [] as LmsQuizOption[] };

  const courseById = new Map(((coursesRes.data ?? []) as Array<{ id: string; title: string; company_id: string | null }>).map((row) => [row.id, row]));
  const lessonById = new Map(((lessonsRes.data ?? []) as Array<{ id: string; title: string }>).map((row) => [row.id, row.title]));
  const answersByAttempt = new Map<string, LmsQuizAnswer[]>();
  for (const answer of (answersRes.data ?? []) as LmsQuizAnswer[]) {
    const current = answersByAttempt.get(answer.attempt_id) ?? [];
    current.push(answer);
    answersByAttempt.set(answer.attempt_id, current);
  }

  return relevantAttempts.map((attempt) => {
    const quiz = quizById.get(attempt.quiz_id)!;
    const payloadQuestions = questions
      .filter((question) => question.quiz_id === attempt.quiz_id)
      .map((question) => ({
        ...question,
        options: ((optionsData ?? []) as LmsQuizOption[]).filter((option) => option.question_id === question.id),
        submitted_answers: (answersByAttempt.get(attempt.id) ?? [])
          .filter((answer) => answer.question_id === question.id)
          .map((answer) => ({
            option_id: answer.option_id,
            answer_text: answer.answer_text,
            is_correct: answer.is_correct,
          })),
      }));

    return {
      attempt,
      quiz,
      course_title: attempt.course_id ? courseById.get(attempt.course_id)?.title ?? "Treinamento" : "Treinamento",
      lesson_title: quiz.lesson_id ? lessonById.get(quiz.lesson_id) ?? "Avaliacao" : null,
      user_name: buildUserDisplayName(profileById.get(attempt.user_id) ?? {}),
      user_role: profileById.get(attempt.user_id)?.role ?? null,
      reviewer_name: attempt.reviewed_by ? buildUserDisplayName(profileById.get(attempt.reviewed_by) ?? {}) : null,
      questions: payloadQuestions,
    } satisfies LmsQuizReviewRow;
  });
}

export async function reviewQuizAttempt(
  access: Access,
  attemptId: string,
  payload: { score: number; reviewerComment: string; passed?: boolean | null },
) {
  const { data: attemptData, error: attemptError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle<LmsQuizAttempt>();
  if (attemptError || !attemptData) throw attemptError ?? new Error("Tentativa nao encontrada.");

  const quizPayload = await getQuizPayload(attemptData.quiz_id);
  if (!quizPayload) throw new Error("Avaliacao nao encontrada.");

  if (access.companyId && attemptData.course_id) {
    const { data: courseData } = await supabaseAdmin.from("lms_courses").select("company_id").eq("id", attemptData.course_id).maybeSingle<{ company_id: string | null }>();
    if (courseData?.company_id && courseData.company_id !== access.companyId) throw new Error("Avaliacao fora da sua empresa.");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(payload.score)));
  const passed = payload.passed ?? finalScore >= quizPayload.quiz.passing_score;
  const reviewerComment = payload.reviewerComment.trim();

  const { data: updatedAttempt, error: updateError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .update({
      score: finalScore,
      passed,
      review_status: "reviewed",
      reviewed_score: finalScore,
      reviewer_comment: reviewerComment || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: access.userId,
    })
    .eq("id", attemptId)
    .select("*")
    .maybeSingle<LmsQuizAttempt>();
  if (updateError || !updatedAttempt) throw updateError ?? new Error("Falha ao registrar a revisao.");

  const learnerProfile = profileByIdFromSingle(await supabaseAdmin.from("profiles").select("id,full_name,email").eq("id", updatedAttempt.user_id).maybeSingle<{ id: string; full_name: string | null; email: string | null }>());
  await supabaseAdmin.from("notifications").insert({
    to_user_id: updatedAttempt.user_id,
    type: "lms_quiz_reviewed",
    title: "Sua avaliacao foi corrigida",
    body: reviewerComment
      ? `Sua avaliacao foi revisada. Comentario: ${reviewerComment.slice(0, 120)}`
      : `Sua avaliacao foi revisada. Resultado final: ${finalScore}%.`,
    link: updatedAttempt.course_id ? `/lms/cursos/${updatedAttempt.course_id}` : "/lms/meus-treinamentos",
  });

  const reviewAccess = {
    ...access,
    userId: updatedAttempt.user_id,
    email: learnerProfile?.email ?? access.email,
  };

  if (updatedAttempt.course_id) {
    await recomputeUserCourseProgress(reviewAccess, updatedAttempt.course_id);
  }

  return updatedAttempt;
}

function profileByIdFromSingle<T>(response: { data: T | null } | null | undefined) {
  return response?.data ?? null;
}

export async function submitQuizAttempt(access: Access, quizId: string, answers: Record<string, string[]>) {
  const payload = await getQuizPayload(quizId);
  if (!payload) throw new Error("Quiz nao encontrado.");

  const latestAttempt = await getLatestQuizAttempt(access.userId, payload.quiz.course_id ?? "");
  if (payload.quiz.max_attempts && (latestAttempt?.attempt_number ?? 0) >= payload.quiz.max_attempts) {
    throw new Error("Numero maximo de tentativas atingido.");
  }

  let correctAnswers = 0;
  let autoGradedQuestions = 0;
  let requiresManualReview = false;
  for (const question of payload.questions) {
    const selectedAnswers = [...(answers[question.id] ?? [])];
    if (question.question_type === "essay" || question.requires_manual_review) {
      requiresManualReview = true;
      continue;
    }

    autoGradedQuestions += 1;
    if (question.question_type === "short_text") {
      const expectedAnswers = (question.accepted_answers ?? [])
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      const typedAnswer = (selectedAnswers[0] ?? "").trim().toLowerCase();
      if (typedAnswer && expectedAnswers.includes(typedAnswer)) correctAnswers += 1;
      continue;
    }

    const expected = question.options.filter((option) => option.is_correct).map((option) => option.id).sort();
    const given = selectedAnswers.sort();
    if (expected.length === given.length && expected.every((value, index) => value === given[index])) {
      correctAnswers += 1;
    }
  }

  const score = autoGradedQuestions ? Math.round((correctAnswers / autoGradedQuestions) * 100) : 0;
  const passed = !requiresManualReview && score >= payload.quiz.passing_score;
  const attemptNumber = (latestAttempt?.attempt_number ?? 0) + 1;

  const { data: attemptData, error: attemptError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .insert({
      quiz_id: quizId,
      user_id: access.userId,
      course_id: payload.quiz.course_id,
      score,
      passed,
      review_status: requiresManualReview ? "pending_review" : "auto_graded",
      reviewed_score: requiresManualReview ? null : score,
      attempt_number: attemptNumber,
    })
    .select("*")
    .maybeSingle<LmsQuizAttempt>();
  if (attemptError || !attemptData) throw attemptError ?? new Error("Falha ao registrar tentativa.");

  const answerRows: Array<{
    attempt_id: string;
    question_id: string;
    option_id: string | null;
    answer_text: string | null;
    is_correct: boolean;
  }> = [];

  for (const question of payload.questions) {
    const selected = answers[question.id] ?? [];
    if (question.question_type === "short_text" || question.question_type === "essay") {
      const typedAnswer = selected[0] ?? null;
      answerRows.push({
        attempt_id: attemptData.id,
        question_id: question.id,
        option_id: null,
        answer_text: typedAnswer,
        is_correct:
          question.question_type === "short_text"
            ? (question.accepted_answers ?? [])
                .map((item) => item.trim().toLowerCase())
                .includes((typedAnswer ?? "").trim().toLowerCase())
            : false,
      });
      continue;
    }

    for (const optionId of selected.length ? selected : [null]) {
      answerRows.push({
        attempt_id: attemptData.id,
        question_id: question.id,
        option_id: optionId,
        answer_text: null,
        is_correct: optionId ? question.options.some((option) => option.id === optionId && option.is_correct) : false,
      });
    }
  }

  if (answerRows.length) {
    await supabaseAdmin.from("lms_quiz_answers").insert(answerRows);
  }

  await supabaseAdmin.from("lms_course_access_logs").insert({
    user_id: access.userId,
    course_id: payload.quiz.course_id,
    lesson_id: payload.quiz.lesson_id,
    action: requiresManualReview ? "quiz_pending_review" : passed ? "quiz_passed" : "quiz_failed",
  });

  if (payload.quiz.course_id) {
    await recomputeUserCourseProgress(access, payload.quiz.course_id);
  }

  await registerStudyActivity(access);
  if (passed) {
    await awardGamificationXp(access, "quiz_passed");
    if (score >= 100) await awardGamificationXp(access, "quiz_perfect");
    await refreshGamificationState(access);
  }

  if (requiresManualReview && payload.quiz.course_id) {
    const { data: adminProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("active", true)
      .in("role", ["admin", "rh"])
      .or(access.companyId ? `company_id.eq.${access.companyId},company_id.is.null` : "company_id.is.null");

    if ((adminProfiles ?? []).length) {
      await supabaseAdmin.from("notifications").insert(
        ((adminProfiles ?? []) as Array<{ id: string }>).map((row) => ({
          to_user_id: row.id,
          type: "lms_quiz_review",
          title: "Avaliacao aguardando revisao",
          body: `${access.email ?? "Colaborador"} concluiu uma avaliacao discursiva em ${payload.quiz.title}.`,
          link: "/rh/lms/avaliacoes",
        })),
      );
    }
  }

  return {
    attempt: attemptData,
    score,
    passed,
    requiresManualReview,
    showScoreOnSubmit: payload.quiz.show_score_on_submit ?? !requiresManualReview,
    showCorrectAnswers: payload.quiz.show_correct_answers ?? false,
  };
}

export async function ensureCertificateForUser(access: Access, course: LmsCourse) {
  const { data: existing } = await supabaseAdmin
    .from("lms_certificates")
    .select("*")
    .eq("user_id", access.userId)
    .eq("course_id", course.id)
    .maybeSingle<LmsCertificate>();
  if (existing) return existing;

  const [{ data: progress }, { data: profile }, companyMeta] = await Promise.all([
    supabaseAdmin.from("lms_user_progress").select("*").eq("user_id", access.userId).eq("course_id", course.id).maybeSingle<LmsUserProgress>(),
    supabaseAdmin.from("profiles").select("full_name").eq("id", access.userId).maybeSingle<{ full_name: string | null }>(),
    fetchCompanyAndDepartments(access.companyId),
  ]);

  if (!progress || progress.status !== "completed") throw new Error("Curso ainda nao elegivel para certificado.");

  const validationCode = `LMS-${course.id.slice(0, 4).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const validationUrl = `${siteUrl.replace(/\/$/, "")}/certificados/${validationCode}`;
  const pdf = buildCertificatePdf({
    validationCode,
    learnerName: profile?.full_name ?? access.email ?? "Colaborador",
    courseTitle: course.title,
    workloadHours: course.workload_hours,
    completedAt: formatDateTime(progress.completed_at) ?? formatDateTime(new Date().toISOString()) ?? "",
    companyName: companyMeta.company?.name ?? "Portal RH",
    validationUrl,
  });

  const bucket = "lms-certificates";
  const filePath = `${access.companyId ?? "global"}/${access.userId}/${course.id}-${validationCode}.pdf`;
  const uploadRes = await supabaseAdmin.storage.from(bucket).upload(filePath, pdf, { contentType: "application/pdf", upsert: true });
  if (uploadRes.error) throw uploadRes.error;

  const { data: certificateData, error: certificateError } = await supabaseAdmin
    .from("lms_certificates")
    .insert({
      user_id: access.userId,
      course_id: course.id,
      validation_code: validationCode,
      file_url: buildStorageRef(bucket, filePath),
    })
    .select("*")
    .maybeSingle<LmsCertificate>();
  if (certificateError || !certificateData) throw certificateError ?? new Error("Falha ao emitir certificado.");

  await supabaseAdmin.from("lms_course_access_logs").insert({
    user_id: access.userId,
    course_id: course.id,
    lesson_id: null,
    action: "certificate_issued",
  });

  await awardGamificationXp(access, "certificate_issued");
  await refreshGamificationState(access);
  await publishLmsPulseHubHighlight({
    userId: access.userId,
    companyId: access.companyId,
    title: "Certificado emitido",
    body: `Acaba de conquistar o certificado do treinamento "${course.title}".`,
  });

  return certificateData;
}

export async function getCertificateDownload(access: Access, courseId: string) {
  const detail = await getCourseDetailForLearner(access, courseId);
  if (!detail) throw new Error("Curso nao encontrado.");
  const certificate = detail.certificate ?? (detail.progress?.status === "completed" ? await ensureCertificateForUser(access, detail.course) : null);
  if (!certificate) throw new Error("Certificado indisponivel.");

  const parsed = parseStorageRef(certificate.file_url);
  if (!parsed) throw new Error("Arquivo do certificado invalido.");
  const { data, error } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 10);
  if (error || !data?.signedUrl) throw error ?? new Error("Nao foi possivel gerar o link do certificado.");

  return {
    certificate,
    signedUrl: data.signedUrl,
  };
}

export async function getPublicCertificateValidation(validationCode: string) {
  const { data: certificate, error: certificateError } = await supabaseAdmin
    .from("lms_certificates")
    .select("id,user_id,course_id,validation_code,issued_at")
    .eq("validation_code", validationCode)
    .maybeSingle<{ id: string; user_id: string; course_id: string; validation_code: string; issued_at: string }>();

  if (certificateError || !certificate) return null;

  const [profileRes, courseRes, progressRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name,company_id").eq("id", certificate.user_id).maybeSingle<{ full_name: string | null; company_id: string | null }>(),
    supabaseAdmin.from("lms_courses").select("title,workload_hours").eq("id", certificate.course_id).maybeSingle<{ title: string; workload_hours: number | null }>(),
    supabaseAdmin.from("lms_user_progress").select("completed_at").eq("user_id", certificate.user_id).eq("course_id", certificate.course_id).maybeSingle<{ completed_at: string | null }>(),
  ]);

  const companyId = profileRes.data?.company_id ?? null;
  let companyName = "Portal RH";
  if (companyId) {
    const { data: company } = await supabaseAdmin.from("companies").select("name").eq("id", companyId).maybeSingle<{ name: string | null }>();
    companyName = company?.name?.trim() || companyName;
  }

  return {
    validationCode: certificate.validation_code,
    learnerName: profileRes.data?.full_name?.trim() || "Colaborador",
    courseTitle: courseRes.data?.title ?? "Treinamento",
    workloadHours: courseRes.data?.workload_hours ?? null,
    issuedAt: certificate.issued_at,
    completedAt: progressRes.data?.completed_at ?? certificate.issued_at,
    companyName,
  };
}

export async function getLmsReportCsv(companyId: string | null, filters?: Partial<LmsReportsFilters>) {
  const rows = await getLmsReportsData(companyId, filters);
  const header = ["colaborador", "departamento", "empresa", "curso", "categoria", "status", "progresso", "conclusao", "nota"];
  const csvRows = rows.map((row) => [
    row.user_name,
    row.department_name ?? "",
    row.company_name ?? "",
    row.course_title,
    row.category ?? "",
    row.status,
    row.progress_percent,
    row.completed_at ?? "",
    row.score ?? "",
  ]);

  return [header, ...csvRows]
    .map((columns) =>
      columns
        .map((value) => {
          const text = String(value ?? "");
          if (/[",;\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
          return text;
        })
        .join(","),
    )
      .join("\n");
}

function validatePublishableCoursePayload(payload: {
  title: string;
  slug: string;
  short_description: string;
  full_description: string;
  modules: Array<{
    title: string;
    lessons: Array<{
      title: string;
      lesson_type: string;
      content_url: string;
      content_text: string;
      quiz?: {
        title: string;
        questions: Array<{
          statement: string;
          question_type?: string;
          accepted_answers?: string[];
          requires_manual_review?: boolean;
          options: Array<{ text: string; is_correct: boolean }>;
        }>;
      } | null;
    }>;
  }>;
  quiz?: {
    title: string;
    questions: Array<{
      statement: string;
      options: Array<{ text: string; is_correct: boolean }>;
    }>;
  } | null;
}) {
  if (!payload.title.trim()) throw new Error("Informe o titulo do treinamento antes de publicar.");
  if (!payload.slug.trim()) throw new Error("Informe o endereco do curso antes de publicar.");
  if (!payload.short_description.trim()) throw new Error("Informe o resumo curto antes de publicar.");
  if (!payload.full_description.trim()) throw new Error("Informe a descricao completa antes de publicar.");
  if (!payload.modules.length) throw new Error("Crie pelo menos um modulo antes de publicar.");

  for (const [moduleIndex, module] of payload.modules.entries()) {
    if (!module.title.trim()) throw new Error(`Preencha o titulo do modulo ${moduleIndex + 1} antes de publicar.`);
    if (!module.lessons.length) throw new Error(`O modulo ${moduleIndex + 1} precisa ter pelo menos uma aula.`);
    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      if (!lesson.title.trim()) {
        throw new Error(`Preencha o titulo da aula ${lessonIndex + 1} do modulo ${moduleIndex + 1}.`);
      }
      if (lesson.lesson_type !== "avaliacao" && !lesson.content_url.trim() && !lesson.content_text.trim()) {
        throw new Error(`Adicione conteudo principal na aula "${lesson.title}" antes de publicar.`);
      }
      if (lesson.lesson_type === "avaliacao") {
        if (!lesson.quiz?.title.trim()) {
          throw new Error(`Defina o titulo da avaliacao da aula "${lesson.title}".`);
        }
        if (!lesson.quiz.questions.length) {
          throw new Error(`Adicione pelo menos uma pergunta na avaliacao da aula "${lesson.title}".`);
        }
        for (const [questionIndex, question] of lesson.quiz.questions.entries()) {
          if (!question.statement.trim()) {
            throw new Error(`Preencha o enunciado da pergunta ${questionIndex + 1} da aula "${lesson.title}".`);
          }
          if (question.question_type === "essay") continue;
          if (question.question_type === "short_text") {
            const validAnswers = (question.accepted_answers ?? []).filter((answer) => answer.trim());
            if (!question.requires_manual_review && !validAnswers.length) {
              throw new Error(`Informe ao menos uma resposta aceita na pergunta ${questionIndex + 1} da aula "${lesson.title}".`);
            }
            continue;
          }
          const validOptions = question.options.filter((option) => option.text.trim());
          if (validOptions.length < 2) {
            throw new Error(`A pergunta ${questionIndex + 1} da aula "${lesson.title}" precisa de pelo menos duas alternativas.`);
          }
          if (!validOptions.some((option) => option.is_correct)) {
            throw new Error(`Marque ao menos uma resposta correta na pergunta ${questionIndex + 1} da aula "${lesson.title}".`);
          }
        }
      }
    }
  }

  if (payload.quiz) {
    if (!payload.quiz.title.trim()) throw new Error("Defina o titulo da avaliacao antes de publicar.");
    for (const [questionIndex, question] of payload.quiz.questions.entries()) {
      if (!question.statement.trim()) throw new Error(`Preencha o enunciado da pergunta ${questionIndex + 1}.`);
      const validOptions = question.options.filter((option) => option.text.trim());
      if (validOptions.length < 2) throw new Error(`A pergunta ${questionIndex + 1} precisa de pelo menos duas alternativas.`);
      if (!validOptions.some((option) => option.is_correct)) {
        throw new Error(`Marque ao menos uma resposta correta na pergunta ${questionIndex + 1}.`);
      }
    }
  }
}

export async function upsertCourseWithStructure(
  access: Access,
  courseId: string | null,
  payload: {
    title: string;
    slug: string;
    short_description: string;
    full_description: string;
    category: string;
    thumbnail_url: string;
    banner_url: string;
    workload_hours: number | null;
    required: boolean;
    certificate_enabled: boolean;
    passing_score: number | null;
    status: string;
    visibility: string;
    sequence_required: boolean;
    onboarding_recommended: boolean;
    modules: Array<{
      id?: string;
      title: string;
      description: string;
      sort_order: number;
      lessons: Array<{
        id?: string;
        title: string;
        description: string;
        lesson_type: string;
        content_url: string;
        content_text: string;
        duration_minutes: number | null;
        sort_order: number;
        is_required: boolean;
        allow_preview: boolean;
        storage_bucket?: string | null;
        storage_path?: string | null;
        quiz?: {
          id?: string;
          title: string;
          instructions: string;
          passing_score: number;
          max_attempts: number | null;
          randomize_questions: boolean;
          show_score_on_submit: boolean;
          show_correct_answers: boolean;
          questions: Array<{
            id?: string;
            statement: string;
            help_text: string;
            question_type: string;
            sort_order: number;
            image_url?: string | null;
            accepted_answers?: string[];
            requires_manual_review?: boolean;
            options: Array<{ id?: string; text: string; is_correct: boolean; image_url?: string | null }>;
          }>;
        } | null;
      }>;
    }>;
    quiz?: {
      id?: string;
      title: string;
      passing_score: number;
      max_attempts: number | null;
      randomize_questions: boolean;
      questions: Array<{
        id?: string;
        statement: string;
        question_type: string;
        sort_order: number;
        options: Array<{ id?: string; text: string; is_correct: boolean }>;
      }>;
    } | null;
  },
  ) {
    if (payload.status === "published") validatePublishableCoursePayload(payload);

    const coursePayload = {
      company_id: access.companyId,
    title: payload.title,
    slug: payload.slug,
    short_description: payload.short_description || null,
    full_description: payload.full_description || null,
    category: payload.category || null,
    thumbnail_url: payload.thumbnail_url || null,
    banner_url: payload.banner_url || null,
    workload_hours: payload.workload_hours,
    required: payload.required,
    certificate_enabled: payload.certificate_enabled,
    passing_score: payload.passing_score,
    status: payload.status,
    visibility: payload.visibility,
    sequence_required: payload.sequence_required,
    onboarding_recommended: payload.onboarding_recommended,
    created_by: access.userId,
    updated_at: new Date().toISOString(),
  };

  const courseRes = courseId
    ? await supabaseAdmin.from("lms_courses").update(coursePayload).eq("id", courseId).select("*").maybeSingle<LmsCourse>()
    : await supabaseAdmin.from("lms_courses").insert(coursePayload).select("*").maybeSingle<LmsCourse>();
  if (courseRes.error || !courseRes.data) throw courseRes.error ?? new Error("Nao foi possivel salvar o curso.");

  const savedCourseId = courseRes.data.id;
  await supabaseAdmin.from("lms_course_modules").delete().eq("course_id", savedCourseId);
  await supabaseAdmin.from("lms_lessons").delete().eq("course_id", savedCourseId);

  await supabaseAdmin.from("lms_quizzes").delete().eq("course_id", savedCourseId);

  for (const module of payload.modules) {
    const { data: moduleData, error: moduleError } = await supabaseAdmin
      .from("lms_course_modules")
      .insert({
        course_id: savedCourseId,
        title: module.title,
        description: module.description || null,
        sort_order: module.sort_order,
      })
      .select("*")
      .maybeSingle<LmsCourseModule>();
    if (moduleError || !moduleData) throw moduleError ?? new Error("Falha ao salvar modulo.");

    for (const lesson of module.lessons) {
      const contentUrl =
        lesson.storage_bucket && lesson.storage_path
          ? buildStorageRef(lesson.storage_bucket, lesson.storage_path)
          : lesson.content_url || null;
      const { data: lessonData, error: lessonError } = await supabaseAdmin.from("lms_lessons").insert({
        course_id: savedCourseId,
        module_id: moduleData.id,
        title: lesson.title,
        description: lesson.description || null,
        lesson_type: lesson.lesson_type,
        content_url: contentUrl,
        content_text: lesson.content_text || null,
        duration_minutes: lesson.duration_minutes,
        sort_order: lesson.sort_order,
        is_required: lesson.is_required,
        allow_preview: lesson.allow_preview,
        storage_bucket: lesson.storage_bucket ?? null,
        storage_path: lesson.storage_path ?? null,
      }).select("*").maybeSingle<LmsLesson>();
      if (lessonError || !lessonData) throw lessonError ?? new Error("Falha ao salvar aula.");

      if (lesson.lesson_type === "avaliacao" && lesson.quiz) {
        const { data: quizData, error: quizError } = await supabaseAdmin
          .from("lms_quizzes")
          .insert({
            course_id: savedCourseId,
            lesson_id: lessonData.id,
            title: lesson.quiz.title,
            instructions: lesson.quiz.instructions || null,
            passing_score: lesson.quiz.passing_score,
            max_attempts: lesson.quiz.max_attempts,
            randomize_questions: lesson.quiz.randomize_questions,
            show_score_on_submit: lesson.quiz.show_score_on_submit,
            show_correct_answers: lesson.quiz.show_correct_answers,
          })
          .select("*")
          .maybeSingle<LmsQuiz>();
        if (quizError || !quizData) throw quizError ?? new Error("Falha ao salvar avaliacao.");

        for (const question of lesson.quiz.questions) {
          const { data: questionData, error: questionError } = await supabaseAdmin
            .from("lms_quiz_questions")
            .insert({
              quiz_id: quizData.id,
              statement: question.statement,
              question_type: question.question_type,
              help_text: question.help_text || null,
              image_url: question.image_url || null,
              accepted_answers: question.accepted_answers?.filter((answer) => answer.trim()) ?? [],
              requires_manual_review: question.requires_manual_review ?? question.question_type === "essay",
              sort_order: question.sort_order,
            })
            .select("*")
            .maybeSingle<LmsQuizQuestion>();
          if (questionError || !questionData) throw questionError ?? new Error("Falha ao salvar pergunta.");

          const validOptions = question.options.filter((option) => option.text.trim() || option.image_url);
          if (validOptions.length) {
            const { error: optionError } = await supabaseAdmin.from("lms_quiz_options").insert(
              validOptions.map((option) => ({
                question_id: questionData.id,
                text: option.text,
                is_correct: option.is_correct,
                image_url: option.image_url || null,
              })),
            );
            if (optionError) throw optionError;
          }
        }
      }
    }
  }

  if (payload.quiz) {
    const { data: quizData, error: quizError } = await supabaseAdmin
      .from("lms_quizzes")
      .insert({
        course_id: savedCourseId,
        lesson_id: null,
        title: payload.quiz.title,
        passing_score: payload.quiz.passing_score,
        max_attempts: payload.quiz.max_attempts,
        randomize_questions: payload.quiz.randomize_questions,
      })
      .select("*")
      .maybeSingle<LmsQuiz>();
    if (quizError || !quizData) throw quizError ?? new Error("Falha ao salvar quiz.");

    for (const question of payload.quiz.questions) {
      const { data: questionData, error: questionError } = await supabaseAdmin
        .from("lms_quiz_questions")
        .insert({
          quiz_id: quizData.id,
          statement: question.statement,
          question_type: question.question_type,
          sort_order: question.sort_order,
        })
        .select("*")
        .maybeSingle<LmsQuizQuestion>();
      if (questionError || !questionData) throw questionError ?? new Error("Falha ao salvar pergunta.");

      if (question.options.length) {
        await supabaseAdmin.from("lms_quiz_options").insert(
          question.options.map((option) => ({
            question_id: questionData.id,
            text: option.text,
            is_correct: option.is_correct,
          })),
        );
      }
    }
  }

  await supabaseAdmin.from("lms_course_access_logs").insert({
    user_id: access.userId,
    course_id: savedCourseId,
    lesson_id: null,
    action: courseId ? "course_updated" : "course_created",
  });

  return courseRes.data;
}

export async function upsertLearningPath(
  access: Access,
  payload: { id?: string; title: string; description: string; status: string; onboarding_required: boolean; courseIds: string[] },
) {
  const basePayload = {
    company_id: access.companyId,
    title: payload.title,
    description: payload.description || null,
    status: payload.status,
    onboarding_required: payload.onboarding_required,
    updated_at: new Date().toISOString(),
  };
  const pathRes = payload.id
    ? await supabaseAdmin.from("lms_learning_paths").update(basePayload).eq("id", payload.id).select("*").maybeSingle<LmsLearningPath>()
    : await supabaseAdmin.from("lms_learning_paths").insert(basePayload).select("*").maybeSingle<LmsLearningPath>();
  if (pathRes.error || !pathRes.data) throw pathRes.error ?? new Error("Falha ao salvar trilha.");

  await supabaseAdmin.from("lms_learning_path_courses").delete().eq("learning_path_id", pathRes.data.id);
  if (payload.courseIds.length) {
    await supabaseAdmin.from("lms_learning_path_courses").insert(
      payload.courseIds.map((courseId, index) => ({
        learning_path_id: pathRes.data!.id,
        course_id: courseId,
        sort_order: index + 1,
        required: true,
      })),
    );
  }

  return pathRes.data;
}

async function notifyAssignmentAudience(
  access: Access,
  assignment: LmsAssignment,
  supportData: LmsAssignmentSupportData,
) {
  const titleSource =
    assignment.course_id
      ? supportData.courses.find((item) => item.id === assignment.course_id)?.label ?? "treinamento"
      : supportData.learningPaths.find((item) => item.id === assignment.learning_path_id)?.label ?? "trilha";

  let profilesQuery = supabaseAdmin
    .from("profiles")
    .select("id,company_id,department_id,role,active")
    .eq("active", true);

  if (access.companyId) profilesQuery = profilesQuery.eq("company_id", access.companyId);
  const { data: profilesData, error: profilesError } = await profilesQuery;
  if (profilesError) throw profilesError;

  const profiles = (profilesData ?? []) as ProfileMini[];
  const recipients = profiles.filter((profile) => assignmentMatchesProfile(profile, assignment)).map((profile) => profile.id);
  if (!recipients.length) return;

  const dueText = assignment.due_date ? ` Prazo: ${assignment.due_date}.` : "";
  const link = assignment.course_id ? `/lms/cursos/${assignment.course_id}` : "/lms/meus-treinamentos";
  const payload = recipients.map((userId) => ({
    to_user_id: userId,
    title: `Novo treinamento atribuido: ${titleSource}`,
    body: `Voce recebeu ${assignment.learning_path_id ? "uma trilha" : "um treinamento"} no LMS.${dueText}`,
    link,
    type: "lms_assignment",
  }));

  const notifyRes = await supabaseAdmin.from("notifications").insert(payload);
  if (notifyRes.error) {
    const text = notifyRes.error.message.toLowerCase();
    const ignorable =
      text.includes("does not exist") ||
      text.includes("relation") ||
      text.includes("schema cache") ||
      text.includes("column");
    if (!ignorable) throw notifyRes.error;
  }
}

export async function createAssignment(
  access: Access,
  payload: {
    assignment_type: "user" | "department" | "company" | "role";
    target_id: string;
    course_id?: string | null;
    learning_path_id?: string | null;
    due_date?: string | null;
    mandatory?: boolean;
    expires_at?: string | null;
    recurring_every_days?: number | null;
    auto_reassign_on_expiry?: boolean;
  },
) {
  const assignmentGroup = randomUUID();
  const { data, error } = await supabaseAdmin
    .from("lms_assignments")
    .insert({
      assignment_type: payload.assignment_type,
      target_id: payload.target_id,
      course_id: payload.course_id ?? null,
      learning_path_id: payload.learning_path_id ?? null,
      assigned_by: access.userId,
      due_date: payload.due_date || null,
      mandatory: Boolean(payload.mandatory),
      status: "active",
      expires_at: payload.expires_at || null,
      recurring_every_days: payload.recurring_every_days ?? null,
      auto_reassign_on_expiry: Boolean(payload.auto_reassign_on_expiry),
      assignment_group: assignmentGroup,
    })
    .select("*")
    .maybeSingle<LmsAssignment>();
  if (error || !data) throw error ?? new Error("Falha ao salvar atribuicao.");
  const supportData = await buildAssignmentSupportData(access.companyId);
  await notifyAssignmentAudience(access, data, supportData);
  return data;
}

function addDays(base: string | null | undefined, days: number) {
  if (!base) return null;
  const date = new Date(`${base}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function runRecurringAssignments(access: Access) {
  const { data, error } = await supabaseAdmin
    .from("lms_assignments")
    .select("*")
    .eq("status", "active")
    .eq("auto_reassign_on_expiry", true)
    .not("recurring_every_days", "is", null);
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const candidates = ((data ?? []) as LmsAssignment[]).filter(
    (assignment) =>
      !!assignment.recurring_every_days &&
      !!assignment.expires_at &&
      assignment.expires_at <= today,
  );

  let created = 0;
  for (const assignment of candidates) {
    const nextDueDate = addDays(assignment.due_date, assignment.recurring_every_days ?? 0);
    const nextExpiresAt = addDays(assignment.expires_at, assignment.recurring_every_days ?? 0);
    const { data: existing } = await supabaseAdmin
      .from("lms_assignments")
      .select("id")
      .eq("assignment_group", assignment.assignment_group ?? assignment.id)
      .eq("status", "active")
      .eq("target_id", assignment.target_id)
      .eq("assignment_type", assignment.assignment_type)
      .eq("course_id", assignment.course_id)
      .eq("learning_path_id", assignment.learning_path_id)
      .eq("due_date", nextDueDate)
      .eq("expires_at", nextExpiresAt)
      .limit(1);

    if ((existing ?? []).length) continue;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("lms_assignments")
      .insert({
        assignment_type: assignment.assignment_type,
        target_id: assignment.target_id,
        course_id: assignment.course_id,
        learning_path_id: assignment.learning_path_id,
        assigned_by: access.userId,
        due_date: nextDueDate,
        mandatory: assignment.mandatory,
        status: "active",
        expires_at: nextExpiresAt,
        recurring_every_days: assignment.recurring_every_days ?? null,
        auto_reassign_on_expiry: true,
        assignment_group: assignment.assignment_group ?? assignment.id,
      })
      .select("*")
      .maybeSingle<LmsAssignment>();

    if (insertError || !inserted) throw insertError ?? new Error("Falha ao gerar atribuicao recorrente.");
    const supportData = await buildAssignmentSupportData(access.companyId);
    await notifyAssignmentAudience(access, inserted, supportData);
    created += 1;
  }

  return { created };
}

export async function archiveCourse(access: Access, courseId: string) {
  const { data, error } = await supabaseAdmin
    .from("lms_courses")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("company_id", access.companyId)
    .select("*")
    .maybeSingle<LmsCourse>();
  if (error || !data) throw error ?? new Error("Nao foi possivel arquivar o curso.");
  return data;
}

export async function duplicateCourse(access: Access, courseId: string) {
  const [courseRes, modulesRes, lessonsRes, quiz, lessonQuizzes] = await Promise.all([
    supabaseAdmin.from("lms_courses").select("*").eq("id", courseId).maybeSingle<LmsCourse>(),
    supabaseAdmin.from("lms_course_modules").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
    supabaseAdmin.from("lms_lessons").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
    getQuizPayloadForCourse(courseId),
    fetchCourseQuizzes(courseId),
  ]);
  if (courseRes.error || !courseRes.data) throw courseRes.error ?? new Error("Curso nao encontrado.");
  if (access.companyId && courseRes.data.company_id && courseRes.data.company_id !== access.companyId) {
    throw new Error("Curso fora da sua empresa.");
  }

  const course = courseRes.data;
  const modules = (modulesRes.data ?? []) as LmsCourseModule[];
  const lessons = (lessonsRes.data ?? []) as LmsLesson[];
  const lessonQuizPayloads = new Map<string, LmsQuizPayload>();
  await Promise.all(
    lessonQuizzes
      .filter((item) => item.lesson_id)
      .map(async (item) => {
        const payload = await getQuizPayload(item.id);
        if (payload && item.lesson_id) lessonQuizPayloads.set(item.lesson_id, payload);
      }),
  );

  const suffix = randomUUID().slice(0, 6).toLowerCase();
  const duplicated = await upsertCourseWithStructure(access, null, {
    title: `Copia - ${course.title}`,
    slug: `${course.slug}-copia-${suffix}`,
    short_description: course.short_description ?? "",
    full_description: course.full_description ?? "",
    category: course.category ?? "",
    thumbnail_url: course.thumbnail_url ?? "",
    banner_url: course.banner_url ?? "",
    workload_hours: course.workload_hours,
    required: course.required,
    certificate_enabled: course.certificate_enabled,
    passing_score: course.passing_score,
    status: "draft",
    visibility: course.visibility,
    sequence_required: course.sequence_required,
    onboarding_recommended: course.onboarding_recommended,
    modules: modules.map((module, moduleIndex) => ({
      title: module.title,
      description: module.description ?? "",
      sort_order: moduleIndex + 1,
      lessons: lessons.filter((lesson) => lesson.module_id === module.id).map((lesson, lessonIndex) => ({
        title: lesson.title,
        description: lesson.description ?? "",
        lesson_type: lesson.lesson_type,
        content_url: lesson.content_url ?? "",
        content_text: lesson.content_text ?? "",
        duration_minutes: lesson.duration_minutes,
        sort_order: lessonIndex + 1,
        is_required: lesson.is_required,
        allow_preview: lesson.allow_preview,
        storage_bucket: lesson.storage_bucket ?? null,
        storage_path: lesson.storage_path ?? null,
        quiz: lessonQuizPayloads.get(lesson.id)
          ? toEditorQuizPayload(lessonQuizPayloads.get(lesson.id)!)
          : null,
      })),
    })),
    quiz: quiz
      ? {
          title: `${quiz.quiz.title} - copia`,
          passing_score: quiz.quiz.passing_score,
          max_attempts: quiz.quiz.max_attempts,
          randomize_questions: quiz.quiz.randomize_questions,
          questions: quiz.questions.map((question, index) => ({
            statement: question.statement,
            question_type: question.question_type,
            sort_order: index + 1,
            options: question.options.map((option) => ({
              text: option.text,
              is_correct: option.is_correct,
            })),
          })),
        }
      : null,
  });

  return duplicated;
}

export async function duplicateLearningPath(access: Access, pathId: string) {
  const paths = await getLmsLearningPathsAdminData(access.companyId);
  const source = paths.find((item) => item.id === pathId);
  if (!source) throw new Error("Trilha nao encontrada.");

  const duplicated = await upsertLearningPath(access, {
    title: `Copia - ${source.title}`,
    description: source.description ?? "",
    status: "draft",
    onboarding_required: source.onboarding_required,
    courseIds: ((source.courses ?? []) as Array<{ course_id: string }>).map((course) => course.course_id),
  });

  return duplicated;
}

export async function sendLmsReminder(
  access: Access,
  payload: {
    userId: string;
    courseId: string;
    courseTitle?: string | null;
    dueDate?: string | null;
    source: "gestor" | "rh";
  },
) {
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,company_id,manager_id,full_name,email")
    .eq("id", payload.userId)
    .maybeSingle<ProfileMini>();
  if (profileError || !profileData) throw profileError ?? new Error("Colaborador nao encontrado.");

  if (access.companyId && profileData.company_id && profileData.company_id !== access.companyId) {
    throw new Error("Colaborador fora da sua empresa.");
  }
  if (access.role === "gestor" && profileData.manager_id !== access.userId) {
    throw new Error("Voce so pode lembrar colaboradores da sua equipe.");
  }

  const title = `Lembrete de treinamento: ${payload.courseTitle ?? "Curso atribuido"}`;
  const body = payload.dueDate
    ? `Este treinamento continua pendente e possui prazo em ${payload.dueDate}. Retome o quanto antes.`
    : "Este treinamento continua pendente. Retome o quanto antes no portal.";
  const link = `/lms/cursos/${payload.courseId}`;

  const notificationRes = await supabaseAdmin.from("notifications").insert({
    to_user_id: payload.userId,
    title,
    body,
    link,
    type: "lms_manual_reminder",
  });

  if (notificationRes.error) {
    const text = notificationRes.error.message.toLowerCase();
    const ignorable =
      text.includes("does not exist") ||
      text.includes("relation") ||
      text.includes("schema cache") ||
      text.includes("column");
    if (!ignorable) throw notificationRes.error;
  }

  await sendLmsReminderEmail({
    email: profileData.email ?? null,
    fullName: profileData.full_name ?? null,
    courseTitle: payload.courseTitle ?? "Curso atribuido",
    dueDate: payload.dueDate ?? null,
  });

  return { success: true };
}

export async function dispatchLmsDeadlineSweep(access: Access) {
  const [profilesRes, coursesRes, progressRes] = await Promise.all([
    access.companyId
      ? supabaseAdmin.from("profiles").select("id,company_id,department_id,role,active").eq("company_id", access.companyId).eq("active", true)
      : supabaseAdmin.from("profiles").select("id,company_id,department_id,role,active").eq("active", true),
    access.companyId
      ? supabaseAdmin.from("lms_courses").select("*").or(`company_id.eq.${access.companyId},company_id.is.null`)
      : supabaseAdmin.from("lms_courses").select("*"),
    supabaseAdmin.from("lms_user_progress").select("*"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (coursesRes.error) throw coursesRes.error;
  if (progressRes.error) throw progressRes.error;

  const courseById = new Map(((coursesRes.data ?? []) as LmsCourse[]).map((course) => [course.id, course]));
  const profiles = (profilesRes.data ?? []) as ProfileMini[];
  const progressMap = new Map(
    ((progressRes.data ?? []) as LmsUserProgress[]).map((row) => [`${row.user_id}:${row.course_id}`, row]),
  );
  const graph = await fetchActiveAssignmentGraph();
  let sent = 0;

  for (const profile of profiles) {
    const visibility = buildVisibilityForProfile(profile, graph);
    const cards: LmsMyTrainingCard[] = visibility.map((item) => ({
      course: courseById.get(item.course_id) ?? {
        id: item.course_id,
        company_id: profile.company_id,
        title: "Curso",
        slug: item.course_id,
        short_description: null,
        full_description: null,
        category: null,
        thumbnail_url: null,
        banner_url: null,
        workload_hours: null,
        required: item.mandatory,
        certificate_enabled: true,
        passing_score: null,
        status: "published",
        visibility: "publico_interno",
        sequence_required: false,
        onboarding_recommended: false,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      progress: progressMap.get(`${profile.id}:${item.course_id}`) ?? null,
      assignment: item,
      status: progressMap.get(`${profile.id}:${item.course_id}`)?.status ?? "not_started",
    }));
    sent += await ensureLmsDeadlineNotifications(
      {
        ...access,
        userId: profile.id,
        companyId: profile.company_id,
        departmentId: profile.department_id,
        role: profile.role ?? "colaborador",
      } as Access,
      cards,
    );
  }

  return { success: true, dispatched: sent };
}

export async function dispatchLmsWeeklySummary(access: Access) {
  const recipientsRes = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,role,company_id,department_id,manager_id,active")
    .eq("active", true)
    .in("role", ["gestor", "rh", "admin"]);

  if (recipientsRes.error) throw recipientsRes.error;

  const recipients = (recipientsRes.data ?? []) as ProfileMini[];
  let dispatched = 0;

  for (const recipient of recipients) {
    if (access.companyId && recipient.company_id && recipient.company_id !== access.companyId) continue;

    if (recipient.role === "gestor") {
      const teamData = await getTeamTrainingsData({
        ...access,
        userId: recipient.id,
        companyId: recipient.company_id,
        departmentId: recipient.department_id ?? null,
        role: "gestor",
        email: recipient.email ?? null,
      } as Access);
      if (!teamData.summary.totalAssignments) continue;

      const title = `Resumo semanal da sua equipe no LMS`;
      await supabaseAdmin.from("notifications").insert({
        to_user_id: recipient.id,
        title,
        body: `Concluidos: ${teamData.weeklyDigest.completedThisWeek} · Vencendo: ${teamData.weeklyDigest.dueSoon} · Atrasados: ${teamData.weeklyDigest.overdue}.`,
        link: "/gestor/lms/equipe",
        type: "lms_weekly_summary",
      });
      await sendWeeklySummaryEmail({
        email: recipient.email ?? null,
        recipientName: recipient.full_name ?? null,
        title,
        periodLabel: teamData.weeklyDigest.periodLabel,
        completed: teamData.weeklyDigest.completedThisWeek,
        dueSoon: teamData.weeklyDigest.dueSoon,
        overdue: teamData.weeklyDigest.overdue,
        notStarted: teamData.weeklyDigest.notStarted,
      });
      dispatched += 1;
      continue;
    }

    const dashboard = await getLmsAdminDashboardData(recipient.company_id ?? access.companyId ?? null);
    const title = "Resumo semanal do LMS";
    await supabaseAdmin.from("notifications").insert({
      to_user_id: recipient.id,
      title,
      body: `Concluidos: ${dashboard.weeklyDigest.completedThisWeek} · Vencendo: ${dashboard.weeklyDigest.dueSoon} · Atrasados: ${dashboard.weeklyDigest.overdue}.`,
      link: "/rh/lms",
      type: "lms_weekly_summary",
    });
    await sendWeeklySummaryEmail({
      email: recipient.email ?? null,
      recipientName: recipient.full_name ?? null,
      title,
      periodLabel: dashboard.weeklyDigest.periodLabel,
      completed: dashboard.weeklyDigest.completedThisWeek,
      dueSoon: dashboard.weeklyDigest.dueSoon,
      overdue: dashboard.weeklyDigest.overdue,
      notStarted: dashboard.weeklyDigest.notStarted,
    });
    dispatched += 1;
  }

  return { success: true, dispatched };
}

export async function sendMyLmsWeeklySummary(access: Access) {
  if (access.role === "gestor") {
    const teamData = await getTeamTrainingsData(access);
    const title = "Resumo semanal da sua equipe no LMS";
    await supabaseAdmin.from("notifications").insert({
      to_user_id: access.userId,
      title,
      body: `Concluidos: ${teamData.weeklyDigest.completedThisWeek} · Vencendo: ${teamData.weeklyDigest.dueSoon} · Atrasados: ${teamData.weeklyDigest.overdue}.`,
      link: "/gestor/lms/equipe",
      type: "lms_weekly_summary",
    });
    await sendWeeklySummaryEmail({
      email: access.email ?? null,
      recipientName: null,
      title,
      periodLabel: teamData.weeklyDigest.periodLabel,
      completed: teamData.weeklyDigest.completedThisWeek,
      dueSoon: teamData.weeklyDigest.dueSoon,
      overdue: teamData.weeklyDigest.overdue,
      notStarted: teamData.weeklyDigest.notStarted,
    });
    return { success: true, target: "gestor" as const };
  }

  const dashboard = await getLmsAdminDashboardData(access.companyId);
  const title = "Resumo semanal do LMS";
  await supabaseAdmin.from("notifications").insert({
    to_user_id: access.userId,
    title,
    body: `Concluidos: ${dashboard.weeklyDigest.completedThisWeek} · Vencendo: ${dashboard.weeklyDigest.dueSoon} · Atrasados: ${dashboard.weeklyDigest.overdue}.`,
    link: "/rh/lms",
    type: "lms_weekly_summary",
  });
  await sendWeeklySummaryEmail({
    email: access.email ?? null,
    recipientName: null,
    title,
    periodLabel: dashboard.weeklyDigest.periodLabel,
    completed: dashboard.weeklyDigest.completedThisWeek,
    dueSoon: dashboard.weeklyDigest.dueSoon,
    overdue: dashboard.weeklyDigest.overdue,
    notStarted: dashboard.weeklyDigest.notStarted,
  });
  return { success: true, target: "admin" as const };
}
