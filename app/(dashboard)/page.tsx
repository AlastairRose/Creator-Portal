import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import {
  getCreators,
  getDashboardRows,
  getContentWeek,
  getReelsForWeek,
  getOutstandingCustoms,
  getOnlyfansRequests,
} from "@/lib/queries";
import { getCurrentWeekStart } from "@/lib/weeks";
import WeeklyScoreTable from "@/components/dashboard/WeeklyScoreTable";
import QuickSummaryCards from "@/components/dashboard/QuickSummaryCards";
import StaffQuickSummaryCards from "@/components/dashboard/StaffQuickSummaryCards";

async function getCreatorSummaryCounts(creatorId: string) {
  const weekStartDate = getCurrentWeekStart();
  const [contentWeek, customs, onlyfansRequests] = await Promise.all([
    getContentWeek(creatorId, weekStartDate),
    getOutstandingCustoms(creatorId),
    getOnlyfansRequests(creatorId),
  ]);
  const reels = contentWeek ? await getReelsForWeek(contentWeek.id) : [];

  return {
    reelsToFilmCount: reels.filter((r) => r.status === "planned").length,
    outstandingCustomsCount: customs.filter((c) => c.status === "outstanding").length,
    highlyRequestedCount: onlyfansRequests.filter(
      (r) => r.urgency === "highly_requested" && r.status === "open"
    ).length,
  };
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (isStaffRole(profile.role)) {
    const creators = (await getCreators()).filter((c) => !c.archived);
    const [rows, counts] = await Promise.all([
      getDashboardRows(creators.map((c) => c.id)),
      Promise.all(creators.map((c) => getCreatorSummaryCounts(c.id))),
    ]);

    const countsByCreatorId = Object.fromEntries(creators.map((c, i) => [c.id, counts[i]]));

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Weekly performance across every creator — last 3 weeks plus the current week.
          </p>
        </div>
        <StaffQuickSummaryCards creators={creators} countsByCreatorId={countsByCreatorId} />
        <WeeklyScoreTable rows={rows} />
      </div>
    );
  }

  if (!profile.creator_id) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">No creator profile is linked to your account yet.</p>
      </div>
    );
  }

  const counts = await getCreatorSummaryCounts(profile.creator_id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">What needs your attention this week.</p>
      </div>
      <QuickSummaryCards {...counts} />
    </div>
  );
}
