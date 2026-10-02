"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createReport, type ReportFields } from "@/lib/actions/reports";
import { computeRevenueChangePercent } from "@/lib/reports";
import { getCurrentWeekStart } from "@/lib/weeks";
import type { ReportPeriodType } from "@/lib/types";

const textFieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

function defaultPeriodEnd(periodType: ReportPeriodType, periodStart: string): string {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(start);
  if (periodType === "weekly") {
    end.setUTCDate(end.getUTCDate() + 6);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
  }
  return end.toISOString().slice(0, 10);
}

export default function GenerateReportForm({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ReportFields>(() => {
    const periodStart = getCurrentWeekStart();
    return {
      period_type: "weekly",
      period_start: periodStart,
      period_end: defaultPeriodEnd("weekly", periodStart),
      total_revenue: null,
      agency_share: null,
      creator_share: null,
      last_month_revenue: null,
      went_well: null,
      can_improve: null,
      next_plan: null,
    };
  });
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);

  function set<K extends keyof ReportFields>(key: K, value: ReportFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const revenueChangePercent = computeRevenueChangePercent(fields.total_revenue, fields.last_month_revenue);

  function handlePeriodTypeChange(periodType: ReportPeriodType) {
    setFields((prev) => ({
      ...prev,
      period_type: periodType,
      period_end: defaultPeriodEnd(periodType, prev.period_start),
    }));
  }

  function handlePeriodStartChange(periodStart: string) {
    setFields((prev) => ({
      ...prev,
      period_start: periodStart,
      period_end: defaultPeriodEnd(prev.period_type, periodStart),
    }));
  }

  function handleGenerate() {
    startTransition(async () => {
      try {
        const id = await createReport(creatorId, fields, screenshotFiles);
        setError(null);
        router.push(`/reports/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't generate that report.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Generate a report</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Period</label>
          <select
            value={fields.period_type}
            onChange={(e) => handlePeriodTypeChange(e.target.value as ReportPeriodType)}
            disabled={isPending}
            className={textFieldClass}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Total Revenue</label>
          <input
            type="number"
            step="0.01"
            value={fields.total_revenue ?? ""}
            onChange={(e) => set("total_revenue", e.target.value ? Number(e.target.value) : null)}
            disabled={isPending}
            placeholder="e.g. 4200.00"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Agency Share</label>
          <input
            type="number"
            step="0.01"
            value={fields.agency_share ?? ""}
            onChange={(e) => set("agency_share", e.target.value ? Number(e.target.value) : null)}
            disabled={isPending}
            placeholder="e.g. 1680.00"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Creator Share</label>
          <input
            type="number"
            step="0.01"
            value={fields.creator_share ?? ""}
            onChange={(e) => set("creator_share", e.target.value ? Number(e.target.value) : null)}
            disabled={isPending}
            placeholder="e.g. 2520.00"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Last month&apos;s revenue</label>
          <input
            type="number"
            step="0.01"
            value={fields.last_month_revenue ?? ""}
            onChange={(e) => set("last_month_revenue", e.target.value ? Number(e.target.value) : null)}
            disabled={isPending}
            placeholder="e.g. 3800.00"
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">% change</label>
          <div className={`${textFieldClass} flex items-center border-transparent bg-transparent px-3 py-2 font-medium`}>
            {revenueChangePercent != null ? (
              <span className={revenueChangePercent >= 0 ? "text-success" : "text-danger"}>
                {revenueChangePercent > 0 ? "+" : ""}
                {revenueChangePercent}%
              </span>
            ) : (
              <span className="text-muted">Enter both revenue figures</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Start date</label>
          <input
            type="date"
            value={fields.period_start}
            onChange={(e) => handlePeriodStartChange(e.target.value)}
            disabled={isPending}
            className={textFieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">End date</label>
          <input
            type="date"
            value={fields.period_end}
            onChange={(e) => set("period_end", e.target.value)}
            disabled={isPending}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">What went well</label>
          <textarea
            value={fields.went_well ?? ""}
            onChange={(e) => set("went_well", e.target.value)}
            disabled={isPending}
            rows={2}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">What can be improved</label>
          <textarea
            value={fields.can_improve ?? ""}
            onChange={(e) => set("can_improve", e.target.value)}
            disabled={isPending}
            rows={2}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Next month&apos;s plan</label>
          <textarea
            value={fields.next_plan ?? ""}
            onChange={(e) => set("next_plan", e.target.value)}
            disabled={isPending}
            rows={2}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Screenshots</label>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isPending}
            onChange={(e) => setScreenshotFiles(Array.from(e.target.files ?? []))}
            className="w-full text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-white disabled:opacity-70"
          />
          {screenshotFiles.length > 0 && (
            <p className="text-xs text-muted">{screenshotFiles.length} file(s) selected.</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={isPending}
        onClick={handleGenerate}
        className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate report"}
      </button>
    </div>
  );
}
