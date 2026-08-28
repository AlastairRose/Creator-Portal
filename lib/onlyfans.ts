import type { OnlyfansContentRequest, OnlyfansDueTag } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const TARGET_DAYS: Record<"highly_requested" | "complete_when_possible", number> = {
  highly_requested: 7,
  complete_when_possible: 14,
};

// The due tag is never stored — always computed live from urgency +
// urgency_set_at (the last time urgency was (re)set, not necessarily row
// creation), so escalating something to "Highly Requested" gives it a fresh
// 7-day countdown from that moment rather than treating old requests as
// instantly overdue.
export function computeOnlyfansDueTag(
  request: Pick<OnlyfansContentRequest, "status" | "urgency" | "urgency_set_at">
): OnlyfansDueTag | null {
  if (request.status !== "open") return null;
  if (request.urgency === "not_required") return null;

  const targetDays = TARGET_DAYS[request.urgency];
  const dueAt = new Date(request.urgency_set_at).getTime() + targetDays * DAY_MS;
  const daysUntilDue = Math.ceil((dueAt - Date.now()) / DAY_MS);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due_today";
  if (daysUntilDue <= 3) return "due_in_3_days";
  if (daysUntilDue <= 7) return "due_this_week";
  return "due_in_2_weeks";
}
