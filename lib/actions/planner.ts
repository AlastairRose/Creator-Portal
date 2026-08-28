"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import type { ReelStatus } from "@/lib/types";

// No role check here on purpose — Postgres RLS + the reels_creator_update_guard
// trigger are the real boundary. A creator's session can only ever touch
// reels in their own published weeks, and can't set status to 'edited' or
// 'posted'. A staff session can touch anything. This keeps the action layer
// thin and avoids the boundary living in two places that could drift apart.

export async function markReelsUploaded(reelIds: string[]) {
  if (reelIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("reels")
    .update({ status: "uploaded", status_reason: null })
    .in("id", reelIds);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function setReelDeclined(
  reelId: string,
  status: "unable_to_record" | "not_liked",
  reason: string | null
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reels")
    .update({ status, status_reason: reason?.trim() || null })
    .eq("id", reelId);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function updateContentWeekDriveLink(contentWeekId: string, driveLink: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_weeks")
    .update({ drive_link: driveLink.trim() || null })
    .eq("id", contentWeekId);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

// Staff/editor only: progressing a reel to 'edited' or 'posted' is a
// deliberate call, not something RLS alone should silently allow for staff
// vs guard against for creators — requireStaff() here is a real check on top
// of the trigger, since both statuses are meant to only ever be set by staff.
export async function markReelStaffStatus(reelId: string, status: Extract<ReelStatus, "edited" | "posted">) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("reels").update({ status }).eq("id", reelId);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}
