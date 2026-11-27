"use client";

import VideoCallList from "@/components/video-calls/VideoCallList";
import DiscordTestButton from "@/components/video-calls/DiscordTestButton";
import type { VideoCallRequest } from "@/lib/video-calls";

// A creator's video call requests, inside her Content Planner. Creators can
// answer them here; staff see how each one went.
export default function VideoCallsSection({
  requests,
  isStaff,
  isOwner,
  renderedAt,
}: {
  requests: VideoCallRequest[];
  isStaff: boolean;
  isOwner: boolean;
  renderedAt: number;
}) {
  return (
    <section id="video-calls" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Video Calls</h2>
          <p className="mt-1 text-sm text-muted">
            {isStaff
              ? "Video call requests from the Chatter Portal over the last 30 days, and how she answered."
              : "Video call requests from the chat team. Reply within 20 minutes: accept, or let us know why not."}
          </p>
        </div>
        {isOwner && <DiscordTestButton />}
      </div>
      <VideoCallList
        requests={requests.map((r) => ({ ...r, creator_name: "" }))}
        canRespond={!isStaff}
        showCreator={false}
        renderedAt={renderedAt}
        canDelete={isOwner}
      />
    </section>
  );
}
