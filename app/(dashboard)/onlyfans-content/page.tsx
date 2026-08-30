import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators, getOnlyfansRequests, getCreatorDriveLinks } from "@/lib/queries";
import OnlyfansContentSection from "@/components/planner/OnlyfansContentSection";
import type { OnlyfansContentRequestWithItems } from "@/lib/types";

function highlyRequestedOpen(requests: OnlyfansContentRequestWithItems[]) {
  return requests.filter((r) => r.urgency === "highly_requested" && r.status === "open");
}

export default async function OnlyfansContentPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isStaff = isStaffRole(profile.role);

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
          <h1 className="text-xl font-semibold tracking-tight">Highly Requested OnlyFans Content</h1>
        </div>
        <OnlyfansContentSection
          creatorId={profile.creator_id}
          requests={highlyRequestedOpen(requests)}
          driveLink={driveLinks?.onlyfans_drive_link ?? null}
          isStaff={false}
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
      return { creator, requests: highlyRequestedOpen(requests), driveLink: driveLinks?.onlyfans_drive_link ?? null };
    })
  );
  const withRequests = sections.filter((s) => s.requests.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Highly Requested OnlyFans Content</h1>
        <p className="mt-1 text-sm text-muted">Across every creator.</p>
      </div>

      {withRequests.length === 0 && (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          Nothing highly requested right now.
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
