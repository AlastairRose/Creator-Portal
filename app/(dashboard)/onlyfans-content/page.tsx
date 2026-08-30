import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators, getCreator, getOnlyfansRequests, getCreatorDriveLinks } from "@/lib/queries";
import OnlyfansContentSection from "@/components/planner/OnlyfansContentSection";

export default async function OnlyfansContentPage({
  searchParams,
}: {
  searchParams: Promise<{ creatorId?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isStaff = isStaffRole(profile.role);
  const { creatorId } = await searchParams;

  if (!isStaff) {
    if (!profile.creator_id) {
      return <p className="text-sm text-muted">No creator profile is linked to your account yet.</p>;
    }
    const [requests, driveLinks] = await Promise.all([
      getOnlyfansRequests(profile.creator_id),
      getCreatorDriveLinks(profile.creator_id),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">OnlyFans Content</h1>
          <p className="mt-1 text-sm text-muted">Highly requested items are always shown first.</p>
        </div>
        <OnlyfansContentSection
          creatorId={profile.creator_id}
          requests={requests}
          driveLink={driveLinks?.onlyfans_drive_link ?? null}
          isStaff={false}
        />
      </div>
    );
  }

  if (creatorId) {
    const creator = await getCreator(creatorId);
    if (!creator) return <p className="text-sm text-muted">Creator not found.</p>;
    const [requests, driveLinks] = await Promise.all([
      getOnlyfansRequests(creatorId),
      getCreatorDriveLinks(creatorId),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">OnlyFans Content — {creator.name}</h1>
          <p className="mt-1 text-sm text-muted">Highly requested items are always shown first.</p>
        </div>
        <OnlyfansContentSection
          creatorId={creatorId}
          requests={requests}
          driveLink={driveLinks?.onlyfans_drive_link ?? null}
          isStaff
        />
      </div>
    );
  }

  const creators = (await getCreators()).filter((c) => !c.archived);
  const sections = await Promise.all(
    creators.map(async (creator) => {
      const [requests, driveLinks] = await Promise.all([
        getOnlyfansRequests(creator.id),
        getCreatorDriveLinks(creator.id),
      ]);
      return { creator, requests, driveLink: driveLinks?.onlyfans_drive_link ?? null };
    })
  );
  const withRequests = sections.filter((s) => s.requests.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">OnlyFans Content</h1>
        <p className="mt-1 text-sm text-muted">
          Across every creator. Highly requested items are always shown first.
        </p>
      </div>

      {withRequests.length === 0 && (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          Nothing logged yet.
        </div>
      )}

      {withRequests.map(({ creator, requests, driveLink }) => (
        <section
          key={creator.id}
          className="flex flex-col gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0"
        >
          <h2 className="text-base font-semibold">{creator.name}</h2>
          <OnlyfansContentSection creatorId={creator.id} requests={requests} driveLink={driveLink} isStaff />
        </section>
      ))}
    </div>
  );
}
