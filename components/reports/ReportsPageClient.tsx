"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Creator, Report } from "@/lib/types";
import GenerateReportForm from "./GenerateReportForm";

export default function ReportsPageClient({
  isStaff,
  creators,
  selectedCreatorId,
  reports,
}: {
  isStaff: boolean;
  creators: Creator[];
  selectedCreatorId: string | null;
  reports: Report[];
}) {
  const router = useRouter();

  function handleCreatorChange(creatorId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("creatorId", creatorId);
    router.push(`${url.pathname}${url.search}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          {isStaff
            ? "Generate and share weekly/monthly performance reports per creator."
            : "Your weekly and monthly performance reports."}
        </p>
      </div>

      {isStaff && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4">
          <label className="text-xs font-medium text-muted">Creator</label>
          <select
            value={selectedCreatorId ?? ""}
            onChange={(e) => handleCreatorChange(e.target.value)}
            className="w-64 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {report.period_start} – {report.period_end}
                </td>
                <td className="px-4 py-3 text-muted capitalize">{report.period_type}</td>
                <td className="px-4 py-3 text-muted">
                  {report.revenue != null ? `$${report.revenue}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/reports/${report.id}`} className="text-xs text-accent hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No reports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isStaff && selectedCreatorId && <GenerateReportForm creatorId={selectedCreatorId} />}
    </div>
  );
}
