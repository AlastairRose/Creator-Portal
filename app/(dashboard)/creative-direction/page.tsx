import { getCreators, getContentWeek, getReelsForWeek, getCreatorPlan } from "@/lib/queries";
import { getNextWeekStart } from "@/lib/weeks";
import WeeklyDraftPlanner from "@/components/creative-direction/WeeklyDraftPlanner";

export default async function CreativeDirectionReelPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ creatorId?: string; week?: string }>;
}) {
  const params = await searchParams;
  const allCreators = await getCreators();
  const creatorId = params.creatorId ?? allCreators[0]?.id ?? null;
  const weekStartDate = params.week ?? getNextWeekStart();

  const [contentWeek, creatorPlan] = await Promise.all([
    creatorId ? getContentWeek(creatorId, weekStartDate) : null,
    creatorId ? getCreatorPlan(creatorId) : null,
  ]);
  const reels = contentWeek ? await getReelsForWeek(contentWeek.id) : [];

  return (
    <WeeklyDraftPlanner
      selectedCreatorId={creatorId}
      weekStartDate={weekStartDate}
      contentWeek={contentWeek}
      reels={reels}
      agreedReelsPerWeek={creatorPlan?.agreed_reels_per_week ?? null}
    />
  );
}
