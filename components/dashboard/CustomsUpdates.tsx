import Link from "next/link";
import DueStatusBadge from "@/components/planner/DueStatusBadge";
import { OUTSTANDING_CUSTOM_STATUS_LABELS, type OutstandingCustom } from "@/lib/types";

const NEW_FOR_MS = 48 * 3600e3;
const DONE_SHOWN_FOR_MS = 7 * 24 * 3600e3;

// The creator's open customs, newest-due first, plus anything finished in
// the last week, so the dashboard shows what's changed at a glance.
export default function CustomsUpdates({ customs, now }: { customs: OutstandingCustom[]; now: number }) {
  const open = customs
    .filter((c) => c.status === "outstanding" || c.status === "to_do_later")
    .sort((a, b) => (a.status === b.status ? a.requested_at.localeCompare(b.requested_at) : a.status === "outstanding" ? -1 : 1));
  const recentlyDone = customs
    .filter((c) => c.status === "uploaded" || c.status === "sent")
    .filter((c) => {
      const at = c.completed_at ?? c.uploaded_at;
      return at && now - new Date(at).getTime() < DONE_SHOWN_FOR_MS;
    })
    .sort((a, b) => (b.completed_at ?? b.uploaded_at ?? "").localeCompare(a.completed_at ?? a.uploaded_at ?? ""));

  return (
    <div className="flex flex-col gap-3">
      {open.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">No custom requests to do right now.</div>
      ) : (
        open.map((c) => (
          <Link
            key={c.id}
            href="/outstanding-customs"
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 text-sm font-medium">{c.description || c.custom_or_call || "Custom request"}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {now - new Date(c.requested_at).getTime() < NEW_FOR_MS && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">New</span>
                )}
                {c.status === "to_do_later" ? (
                  <span className="rounded-full bg-surface-raised px-2.5 py-1 text-xs text-muted">To do later</span>
                ) : (
                  <DueStatusBadge custom={c} />
                )}
              </span>
            </div>
            <span className="text-xs text-muted">
              {[c.custom_or_call, c.length_of_video_or_call].filter(Boolean).join(" · ") || "Tap to see the details"}
            </span>
          </Link>
        ))
      )}
      {recentlyDone.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Done this week</h3>
          {recentlyDone.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5 text-sm">
              <span className="line-clamp-1 text-muted">{c.description || c.custom_or_call || "Custom request"}</span>
              <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                {OUTSTANDING_CUSTOM_STATUS_LABELS[c.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
