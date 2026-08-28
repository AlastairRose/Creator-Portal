import { formatWeekLabel } from "@/lib/weeks";
import type { Report } from "@/lib/types";
import PrintButton from "./PrintButton";

export default function ReportDocument({
  report,
  creatorName,
  percentReelsCompleted,
  percentRevenueChange,
}: {
  report: Report;
  creatorName: string;
  percentReelsCompleted: number;
  percentRevenueChange: number | null;
}) {
  const periodLabel =
    report.period_type === "weekly"
      ? formatWeekLabel(report.period_start)
      : `${report.period_start} – ${report.period_end}`;

  return (
    <div className="print-document mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-border bg-surface p-8">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          {report.period_type === "weekly" ? "Weekly report" : "Monthly report"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{creatorName}</h1>
        <p className="mt-1 text-sm text-muted">{periodLabel}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-border py-6">
        <Stat label="Revenue" value={report.revenue != null ? `$${report.revenue}` : "—"} />
        <Stat
          label="Revenue change"
          value={percentRevenueChange != null ? `${percentRevenueChange > 0 ? "+" : ""}${percentRevenueChange}%` : "—"}
        />
        <Stat label="Reels completed" value={`${percentReelsCompleted}%`} />
      </div>

      <Section title="What went well" body={report.went_well} />
      <Section title="What can be improved" body={report.can_improve} />
      <Section title="Next plan" body={report.next_plan} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{body || "—"}</p>
    </div>
  );
}
