"use client";

import { formatWeekLabel } from "@/lib/weeks";

// Always steps by exactly 7 days, so starting from a Monday keeps every
// value a Monday — no free-form date picker where an arbitrary weekday
// could get selected.
export default function WeekPicker({
  weekStartDate,
  onChange,
}: {
  weekStartDate: string;
  onChange: (weekStartDate: string) => void;
}) {
  function shift(days: number) {
    const d = new Date(`${weekStartDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    onChange(d.toISOString().slice(0, 10));
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => shift(-7)}
        aria-label="Previous week"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:text-foreground"
      >
        ‹
      </button>
      <span className="min-w-[130px] text-center text-sm">{formatWeekLabel(weekStartDate)}</span>
      <button
        type="button"
        onClick={() => shift(7)}
        aria-label="Next week"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:text-foreground"
      >
        ›
      </button>
    </div>
  );
}
