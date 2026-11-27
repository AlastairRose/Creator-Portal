"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import { announceAttendanceConfirmed, announceVideoCallCompleted, announceVideoCallResponse } from "@/lib/discord";
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

  // Tells the chat team in Discord straight away, so someone follows up.
  await announceVideoCallResponse(id);

  revalidatePath("/video-calls");
  revalidatePath(`/planner/${profile.creator_id}`);
  revalidatePath("/");
  return { error: null };
}

// The creator confirms a paid call happened, with notes for the chat team to
// add to the fan's notes. Clears it from her open calls.
export async function completeVideoCall(id: string, notes: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) {
    return { error: "Only the creator can mark this call complete." };
  }
  const cleanNotes = notes.trim().slice(0, 2000);
  if (!cleanNotes) return { error: "Add a few notes about the call, so the chat team can update the fan's notes." };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("video_call_requests")
    .update({ status: "completed", completed_at: new Date().toISOString(), completion_notes: cleanNotes, team_seen_at: null, team_seen_by_name: null })
    .eq("id", id)
    .eq("creator_id", profile.creator_id)
    .eq("status", "ready")
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Only a paid call that's ready can be marked complete." };

  await announceVideoCallCompleted(id);

  revalidatePath("/video-calls");
  revalidatePath(`/planner/${profile.creator_id}`);
  revalidatePath("/");
  return { error: null };
}

// Owner only: removes a request entirely (both portals read from here).
export async function deleteVideoCall(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") return { error: "Only an admin can delete video call requests." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("video_call_requests").delete().eq("id", id).select("creator_id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "That request was already deleted." };
  revalidatePath("/video-calls");
  revalidatePath(`/planner/${data[0].creator_id}`);
  return { error: null };
}

// Before a booked call: "I'll be there". Lets the chat team know on Discord.
export async function confirmVideoCallAttendance(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) return { error: "Only the creator can confirm this." };
  const { data, error } = await createAdminClient()
    .from("video_call_requests")
    .update({ attendance_confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("creator_id", profile.creator_id)
    .eq("status", "ready")
    .is("attendance_confirmed_at", null)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "This call is already confirmed, or isn't booked any more." };
  await announceAttendanceConfirmed(id);
  revalidatePath(`/planner/${profile.creator_id}`);
  revalidatePath("/");
  return { error: null };
}
