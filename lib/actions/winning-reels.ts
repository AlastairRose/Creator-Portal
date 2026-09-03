"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { getViralReelCandidates, type ViralPostCandidate } from "@/lib/outlier-import";

export type WinningReelFields = {
  title: string;
  original_link: string | null;
  footage_link: string | null;
  scheduled_for: string;
  last_posted_date: string | null;
};

function normalizeFields(fields: WinningReelFields) {
  if (!fields.title.trim()) throw new Error("Give the reel a title.");
  if (!fields.scheduled_for) throw new Error("Pick a scheduled date.");
  return {
    title: fields.title.trim(),
    original_link: fields.original_link?.trim() || null,
    footage_link: fields.footage_link?.trim() || null,
    scheduled_for: fields.scheduled_for,
    last_posted_date: fields.last_posted_date || null,
  };
}

export async function createWinningReel(creatorId: string, fields: WinningReelFields) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("winning_reels").insert({
    creator_id: creatorId,
    added_by: profile.id,
    ...normalizeFields(fields),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/winning-30");
}

export async function updateWinningReel(id: string, fields: WinningReelFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("winning_reels").update(normalizeFields(fields)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/winning-30");
}

// Quick reschedule from the inline date picker on each row — picking a new
// date re-sorts it in place (soonest scheduled_for always at the top).
export async function setWinningReelScheduledDate(id: string, date: string) {
  await requireStaff();
  if (!date) throw new Error("Pick a date.");
  const supabase = await createClient();
  const { error } = await supabase.from("winning_reels").update({ scheduled_for: date }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/winning-30");
}

// Quick update from the inline "Last posted" date picker on each row —
// records when it was actually (re)posted. Clearable back to null.
export async function setWinningReelLastPostedDate(id: string, date: string | null) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("winning_reels").update({ last_posted_date: date || null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/winning-30");
}

export async function deleteWinningReel(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("winning_reels").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/winning-30");
}

// Reels flagged "viral" (10x+ their own baseline) in Outlier Engine's
// shared post data, excluding ones already imported here for this creator
// (matched by original_link) so re-running this doesn't create duplicates.
export async function fetchViralCandidates(creatorId: string): Promise<ViralPostCandidate[]> {
  await requireStaff();
  const supabase = await createClient();

  const [candidates, existing] = await Promise.all([
    getViralReelCandidates(creatorId),
    supabase.from("winning_reels").select("original_link").eq("creator_id", creatorId),
  ]);
  if (existing.error) throw new Error(existing.error.message);

  const existingLinks = new Set((existing.data ?? []).map((r) => r.original_link).filter(Boolean));
  return candidates.filter((c) => !existingLinks.has(c.originalLink));
}

// Bulk-adds the staff-selected candidates as new Winning 30 entries —
// last_posted_date is set to the post's actual post date (that's the last
// time it went out), while scheduled_for defaults to today as a plain
// placeholder (staff pick a real upcoming date afterward via the inline
// picker) rather than the past post date, which would read like the field
// is showing the wrong thing.
export async function importWinningReels(creatorId: string, candidates: ViralPostCandidate[]) {
  const profile = await requireStaff();
  if (candidates.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { error } = await supabase.from("winning_reels").insert(
    candidates.map((c) => ({
      creator_id: creatorId,
      added_by: profile.id,
      title: c.title,
      original_link: c.originalLink,
      footage_link: null,
      scheduled_for: today,
      last_posted_date: c.datePosted,
    }))
  );
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/winning-30");
}
