"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import { isExpired, MAX_ALTERNATIVE_TIMES } from "@/lib/video-calls";

export type VideoCallResponse =
  | { action: "accept" }
  | { action: "unavailable"; times: string[]; note?: string }
  | { action: "decline"; note?: string };

// A creator answers a video call request. Checks it's their own, still
// waiting and not expired, then records the answer - the Chatter Portal
// picks it up on its next refresh.
export async function respondToVideoCall(id: string, response: VideoCallResponse): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) {
    return { error: "Only the creator can answer this request." };
  }

  const admin = createAdminClient();
  const { data: current, error: fetchError } = await admin
    .from("video_call_requests")
    .select("id, creator_id, status, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!current || current.creator_id !== profile.creator_id) return { error: "Request not found." };
  if (current.status === "cancelled") return { error: "The chatter cancelled this request." };
  if (current.status !== "pending") return { error: "You've already answered this request." };
  if (isExpired(current)) return { error: "This request has expired." };

  const update: Record<string, unknown> = { responded_at: new Date().toISOString() };

  if (response.action === "accept") {
    update.status = "accepted";
  } else if (response.action === "unavailable") {
    const now = Date.now();
    const times = (response.times ?? [])
      .map((t) => new Date(t))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => d.getTime());
    if (times.length === 0) return { error: "Add at least one time you'd be available." };
    if (times.length > MAX_ALTERNATIVE_TIMES) return { error: `Add up to ${MAX_ALTERNATIVE_TIMES} times.` };
    if (times.some((t) => t < now)) return { error: "Each time needs to be in the future." };
    update.status = "unavailable";
    update.alternative_times = [...new Set(times)].sort((a, b) => a - b).map((t) => new Date(t).toISOString());
    update.decline_note = response.note?.trim().slice(0, 500) || null;
  } else if (response.action === "decline") {
    update.status = "declined";
    update.decline_note = response.note?.trim().slice(0, 500) || null;
  } else {
    return { error: "Unknown response." };
  }

  // The status guard makes a double-tap (or a cancel landing at the same
  // moment) a no-op instead of overwriting an answer.
  const { data: updated, error } = await admin
    .from("video_call_requests")
    .update(update)
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "This request was already answered or cancelled." };

  revalidatePath("/video-calls");
  return { error: null };
}
