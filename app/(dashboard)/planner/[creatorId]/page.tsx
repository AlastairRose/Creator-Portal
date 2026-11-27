import { redirect } from "next/navigation";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import {
  getCreator,
  getContentWeek,
  getReelsForWeek,
  getOnlyfansRequests,
  getOutstandingCustoms,
  getCreatorDriveLinks,
} from "@/lib/queries";
import { getCurrentWeekStart } from "@/lib/weeks";
import ContentPlannerView from "@/components/planner/ContentPlannerView";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_CALL_COLUMNS, type VideoCallRequest } from "@/lib/video-calls";

export const dynamic = "force-dynamic";

const VIDEO_CALL_HISTORY_DAYS = 30;

function serverNow(): number {
  return Date.now();
}

async function getCreatorVideoCalls(creatorId: string, now: number): Promise<VideoCallRequest[]> {
  // RLS limits creators to their own requests; staff can see everyone's.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_call_requests")
    .select(VIDEO_CALL_COLUMNS)
    .eq("creator_id", creatorId)
    .gte("created_at", new Date(now - VIDEO_CALL_HISTORY_DAYS * 24 * 3600e3).toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Couldn't load video calls for the planner:", error.message);
    return [];
  }
  return (data ?? []) as unknown as VideoCallRequest[];
}

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

  const now = serverNow();
  const [contentWeek, onlyfansRequests, outstandingCustoms, driveLinks, videoCalls] = await Promise.all([
    getContentWeek(creatorId, weekStartDate),
    getOnlyfansRequests(creatorId),
    getOutstandingCustoms(creatorId),
    getCreatorDriveLinks(creatorId),
    getCreatorVideoCalls(creatorId, now),
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
      driveLinks={driveLinks}
      isStaff={isStaff}
      isOwner={profile.role === "owner"}
      videoCalls={videoCalls}
      renderedAt={now}
    />
  );
}
