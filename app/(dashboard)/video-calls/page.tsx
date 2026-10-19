import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_CALL_COLUMNS, type VideoCallRequest } from "@/lib/video-calls";
import VideoCallList from "@/components/video-calls/VideoCallList";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 30;

function historyStartIso(): string {
  return new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export default async function VideoCallsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isStaff = isStaffRole(profile.role);
  if (!isStaff && !profile.creator_id) {
    return <p className="text-sm text-muted">No creator profile is linked to your account yet.</p>;
  }

  // RLS limits creators to their own requests; staff see everyone's.
  const supabase = await createClient();
  const since = historyStartIso();
  const { data, error } = await supabase
    .from("video_call_requests")
    .select(`${VIDEO_CALL_COLUMNS}, creator:creators(name)`)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return <p className="text-sm text-danger">Couldn&apos;t load video call requests: {error.message}</p>;

  const requests = (data ?? []).map((row) => {
    const { creator, ...rest } = row as unknown as VideoCallRequest & { creator: { name: string } | { name: string }[] | null };
    const c = Array.isArray(creator) ? creator[0] : creator;
    return { ...rest, creator_name: c?.name ?? "" };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Video Calls</h1>
        <p className="mt-1 text-sm text-muted">
          {isStaff
            ? "Video call requests sent from the Chatter Portal, and how each creator answered."
            : "Video call requests from the chat team. Accept, suggest other times, or decline."}
        </p>
      </div>
      <VideoCallList requests={requests} canRespond={!isStaff} showCreator={isStaff} />
    </div>
  );
}
