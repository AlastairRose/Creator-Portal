import { computeCustomUrgency, CUSTOM_URGENCY_LABELS } from "@/lib/customs";
import type { OutstandingCustom } from "@/lib/types";

const URGENCY_BADGE_CLASS = {
  on_track: "bg-success/15 text-success",
  due: "bg-orange/15 text-orange",
  overdue: "bg-danger/15 text-danger",
} as const;

export default function DueStatusBadge({
  custom,
}: {
  custom: Pick<OutstandingCustom, "status" | "requested_at">;
}) {
  const urgency = computeCustomUrgency(custom);
  if (!urgency) return <span className="text-xs text-muted">—</span>;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${URGENCY_BADGE_CLASS[urgency]}`}>
      {CUSTOM_URGENCY_LABELS[urgency]}
    </span>
  );
}
