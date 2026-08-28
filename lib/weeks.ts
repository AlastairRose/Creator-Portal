// Business week starts Monday. All dates are handled as plain YYYY-MM-DD
// strings (matching Postgres `date` columns) to avoid timezone drift.

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return toDateOnly(d);
}

export function getCurrentWeekStart(): string {
  return getWeekStart(new Date());
}

export function getNextWeekStart(): string {
  const current = new Date(`${getCurrentWeekStart()}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + 7);
  return toDateOnly(current);
}

// Returns week_start_date strings oldest-first, e.g. [3-weeks-ago, 2-weeks-ago, last-week, current].
export function listRecentWeeks(count: number): string[] {
  const current = getCurrentWeekStart();
  const currentDate = new Date(`${current}T00:00:00Z`);
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(currentDate);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(toDateOnly(d));
  }
  return weeks;
}

export function formatWeekLabel(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}
