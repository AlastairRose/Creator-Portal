import type { CustomUrgency, OutstandingCustom } from "@/lib/types";

const DUE_SOON_HOURS = 72; // target turnaround
const OVERDUE_HOURS = 5 * 24; // hard max
const DUE_BY_WARNING_HOURS = 24; // "due soon" window before an explicit due_by

// Urgency for the "outstanding" bucket only — once a custom moves past that
// (to_do_later/uploaded/sent) it no longer has an active urgency to show.
// If staff have set an explicit `due_by` date (matching the Airtable field),
// that takes priority; otherwise it falls back to the 72h/5d rule computed
// from requested_at, so the badge is never blank just because no due date
// was set.
export function computeCustomUrgency(
  custom: Pick<OutstandingCustom, "status" | "requested_at" | "due_by">
): CustomUrgency | null {
  if (custom.status !== "outstanding") return null;

  if (custom.due_by) {
    const dueBy = new Date(`${custom.due_by}T23:59:59`).getTime();
    const hoursUntilDue = (dueBy - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDue < 0) return "overdue";
    if (hoursUntilDue <= DUE_BY_WARNING_HOURS) return "due_soon";
    return "on_track";
  }

  const requestedAt = new Date(custom.requested_at).getTime();
  const hoursElapsed = (Date.now() - requestedAt) / (1000 * 60 * 60);

  if (hoursElapsed >= OVERDUE_HOURS) return "overdue";
  if (hoursElapsed >= DUE_SOON_HOURS) return "due_soon";
  return "on_track";
}

export const CUSTOM_URGENCY_LABELS: Record<CustomUrgency, string> = {
  on_track: "On track",
  due_soon: "Due soon",
  overdue: "Overdue",
};
