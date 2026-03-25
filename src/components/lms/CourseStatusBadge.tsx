import { getCourseStatusLabel, getProgressStatusLabel } from "@/lib/lms/utils";
import type { LmsCourseStatus, LmsProgressStatus } from "@/lib/lms/types";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CourseStatusBadge({
  status,
  variant = "progress",
}: {
  status: LmsCourseStatus | LmsProgressStatus;
  variant?: "course" | "progress";
}) {
  const map =
    variant === "course"
      ? {
          draft: "bg-amber-50 text-amber-700",
          published: "bg-emerald-50 text-emerald-700",
          archived: "bg-slate-100 text-slate-600",
        }
      : {
          not_started: "bg-slate-100 text-slate-600",
          in_progress: "bg-sky-50 text-sky-700",
          completed: "bg-emerald-50 text-emerald-700",
          overdue: "bg-rose-50 text-rose-700",
        };

  const label = variant === "course" ? getCourseStatusLabel(status as LmsCourseStatus) : getProgressStatusLabel(status as LmsProgressStatus);

  return <span className={cx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", map[status as keyof typeof map])}>{label}</span>;
}
