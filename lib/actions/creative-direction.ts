"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { getMissingReelFields } from "@/lib/reels";

// Finds this creator's draft content_week for the given week, creating one
// if it doesn't exist yet. Small race window if two staff hit this at the
// exact same instant for the same creator/week — acceptable for an internal
// tool with a handful of staff.
export async function ensureDraftWeek(creatorId: string, weekStartDate: string): Promise<string> {
  await requireStaff();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("content_weeks")
    .insert({ creator_id: creatorId, week_start_date: weekStartDate, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/creative-direction");
  return data.id;
}

// Mirrors the founder's existing per-reel planning template (Notion).
export type ReelDraftFields = {
  name: string;
  idea: string;
  inspo_link: string | null;
  required_shots: string | null;
  hook: string | null;
  outfit: string | null;
  location: string | null;
  filming_style: string | null;
  editing_notes: string | null;
  posting_notes: string | null;
  vertical: string | null;
};

function normalizeReelFields(fields: ReelDraftFields) {
  const missing = getMissingReelFields(fields);
  if (missing.length > 0) {
    throw new Error(`Fill in every field before saving — missing: ${missing.join(", ")}.`);
  }
  return {
    name: fields.name.trim(),
    idea: fields.idea.trim(),
    inspo_link: fields.inspo_link?.trim() || null,
    required_shots: fields.required_shots?.trim() || null,
    hook: fields.hook?.trim() || null,
    outfit: fields.outfit?.trim() || null,
    location: fields.location?.trim() || null,
    filming_style: fields.filming_style?.trim() || null,
    editing_notes: fields.editing_notes?.trim() || null,
    posting_notes: fields.posting_notes?.trim() || null,
    vertical: fields.vertical?.trim() || null,
  };
}

export async function createDraftReel(
  contentWeekId: string,
  creatorId: string,
  fields: ReelDraftFields,
  sortOrder: number
) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("reels").insert({
    content_week_id: contentWeekId,
    creator_id: creatorId,
    sort_order: sortOrder,
    ...normalizeReelFields(fields),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction");
}

export async function updateDraftReel(reelId: string, fields: ReelDraftFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("reels")
    .update(normalizeReelFields(fields))
    .eq("id", reelId);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction");
}

export async function deleteDraftReel(reelId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("reels").delete().eq("id", reelId);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction");
}

export async function publishContentWeek(contentWeekId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_weeks")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", contentWeekId);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction");
  revalidatePath("/planner");
  revalidatePath("/");
}
