import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getReport, getCreator, getReelsForPeriod, getPreviousReport } from "@/lib/queries";
import { computeReelsCompletedPercent, computeRevenueChangePercent } from "@/lib/reports";
import ReportDocument from "@/components/reports/ReportDocument";
import ReportEditForm from "@/components/reports/ReportEditForm";

export default async function ReportViewPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { reportId } = await params;
  const report = await getReport(reportId);
  if (!report) {
    return <p className="text-sm text-muted">Report not found.</p>;
  }

  const [creator, reels, previousReport] = await Promise.all([
    getCreator(report.creator_id),
    getReelsForPeriod(report.creator_id, report.period_start, report.period_end),
    getPreviousReport(report.creator_id, report.period_type, report.period_start),
  ]);

  const percentReelsCompleted = computeReelsCompletedPercent(reels);
  const percentRevenueChange = computeRevenueChangePercent(report.revenue, previousReport?.revenue ?? null);
  const isStaff = isStaffRole(profile.role);

  return (
    <div className="flex flex-col gap-6">
      {isStaff && <ReportEditForm report={report} />}
      <ReportDocument
        report={report}
        creatorName={creator?.name ?? "Unknown creator"}
        percentReelsCompleted={percentReelsCompleted}
        percentRevenueChange={percentRevenueChange}
      />
    </div>
  );
}
