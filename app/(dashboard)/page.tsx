import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators, getDashboardRows } from "@/lib/queries";
import WeeklyScoreTable from "@/components/dashboard/WeeklyScoreTable";
import CreatorWeekCards from "@/components/dashboard/CreatorWeekCards";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  if (isStaffRole(profile.role)) {
    const creators = await getCreators();
    const rows = await getDashboardRows(creators.map((c) => c.id));

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Weekly performance across every creator — last 3 weeks plus the current week.
          </p>
        </div>
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

  const rows = await getDashboardRows([profile.creator_id]);
  const row = rows[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Your weekly progress — last 3 weeks plus this week.</p>
      </div>
      {row && <CreatorWeekCards row={row} />}
    </div>
  );
}
