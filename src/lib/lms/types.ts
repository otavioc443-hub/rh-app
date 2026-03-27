export const LMS_COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const LMS_VISIBILITY = ["publico_interno", "restrito"] as const;
export const LMS_LESSON_TYPES = ["video", "pdf", "arquivo", "link", "texto", "avaliacao"] as const;
export const LMS_ASSIGNMENT_TARGET_TYPES = ["user", "department", "company", "role", "learning_path"] as const;
export const LMS_ASSIGNMENT_STATUSES = ["active", "paused", "expired", "cancelled"] as const;
export const LMS_PROGRESS_STATUSES = ["not_started", "in_progress", "completed", "overdue"] as const;
export const LMS_QUIZ_QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_text",
  "essay",
  "image_choice",
] as const;
export const LMS_DISCUSSION_STATUSES = ["pending", "answered", "resolved"] as const;

export type LmsCourseStatus = (typeof LMS_COURSE_STATUSES)[number];
export type LmsCourseVisibility = (typeof LMS_VISIBILITY)[number];
export type LmsLessonType = (typeof LMS_LESSON_TYPES)[number];
export type LmsAssignmentTargetType = (typeof LMS_ASSIGNMENT_TARGET_TYPES)[number];
export type LmsAssignmentStatus = (typeof LMS_ASSIGNMENT_STATUSES)[number];
export type LmsProgressStatus = (typeof LMS_PROGRESS_STATUSES)[number];
export type LmsQuizQuestionType = (typeof LMS_QUIZ_QUESTION_TYPES)[number];
export type LmsDiscussionStatus = (typeof LMS_DISCUSSION_STATUSES)[number];

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
  recurring_every_days?: number | null;
  auto_reassign_on_expiry?: boolean;
  assignment_group?: string | null;
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
  instructions?: string | null;
  passing_score: number;
  max_attempts: number | null;
  randomize_questions: boolean;
  show_score_on_submit?: boolean;
  show_correct_answers?: boolean;
  created_at: string;
};

export type LmsQuizQuestion = {
  id: string;
  quiz_id: string;
  statement: string;
  question_type: LmsQuizQuestionType;
  help_text?: string | null;
  image_url?: string | null;
  accepted_answers?: string[] | null;
  requires_manual_review?: boolean;
  sort_order: number;
};

export type LmsQuizOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  image_url?: string | null;
};

export type LmsQuizAttempt = {
  id: string;
  quiz_id: string;
  course_id: string | null;
  user_id: string;
  score: number;
  passed: boolean;
  attempt_number: number;
  review_status?: "pending_review" | "reviewed" | "auto_graded";
  reviewer_comment?: string | null;
  reviewed_score?: number | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
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

export type LmsQuizReviewRow = {
  attempt: LmsQuizAttempt;
  quiz: LmsQuiz;
  course_title: string;
  lesson_title: string | null;
  user_name: string;
  user_role: string | null;
  reviewer_name: string | null;
  questions: Array<
    LmsQuizQuestionWithOptions & {
      submitted_answers: Array<{
        option_id: string | null;
        answer_text: string | null;
        is_correct: boolean;
      }>;
    }
  >;
};

export type LmsQuestionBankOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  image_url?: string | null;
};

export type LmsQuestionBankItem = {
  id: string;
  company_id: string | null;
  created_by: string | null;
  title: string;
  statement: string;
  help_text?: string | null;
  question_type: LmsQuizQuestionType;
  image_url?: string | null;
  accepted_answers?: string[] | null;
  requires_manual_review?: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  usage_count?: number;
  options: LmsQuestionBankOption[];
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

export type LmsLessonDiscussion = {
  id: string;
  company_id: string | null;
  course_id: string;
  lesson_id: string;
  user_id: string;
  message: string;
  created_at: string;
  status?: LmsDiscussionStatus;
  admin_response?: string | null;
  responded_at?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  author_name?: string | null;
  author_role?: string | null;
  responder_name?: string | null;
};

export type LmsLessonDiscussionAdminRow = LmsLessonDiscussion & {
  course_title: string;
  lesson_title: string;
};

export type LmsWeeklyDigest = {
  periodLabel: string;
  completedThisWeek: number;
  dueSoon: number;
  overdue: number;
  notStarted: number;
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
  attentionItems: LmsTrainingAttentionItem[];
  gamification: LmsGamificationAdminData;
  weeklyDigest: LmsWeeklyDigest;
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
  mandatory: boolean;
  assignment_type: LmsAssignmentTargetType;
  days_until_due: number | null;
  urgency: "overdue" | "due_soon" | "on_track" | "none";
};

export type LmsTrainingAttentionItem = {
  user_id: string;
  full_name: string;
  department_name: string | null;
  course_id: string;
  course_title: string;
  due_date: string | null;
  days_until_due: number | null;
  status: LmsProgressStatus;
  progress_percent: number;
  urgency: "overdue" | "due_soon";
};

export type LmsTeamTrainingsData = {
  rows: LmsTeamTrainingRow[];
  summary: {
    totalMembers: number;
    totalAssignments: number;
    overdue: number;
    dueSoon: number;
    completed: number;
    averageCompletion: number;
  };
  urgentRows: LmsTeamTrainingRow[];
  weeklyDigest: LmsWeeklyDigest;
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
  recurring_every_days: string;
  auto_reassign_on_expiry: boolean;
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
          question_type: LmsQuizQuestionType;
          sort_order: number;
          image_url?: string | null;
          accepted_answers?: string[];
          requires_manual_review?: boolean;
          options: Array<{
            id?: string;
            text: string;
            is_correct: boolean;
            image_url?: string | null;
          }>;
        }>;
      } | null;
    }>;
  }>;
  quiz?: {
    id?: string;
    title: string;
    instructions?: string;
    passing_score: number;
    max_attempts: number | null;
    randomize_questions: boolean;
    show_score_on_submit?: boolean;
    show_correct_answers?: boolean;
    questions: Array<{
      id?: string;
      statement: string;
      help_text?: string;
      question_type: LmsQuizQuestionType;
      sort_order: number;
      image_url?: string | null;
      accepted_answers?: string[];
      requires_manual_review?: boolean;
      options: Array<{
        id?: string;
        text: string;
        is_correct: boolean;
        image_url?: string | null;
      }>;
    }>;
  } | null;
};

export type LmsAssignmentTargetOption = {
  id: string;
  label: string;
};

export type LmsMediaLibraryItem = {
  id: string;
  name: string;
  bucket: "lms-thumbnails" | "lms-banners" | "lms-materials" | "lms-videos";
  path: string;
  storageRef: string;
  signedUrl: string | null;
  createdAt: string | null;
};

export type LmsAssignmentSupportData = {
  users: LmsAssignmentTargetOption[];
  departments: LmsAssignmentTargetOption[];
  companies: LmsAssignmentTargetOption[];
  roles: LmsAssignmentTargetOption[];
  courses: LmsAssignmentTargetOption[];
  learningPaths: LmsAssignmentTargetOption[];
};

export const LMS_CHALLENGE_TYPES = ["daily", "weekly", "seasonal", "battle"] as const;
export const LMS_CHALLENGE_STATUSES = ["draft", "active", "completed", "archived"] as const;
export const LMS_GAME_SESSION_TYPES = ["quiz_rush", "battle", "challenge", "season"] as const;
export const LMS_GAME_SESSION_STATUSES = ["scheduled", "live", "finished", "cancelled"] as const;

export type LmsChallengeType = (typeof LMS_CHALLENGE_TYPES)[number];
export type LmsChallengeStatus = (typeof LMS_CHALLENGE_STATUSES)[number];
export type LmsGameSessionType = (typeof LMS_GAME_SESSION_TYPES)[number];
export type LmsGameSessionStatus = (typeof LMS_GAME_SESSION_STATUSES)[number];

export type LmsUserXp = {
  id: string;
  user_id: string;
  company_id: string | null;
  department_id: string | null;
  total_xp: number;
  level: number;
  season_xp: number;
  updated_at: string;
  created_at: string;
};

export type LmsBadge = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  points_reward: number;
  criteria_key: string | null;
  is_active: boolean;
  created_at: string;
};

export type LmsUserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  season_key: string | null;
  badge?: LmsBadge | null;
};

export type LmsChallenge = {
  id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  challenge_type: LmsChallengeType;
  status: LmsChallengeStatus;
  target_metric: string | null;
  target_value: number | null;
  xp_reward: number;
  reward_label: string | null;
  starts_at: string;
  ends_at: string;
  created_by: string | null;
  created_at: string;
};

export type LmsChallengeParticipant = {
  id: string;
  challenge_id: string;
  user_id: string;
  progress_value: number;
  completed: boolean;
  completed_at: string | null;
  rank_position: number | null;
  created_at: string;
  updated_at: string;
};

export type LmsGameSession = {
  id: string;
  company_id: string | null;
  session_type: LmsGameSessionType;
  status: LmsGameSessionStatus;
  title: string;
  description: string | null;
  course_id: string | null;
  quiz_id: string | null;
  created_by: string | null;
  started_at: string | null;
  ended_at: string | null;
  max_participants: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type LmsLeaderboardRow = {
  user_id: string;
  full_name: string;
  department_name: string | null;
  rank: number;
  xp: number;
  level: number;
  badges: number;
  streak: number;
};

export type LmsUserStreak = {
  id: string;
  user_id: string;
  current_streak: number;
  best_streak: number;
  last_activity_on: string | null;
  updated_at: string;
};

export type LmsRewardRule = {
  id: string;
  company_id: string | null;
  title: string;
  action_key: string;
  xp_reward: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type LmsGamificationOverview = {
  xp: LmsUserXp | null;
  streak: LmsUserStreak | null;
  badges: LmsUserBadge[];
  activeChallenges: Array<LmsChallenge & { participant: LmsChallengeParticipant | null }>;
  leaderboard: LmsLeaderboardRow[];
  battles: LmsGameSession[];
  seasonLabel: string;
  nextLevelXp: number;
  seasonCampaign: LmsSeasonCampaign;
};

export type LmsGamificationAdminData = {
  totalXpDistributed: number;
  activeLearners: number;
  activeChallenges: number;
  averageStreak: number;
  topDepartments: Array<{ departmentName: string; xp: number; completionRate: number }>;
  topBadges: Array<{ title: string; total: number }>;
  seasonLabel: string;
  leaderboard: LmsLeaderboardRow[];
  seasonCampaign: LmsSeasonCampaign;
};

export type LmsSeasonGoal = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  completionPercent: number;
};

export type LmsSeasonCampaign = {
  seasonLabel: string;
  missionTitle: string;
  missionDescription: string;
  totalChallenges: number;
  completedChallenges: number;
  activeBattleCount: number;
  totalXp: number;
  streakDays: number;
  goals: LmsSeasonGoal[];
};
