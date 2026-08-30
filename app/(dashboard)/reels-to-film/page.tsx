import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { getCreators, getContentWeek, getReelsForWeek } from "@/lib/queries";
import { getCurrentWeekStart } from "@/lib/weeks";
import ReelsToFilmSection from "@/components/planner/ReelsToFilmSection";
import DriveUploadButton from "@/components/shared/DriveUploadButton";

export default async function ReelsToFilmPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const weekStartDate = getCurrentWeekStart();
  const isStaff = isStaffRole(profile.role);

  if (!isStaff) {
    if (!profile.creator_id) {
      return <p className="text-sm text-muted">No creator profile is linked to your account yet.</p>;
    }
    const contentWeek = await getContentWeek(profile.creator_id, weekStartDate);
    const reels = contentWeek ? await getReelsForWeek(contentWeek.id) : [];

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reels to Film</h1>
          <p className="mt-1 text-sm text-muted">This week&apos;s planned reels.</p>
        </div>
        {contentWeek?.drive_link && <DriveUploadButton href={contentWeek.drive_link} label="Upload Reels Here" />}
        <ReelsToFilmSection reels={reels} isStaff={false} />
      </div>
    );
  }

  const creators = (await getCreators()).filter((c) => !c.archived);
  const sections = await Promise.all(
    creators.map(async (creator) => {
      const contentWeek = await getContentWeek(creator.id, weekStartDate);
      const reels = contentWeek ? await getReelsForWeek(contentWeek.id) : [];
      return { creator, contentWeek, reels };
    })
  );
  const withPlanned = sections.filter((s) => s.reels.some((r) => r.status === "planned"));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reels to Film</h1>
        <p className="mt-1 text-sm text-muted">Across every creator, this week.</p>
      </div>

      {withPlanned.length === 0 && (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
          Nothing left to film this week.
        </div>
      )}

      {withPlanned.map(({ creator, contentWeek, reels }) => (
        <section key={creator.id} className="flex flex-col gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{creator.name}</h2>
            {contentWeek?.drive_link && <DriveUploadButton href={contentWeek.drive_link} label="Upload Reels Here" />}
          </div>
          <ReelsToFilmSection reels={reels} isStaff />
        </section>
      ))}
    </div>
  );
}
