import { formatWeekLabel } from "@/lib/weeks";
import type { DashboardCreatorRow, DashboardWeekStats } from "@/lib/types";

function percentClass(percent: number): string {
  if (percent >= 80) return "text-success";
  if (percent >= 40) return "text-orange";
  return "text-danger";
}

function WeekCell({ stats, isCurrent }: { stats: DashboardWeekStats; isCurrent: boolean }) {
  if (stats.planned === 0) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div>
      <div className={`font-medium ${percentClass(stats.percentComplete)}`}>
        {stats.uploaded}/{stats.planned} · {stats.percentComplete}%
        {isCurrent && <span className="ml-1 text-xs font-normal text-muted">(so far)</span>}
      </div>
      <div className="text-xs text-muted">{stats.posted} posted</div>
    </div>
  );
}

export default function WeeklyScoreTable({ rows }: { rows: DashboardCreatorRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
        No creators yet.
      </div>
    );
  }

  const weekDates = rows[0].weeks.map((w) => w.weekStartDate);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Creator</th>
            {weekDates.map((weekStartDate, i) => (
              <th key={weekStartDate} className="px-4 py-3 font-medium">
                {formatWeekLabel(weekStartDate)}
                {i === weekDates.length - 1 && (
                  <span className="ml-1 normal-case text-accent">(current)</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.creator.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{row.creator.name}</td>
              {row.weeks.map((stats, i) => (
                <td key={stats.weekStartDate} className="px-4 py-3">
                  <WeekCell stats={stats} isCurrent={i === row.weeks.length - 1} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
