"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import { isNoReply, MAX_ALTERNATIVE_TIMES, PAYMENT_WINDOW_MINUTES, type DeclineReason } from "@/lib/video-calls";

export type VideoCallResponse =
  | { action: "accept" }
  | { action: "decline"; reason: DeclineReason; times?: string[]; note?: string }
  | { action: "suggest_times"; times: string[]; note?: string }; // after missing the reply window

function cleanTimes(raw: string[] | undefined): { times: string[]; error: string | null } {
  const now = Date.now();
  const ms = (raw ?? [])
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()))
    .map((d) => d.getTime());
  if (ms.length > MAX_ALTERNATIVE_TIMES) return { times: [], error: `Add up to ${MAX_ALTERNATIVE_TIMES} times.` };
  if (ms.some((t) => t < now)) return { times: [], error: "Each time needs to be in the future." };
  return { times: [...new Set(ms)].sort((a, b) => a - b).map((t) => new Date(t).toISOString()), error: null };
}

// A creator answers a video call request. Checks it's hers and in the right
// state, then records the answer; the Chatter Portal picks it up on its next
// refresh and the chat team's to-do list is reset so someone acts on it.
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
  if (current.status === "cancelled") return { error: "The chat team cancelled this request." };
  if (current.status !== "pending") return { error: "You've already answered this request." };

  const late = isNoReply(current);
  const now = new Date();
  const update: Record<string, unknown> = { responded_at: now.toISOString(), team_seen_at: null, team_seen_by_name: null };

  if (response.action === "accept") {
    if (late) return { error: "This request was missed - suggest a time for the fan instead." };
    update.status = "accepted";
    update.accepted_at = now.toISOString();
    update.payment_deadline = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString();
  } else if (response.action === "decline") {
    if (late) return { error: "This request was missed - suggest a time for the fan instead." };
    if (!["unavailable", "price_too_low", "not_interested"].includes(response.reason)) return { error: "Pick a reason." };
    const { times, error } = cleanTimes(response.reason === "unavailable" ? response.times : []);
    if (error) return { error };
    update.status = "declined";
    update.decline_reason = response.reason;
    update.alternative_times = times;
    update.decline_note = response.note?.trim().slice(0, 500) || null;
  } else if (response.action === "suggest_times") {
    if (!late) return { error: "This request is still open - accept or decline it instead." };
    const { times, error } = cleanTimes(response.times);
    if (error) return { error };
    if (times.length === 0) return { error: "Add at least one time you'd be available." };
    update.status = "missed";
    update.alternative_times = times;
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
