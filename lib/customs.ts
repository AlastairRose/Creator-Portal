import type { CustomUrgency, OutstandingCustom } from "@/lib/types";

const DUE_HOURS = 72; // target turnaround
const OVERDUE_HOURS = 5 * 24; // hard max

// Always computed from the precise requested_at timestamp, not the due_by
// field — due_by is a DATE column (day precision only, shown to staff as a
// reference/manual-override field), so basing the exact 72h/5d trigger on it
// would drift by up to half a day depending on time of submission. This way
// "DUE" flips at exactly 72 hours elapsed, "OVERDUE" at exactly 5 days.
export function computeCustomUrgency(
  custom: Pick<OutstandingCustom, "status" | "requested_at">
): CustomUrgency | null {
  if (custom.status !== "outstanding") return null;

  const requestedAt = new Date(custom.requested_at).getTime();
  const hoursElapsed = (Date.now() - requestedAt) / (1000 * 60 * 60);

  if (hoursElapsed >= OVERDUE_HOURS) return "overdue";
  if (hoursElapsed >= DUE_HOURS) return "due";
  return "on_track";
}

// requested_at isn't known yet at the moment a new custom is created (the DB
// fills it via default now()), so this takes it as an explicit param rather
// than reading it off a row. Day-precision only (due_by is a DATE column) —
// used for the staff-facing reference field, not for the urgency badge.
export function defaultDueBy(requestedAt: Date = new Date()): string {
  const due = new Date(requestedAt.getTime() + DUE_HOURS * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

export const CUSTOM_URGENCY_LABELS: Record<CustomUrgency, string> = {
  on_track: "On track",
  due: "Due",
  overdue: "Overdue",
};
