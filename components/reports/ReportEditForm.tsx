"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReport, removeReportScreenshot, updateReport, type ReportFields } from "@/lib/actions/reports";
import type { Report } from "@/lib/types";
import ReportScreenshotThumbnail from "./ReportScreenshotThumbnail";

const textFieldClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-70";

export default function ReportEditForm({ report }: { report: Report }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<ReportFields>({
    period_type: report.period_type,
    period_start: report.period_start,
    period_end: report.period_end,
    total_revenue: report.total_revenue,
    agency_share: report.agency_share,
    creator_share: report.creator_share,
    went_well: report.went_well,
    can_improve: report.can_improve,
    next_plan: report.next_plan,
  });

  function set<K extends keyof ReportFields>(key: K, value: ReportFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function save(newScreenshotFiles?: File[] | null) {
    startTransition(async () => {
      await updateReport(report.id, fields, newScreenshotFiles);
      router.refresh();
    });
  }

  function removeScreenshot(path: string) {
    startTransition(async () => {
      await removeReportScreenshot(report.id, path);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this report?")) return;
    startTransition(async () => {
      await deleteReport(report.id);
      router.push("/reports");
    });
  }

  return (
    <div className="no-print flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Edit report</h2>
        <button
          type="button"
          disabled={isPending}
          onClick={remove}
          className="text-xs text-danger hover:underline disabled:opacity-50"
        >
          Delete report
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Total Revenue</label>
          <input
            type="number"
            step="0.01"
            value={fields.total_revenue ?? ""}
            onChange={(e) => set("total_revenue", e.target.value ? Number(e.target.value) : null)}
            onBlur={() => save()}
            disabled={isPending}
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
            onBlur={() => save()}
            disabled={isPending}
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
            onBlur={() => save()}
            disabled={isPending}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">What went well</label>
          <textarea
            value={fields.went_well ?? ""}
            onChange={(e) => set("went_well", e.target.value)}
            onBlur={() => save()}
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
            onBlur={() => save()}
            disabled={isPending}
            rows={2}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Next plan</label>
          <textarea
            value={fields.next_plan ?? ""}
            onChange={(e) => set("next_plan", e.target.value)}
            onBlur={() => save()}
            disabled={isPending}
            rows={2}
            className={textFieldClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Screenshots</label>
          {report.screenshot_paths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.screenshot_paths.map((path) => (
                <div key={path} className="relative">
                  <ReportScreenshotThumbnail path={path} />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => removeScreenshot(path)}
                    aria-label="Remove screenshot"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isPending}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) save(files);
              e.target.value = "";
            }}
            className="w-full text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-white disabled:opacity-70"
          />
        </div>
      </div>
    </div>
  );
}
