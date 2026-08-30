"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { getMissingReelFields } from "@/lib/reels";
import { ensureWeekDriveFolder } from "@/lib/google-drive";

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

// `requireAll` gates the "every field required" rule — that only applies to
// reels typed from scratch via the manual "Add reel" form. Reels duplicated
// from an existing one, or pushed in from an R&D idea (which only ever has
// a handful of fields filled in), need to land — and be editable afterwards
// — without being forced to have every field at once.
function normalizeReelFields(fields: ReelDraftFields, requireAll: boolean) {
  if (requireAll) {
    const missing = getMissingReelFields(fields);
    if (missing.length > 0) {
      throw new Error(`Fill in every field before saving — missing: ${missing.join(", ")}.`);
    }
  } else if (!fields.name.trim()) {
    throw new Error("Name can't be empty.");
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

async function insertReel(
  contentWeekId: string,
  creatorId: string,
  fields: ReelDraftFields,
  sortOrder: number,
  requireAll: boolean
) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("reels").insert({
    content_week_id: contentWeekId,
    creator_id: creatorId,
    sort_order: sortOrder,
    ...normalizeReelFields(fields, requireAll),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction");
}

// The manual "Add reel" form — forces every field to be filled in.
export async function createDraftReel(
  contentWeekId: string,
  creatorId: string,
  fields: ReelDraftFields,
  sortOrder: number
) {
  return insertReel(contentWeekId, creatorId, fields, sortOrder, true);
}

// Duplicating an existing reel, or pushing one in from an R&D idea — both
// are meant to land quickly with whatever's already known, to be finished
// off afterwards, so they skip the "every field required" gate.
export async function createDraftReelLenient(
  contentWeekId: string,
  creatorId: string,
  fields: ReelDraftFields,
  sortOrder: number
) {
  return insertReel(contentWeekId, creatorId, fields, sortOrder, false);
}

export async function updateDraftReel(reelId: string, fields: ReelDraftFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("reels")
    .update(normalizeReelFields(fields, false))
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

  await autoCreateWeekDriveFolder(contentWeekId);

  revalidatePath("/creative-direction");
  revalidatePath("/planner");
  revalidatePath("/");
}

// Best-effort: if Google Drive is connected and this week doesn't already
// have a link (never overwrites one someone pasted in by hand), create a
// dated Drive folder for it. Never lets a Drive hiccup block publishing —
// that's the everyday-critical action, this is a nice-to-have on top of it.
async function autoCreateWeekDriveFolder(contentWeekId: string) {
  try {
    const supabase = await createClient();
    const { data: week } = await supabase
      .from("content_weeks")
      .select("creator_id, week_start_date, drive_link")
      .eq("id", contentWeekId)
      .single();
    if (!week || week.drive_link) return;

    const { data: creator } = await supabase.from("creators").select("name").eq("id", week.creator_id).single();
    if (!creator) return;

    const driveLink = await ensureWeekDriveFolder(creator.name, week.week_start_date);
    if (!driveLink) return;

    await supabase.from("content_weeks").update({ drive_link: driveLink }).eq("id", contentWeekId);
  } catch (err) {
    console.error("Couldn't auto-create Drive folder for week:", err);
  }
}
