import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators, getOutstandingCustoms, getCreatorDriveLinks } from "@/lib/queries";
import OutstandingCustomsSection from "@/components/planner/OutstandingCustomsSection";

export default async function OutstandingCustomsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isStaff = isStaffRole(profile.role);

  if (!isStaff) {
    if (!profile.creator_id) {
      return <p className="text-sm text-muted">No creator profile is linked to your account yet.</p>;
    }
    const [customs, driveLinks] = await Promise.all([
      getOutstandingCustoms(profile.creator_id),
      getCreatorDriveLinks(profile.creator_id),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Outstanding Customs</h1>
        </div>
        <OutstandingCustomsSection
          creatorId={profile.creator_id}
          customs={customs}
          driveLink={driveLinks?.customs_drive_link ?? null}
          isStaff={false}
        />
      </div>
    );
  }

  const creators = (await getCreators()).filter((c) => !c.archived);
  const sections = await Promise.all(
    creators.map(async (creator) => {
      const [customs, driveLinks] = await Promise.all([
        getOutstandingCustoms(creator.id),
        getCreatorDriveLinks(creator.id),
      ]);
      return { creator, customs, driveLink: driveLinks?.customs_drive_link ?? null };
    })
  );
  const withOutstanding = sections.filter((s) => s.customs.some((c) => c.status === "outstanding"));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Outstanding Customs</h1>
        <p className="mt-1 text-sm text-muted">Across every creator.</p>
      </div>

      {withOutstanding.length === 0 && (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          Nothing outstanding right now.
        </div>
      )}

      {withOutstanding.map(({ creator, customs, driveLink }) => (
        <section
          key={creator.id}
          className="flex flex-col gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0"
        >
          <h2 className="text-base font-semibold">{creator.name}</h2>
          <OutstandingCustomsSection creatorId={creator.id} customs={customs} driveLink={driveLink} isStaff />
        </section>
      ))}
    </div>
  );
}
