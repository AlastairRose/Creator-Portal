import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators, getCreator, getReports } from "@/lib/queries";
import ReportsPageClient from "@/components/reports/ReportsPageClient";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ creatorId?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isStaff = isStaffRole(profile.role);
  const params = await searchParams;

  if (isStaff) {
    const creators = await getCreators();
    const selectedCreatorId = params.creatorId ?? creators[0]?.id ?? null;
    const reports = selectedCreatorId ? await getReports(selectedCreatorId) : [];

    return (
      <ReportsPageClient
        isStaff
        creators={creators}
        selectedCreatorId={selectedCreatorId}
        reports={reports}
      />
    );
  }

  if (!profile.creator_id) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted">No creator profile is linked to your account yet.</p>
      </div>
    );
  }

  const creator = await getCreator(profile.creator_id);
  const reports = await getReports(profile.creator_id);

  return (
    <ReportsPageClient
      isStaff={false}
      creators={creator ? [creator] : []}
      selectedCreatorId={profile.creator_id}
      reports={reports}
    />
  );
}
