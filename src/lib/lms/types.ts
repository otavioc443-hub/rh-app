export const LMS_COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const LMS_VISIBILITY = ["publico_interno", "restrito"] as const;
export const LMS_LESSON_TYPES = ["video", "pdf", "arquivo", "link", "texto", "avaliacao"] as const;
export const LMS_ASSIGNMENT_TARGET_TYPES = ["user", "department", "company", "role", "learning_path"] as const;
export const LMS_ASSIGNMENT_STATUSES = ["active", "paused", "expired", "cancelled"] as const;
export const LMS_PROGRESS_STATUSES = ["not_started", "in_progress", "completed", "overdue"] as const;
export const LMS_QUIZ_QUESTION_TYPES = ["single_choice", "multiple_choice", "true_false"] as const;

export type LmsCourseStatus = (typeof LMS_COURSE_STATUSES)[number];
export type LmsCourseVisibility = (typeof LMS_VISIBILITY)[number];
export type LmsLessonType = (typeof LMS_LESSON_TYPES)[number];
export type LmsAssignmentTargetType = (typeof LMS_ASSIGNMENT_TARGET_TYPES)[number];
export type LmsAssignmentStatus = (typeof LMS_ASSIGNMENT_STATUSES)[number];
export type LmsProgressStatus = (typeof LMS_PROGRESS_STATUSES)[number];
export type LmsQuizQuestionType = (typeof LMS_QUIZ_QUESTION_TYPES)[number];

export type LmsCourse = {
  id: string;
  company_id: string | null;
  title: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  workload_hours: number | null;
  required: boolean;
  certificate_enabled: boolean;
  passing_score: number | null;
  status: LmsCourseStatus;
  visibility: LmsCourseVisibility;
  sequence_required: boolean;
  onboarding_recommended: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LmsCourseWithCounts = LmsCourse & {
  module_count: number;
  lesson_count: number;
  assignment_count: number;
  active_learners: number;
};

export type LmsCourseModule = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type LmsLesson = {
  id: string;
  course_id: string;
  module_id: string;
  title: string;
  description: string | null;
  lesson_type: LmsLessonType;
  content_url: string | null;
  content_text: string | null;
  duration_minutes: number | null;
  sort_order: number;
  is_required: boolean;
  allow_preview: boolean;
  storage_bucket: string | null;
  storage_path: string | null;
  created_at: string;
};

export type LmsLearningPath = {
  id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  status: LmsCourseStatus;
  onboarding_required: boolean;
  created_at: string;
  updated_at: string;
};

export type LmsLearningPathCourse = {
  id: string;
  learning_path_id: string;
  course_id: string;
  sort_order: number;
  required: boolean;
};

export type LmsAssignment = {
  id: string;
  assignment_type: LmsAssignmentTargetType;
  target_id: string;
  course_id: string | null;
  learning_path_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  due_date: string | null;
  mandatory: boolean;
  status: LmsAssignmentStatus;
  expires_at: string | null;
};

export type LmsAssignmentExpanded = LmsAssignment & {
  course_title: string | null;
  learning_path_title: string | null;
  assigned_by_name: string | null;
  target_label: string | null;
};

export type LmsUserCourseVisibility = {
  user_id: string;
  course_id: string;
  assignment_id: string;
  assignment_type: LmsAssignmentTargetType;
  learning_path_id: string | null;
  due_date: string | null;
  mandatory: boolean;
  assigned_at: string;
  expires_at: string | null;
};

export type LmsUserProgress = {
  id: string;
  user_id: string;
  course_id: string;
  status: LmsProgressStatus;
  progress_percent: number;
  completed_lessons: number;
  required_lessons: number;
  passed_quiz: boolean;
  started_at: string | null;
  completed_at: string | null;
  last_lesson_id: string | null;
  updated_at: string;
};

export type LmsLessonProgress = {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  completed: boolean;
  completed_at: string | null;
  time_spent_minutes: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LmsQuiz = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  title: string;
  passing_score: number;
  max_attempts: number | null;
  randomize_questions: boolean;
  created_at: string;
};

export type LmsQuizQuestion = {
  id: string;
  quiz_id: string;
  statement: string;
  question_type: LmsQuizQuestionType;
  sort_order: number;
};

export type LmsQuizOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
};

export type LmsQuizAttempt = {
  id: string;
  quiz_id: string;
  course_id: string | null;
  user_id: string;
  score: number;
  passed: boolean;
  attempt_number: number;
  submitted_at: string;
};

export type LmsQuizAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  option_id: string | null;
  answer_text: string | null;
  is_correct: boolean;
};

export type LmsCertificate = {
  id: string;
  user_id: string;
  course_id: string;
  validation_code: string;
  file_url: string | null;
  issued_at: string;
};

export type LmsCourseAccessLog = {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string | null;
  action: string;
  created_at: string;
};

export type LmsCourseFormValues = {
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
  status: LmsCourseStatus;
  visibility: LmsCourseVisibility;
  sequence_required: boolean;
  onboarding_recommended: boolean;
};

export type LmsCourseDetail = {
  course: LmsCourse;
  modules: Array<LmsCourseModule & { lessons: LmsLesson[] }>;
  quiz: LmsQuiz | null;
  progress: LmsUserProgress | null;
  certificate: LmsCertificate | null;
};

export type LmsDashboardData = {
  totalCourses: number;
  publishedCourses: number;
  assignedUsers: number;
  averageCompletion: number;
  mostAccessedCourses: Array<{ courseId: string; title: string; accessCount: number }>;
  highestDropOffCourses: Array<{ courseId: string; title: string; incompleteUsers: number }>;
  overdueTrainings: number;
  delayedUsers: number;
  departmentRanking: Array<{ departmentName: string; completionRate: number }>;
};

export type LmsAdminDashboardData = LmsDashboardData & {
  dueSoon: number;
  completionByStatus: Array<{ status: LmsProgressStatus; total: number }>;
  recentAssignments: LmsAssignmentExpanded[];
  recentCourses: LmsCourseWithCounts[];
};

export type LmsMyTrainingCard = {
  course: LmsCourse;
  progress: LmsUserProgress | null;
  assignment: LmsUserCourseVisibility | null;
  status: LmsProgressStatus;
};

export type LmsTeamTrainingRow = {
  user_id: string;
  full_name: string;
  department_name: string | null;
  course_id: string;
  course_title: string;
  status: LmsProgressStatus;
  progress_percent: number;
  due_date: string | null;
};

export type LmsReportRow = {
  user_name: string;
  department_name: string | null;
  company_name: string | null;
  course_title: string;
  category: string | null;
  status: LmsProgressStatus;
  progress_percent: number;
  due_date: string | null;
  completed_at: string | null;
  score: number | null;
};

export type LmsQuizQuestionWithOptions = LmsQuizQuestion & {
  options: LmsQuizOption[];
};

export type LmsQuizPayload = {
  quiz: LmsQuiz;
  questions: LmsQuizQuestionWithOptions[];
};

export type LmsAdminFilters = {
  search: string;
  status: string;
  category: string;
};

export type LmsReportsFilters = {
  periodFrom: string;
  periodTo: string;
  companyId: string;
  departmentId: string;
  role: string;
  courseId: string;
  status: string;
};

export type LmsAssignmentFormValues = {
  assignment_type: Extract<LmsAssignmentTargetType, "user" | "department" | "company" | "role">;
  target_id: string;
  course_id: string;
  learning_path_id: string;
  due_date: string;
  mandatory: boolean;
  expires_at: string;
};

export type LmsCourseEditorPayload = LmsCourseFormValues & {
  modules: Array<{
    id?: string;
    title: string;
    description: string;
    sort_order: number;
    lessons: Array<{
      id?: string;
      title: string;
      description: string;
      lesson_type: LmsLessonType;
      content_url: string;
      content_text: string;
      duration_minutes: number | null;
      sort_order: number;
      is_required: boolean;
      allow_preview: boolean;
      storage_bucket?: string | null;
      storage_path?: string | null;
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
      question_type: LmsQuizQuestionType;
      sort_order: number;
      options: Array<{
        id?: string;
        text: string;
        is_correct: boolean;
      }>;
    }>;
  } | null;
};

export type LmsAssignmentTargetOption = {
  id: string;
  label: string;
};

export type LmsAssignmentSupportData = {
  users: LmsAssignmentTargetOption[];
  departments: LmsAssignmentTargetOption[];
  companies: LmsAssignmentTargetOption[];
  roles: LmsAssignmentTargetOption[];
  courses: LmsAssignmentTargetOption[];
  learningPaths: LmsAssignmentTargetOption[];
};
