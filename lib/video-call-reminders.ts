import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyCreator } from "@/lib/push";

// A request that arrives while a creator is asleep gets buried under other
// notifications. If it still has no answer after 12 hours, send one fresh
// reminder so it's back at the top. Older than a week isn't worth chasing.
const REMIND_AFTER_HOURS = 12;
const STOP_AFTER_DAYS = 7;

export async function sendVideoCallReminders(admin: SupabaseClient): Promise<{ reminded: number }> {
  const now = Date.now();
  const { data, error } = await admin
    .from("video_call_requests")
    .select("id, creator_id")
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .lte("created_at", new Date(now - REMIND_AFTER_HOURS * 3600e3).toISOString())
    .gte("created_at", new Date(now - STOP_AFTER_DAYS * 24 * 3600e3).toISOString());
  if (error) throw new Error(error.message);

  let reminded = 0;
  for (const request of data ?? []) {
    // Claim it first so two overlapping runs can't both send a reminder.
    const { data: claimed, error: claimError } = await admin
      .from("video_call_requests")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", request.id)
      .is("reminder_sent_at", null)
      .select("id");
    if (claimError || !claimed?.length) continue;

    // Kept neutral on purpose: this shows on the creator's lock screen.
    await notifyCreator(request.creator_id as string, {
      title: "Video call request waiting",
      body: "You haven't answered a video call request yet. Tap to reply, or let us know when you're free.",
      url: `/video-calls#${request.id}`,
      tag: `video-call-${request.id}`,
    });
    reminded++;
  }
  return { reminded };
}
