import { redirect } from "next/navigation";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import {
  getCreator,
  getContentWeek,
  getReelsForWeek,
  getOnlyfansRequests,
  getOutstandingCustoms,
} from "@/lib/queries";
import { getCurrentWeekStart } from "@/lib/weeks";
import ContentPlannerView from "@/components/planner/ContentPlannerView";

export default async function ContentPlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { creatorId } = await params;
  const isStaff = isStaffRole(profile.role);

  if (!isStaff && profile.creator_id !== creatorId) {
    redirect(profile.creator_id ? `/planner/${profile.creator_id}` : "/");
  }

  const { week } = await searchParams;
  const weekStartDate = week ?? getCurrentWeekStart();

  const creator = await getCreator(creatorId);
  if (!creator) {
    return <p className="text-sm text-muted">Creator not found.</p>;
  }

  const [contentWeek, onlyfansRequests, outstandingCustoms] = await Promise.all([
    getContentWeek(creatorId, weekStartDate),
    getOnlyfansRequests(creatorId),
    getOutstandingCustoms(creatorId),
  ]);
  const reels = contentWeek ? await getReelsForWeek(contentWeek.id) : [];

  return (
    <ContentPlannerView
      creator={creator}
      weekStartDate={weekStartDate}
      contentWeek={contentWeek}
      reels={reels}
      onlyfansRequests={onlyfansRequests}
      outstandingCustoms={outstandingCustoms}
      isStaff={isStaff}
    />
  );
}
