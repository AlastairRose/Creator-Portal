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
import CustomsUpdates from "@/components/dashboard/CustomsUpdates";
import VideoCallList from "@/components/video-calls/VideoCallList";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_CALL_COLUMNS, displayStatus, type VideoCallRequest } from "@/lib/video-calls";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Video calls from the last two days: anything still open, plus recent
// outcomes (paid, cancelled, fan didn't pay) so she sees what's changed.
const VIDEO_CALL_UPDATE_HOURS = 48;

function serverNow(): number {
  return Date.now();
}

async function getRecentVideoCalls(): Promise<VideoCallRequest[]> {
  const supabase = await createClient();
  const since = new Date(serverNow() - VIDEO_CALL_UPDATE_HOURS * 3600e3).toISOString();
  const { data, error } = await supabase
    .from("video_call_requests")
    .select(VIDEO_CALL_COLUMNS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Couldn't load video calls for the dashboard:", error.message);
    return [];
  }
  return (data ?? []) as unknown as VideoCallRequest[];
}

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

  const now = serverNow();
  const [counts, videoCalls, customs] = await Promise.all([
    getCreatorSummaryCounts(profile.creator_id),
    getRecentVideoCalls(),
    getOutstandingCustoms(profile.creator_id),
  ]);
  const videoCallsToAnswer = videoCalls.filter((r) => displayStatus(r, now) === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">What needs your attention this week.</p>
      </div>
      <QuickSummaryCards {...counts} videoCallsToAnswerCount={videoCallsToAnswer} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Video Calls</h2>
            <Link href="/video-calls" className="text-xs font-medium text-accent hover:underline">
              See all
            </Link>
          </div>
          <VideoCallList
            requests={videoCalls.map((r) => ({ ...r, creator_name: "" }))}
            canRespond
            showCreator={false}
            renderedAt={now}
          />
        </section>
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Custom Requests</h2>
            <Link href="/outstanding-customs" className="text-xs font-medium text-accent hover:underline">
              See all
            </Link>
          </div>
          <CustomsUpdates customs={customs} now={now} />
        </section>
      </div>
    </div>
  );
}
