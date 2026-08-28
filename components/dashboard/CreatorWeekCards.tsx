import { formatWeekLabel } from "@/lib/weeks";
import type { DashboardCreatorRow } from "@/lib/types";

function percentClass(percent: number): string {
  if (percent >= 80) return "text-success";
  if (percent >= 40) return "text-orange";
  return "text-danger";
}

export default function CreatorWeekCards({ row }: { row: DashboardCreatorRow }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {row.weeks.map((stats, i) => {
        const isCurrent = i === row.weeks.length - 1;
        return (
          <div
            key={stats.weekStartDate}
            className={`flex flex-col gap-3 rounded-lg border p-4 ${
              isCurrent ? "border-accent bg-accent/5" : "border-border bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{formatWeekLabel(stats.weekStartDate)}</span>
              {isCurrent && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                  Current
                </span>
              )}
            </div>
            <div className={`text-2xl font-semibold ${percentClass(stats.percentComplete)}`}>
              {stats.percentComplete}%
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
              <div>
                <dt className="text-foreground font-medium">{stats.planned}</dt>
                <dd>Planned</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">{stats.uploaded}</dt>
                <dd>Uploaded</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">{stats.posted}</dt>
                <dd>Posted</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}
