"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { getMissingReelFields } from "@/lib/reels";
import { ensureWeekDriveFolder, extractFolderId } from "@/lib/google-drive";

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

// Deletes a whole week's plan — draft or published — including every reel
// in it (cascades via the reels FK). Meant for clearing out test/mistaken
// weeks, not a routine action; the caller should confirm before calling
// this since there's no undo.
export async function deleteContentWeek(contentWeekId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("content_weeks").delete().eq("id", contentWeekId);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction");
  revalidatePath("/planner");
  revalidatePath("/");
}

// For a week planned under the wrong creator: moves every reel in this draft
// week to the same week for another creator (merging into that creator's
// draft if they already have one), then removes the now-empty week. Reels
// keep their ids, so nothing linked to them is lost. Only drafts can move —
// once a week is published, its creator has already seen it.
//
// Not a single transaction (supabase-js has none). The source week is only
// deleted once every reel has moved, so a failure part-way never loses a
// reel — at worst some are already under the new creator and the rest are
// still in the original week, and running the move again finishes it.
//
// Returns the error rather than throwing — Next.js masks thrown server-action
// errors in production, which would hide the reason from staff.
export async function moveDraftWeekToCreator(
  contentWeekId: string,
  targetCreatorId: string
): Promise<{ error: string | null }> {
  await requireStaff();
  try {
    await moveDraftWeek(contentWeekId, targetCreatorId);
  } catch (err) {
    console.error("Couldn't move week to another creator:", err);
    return { error: err instanceof Error ? err.message : "Couldn't move this week." };
  }
  revalidatePath("/creative-direction");
  revalidatePath("/planner");
  revalidatePath("/");
  return { error: null };
}

async function moveDraftWeek(contentWeekId: string, targetCreatorId: string) {
  const supabase = await createClient();

  const { data: source, error: sourceError } = await supabase
    .from("content_weeks")
    .select("id, creator_id, week_start_date, status")
    .eq("id", contentWeekId)
    .single();
  if (sourceError || !source) throw new Error("Couldn't find that week.");
  if (source.status !== "draft") throw new Error("Only draft weeks can be moved to another creator.");
  if (source.creator_id === targetCreatorId) return;

  const { data: existingTarget } = await supabase
    .from("content_weeks")
    .select("id, status")
    .eq("creator_id", targetCreatorId)
    .eq("week_start_date", source.week_start_date)
    .maybeSingle();
  if (existingTarget?.status === "published") {
    throw new Error("That creator's plan for this week is already published, so these reels can't be moved into it.");
  }

  const targetWeekId = existingTarget?.id ?? (await ensureDraftWeek(targetCreatorId, source.week_start_date));

  // Moved reels go after any the target week already has.
  const { data: lastTargetReel } = await supabase
    .from("reels")
    .select("sort_order")
    .eq("content_week_id", targetWeekId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const offset = lastTargetReel ? lastTargetReel.sort_order + 1 : 0;

  const { data: reels, error: reelsError } = await supabase
    .from("reels")
    .select("id, sort_order")
    .eq("content_week_id", contentWeekId);
  if (reelsError) throw new Error(reelsError.message);

  if (offset === 0) {
    const { error } = await supabase
      .from("reels")
      .update({ content_week_id: targetWeekId, creator_id: targetCreatorId })
      .eq("content_week_id", contentWeekId);
    if (error) throw new Error(error.message);
  } else {
    for (const reel of reels ?? []) {
      const { error } = await supabase
        .from("reels")
        .update({ content_week_id: targetWeekId, creator_id: targetCreatorId, sort_order: reel.sort_order + offset })
        .eq("id", reel.id);
      if (error) throw new Error(error.message);
    }
  }

  // Deleting the week cascades to any reels still in it, so be certain none are.
  const { count, error: countError } = await supabase
    .from("reels")
    .select("id", { count: "exact", head: true })
    .eq("content_week_id", contentWeekId);
  if (countError) throw new Error(countError.message);
  if (count !== 0) throw new Error("Some reels didn't move. Nothing was deleted. Please try again.");

  const { error: deleteError } = await supabase.from("content_weeks").delete().eq("id", contentWeekId);
  if (deleteError) throw new Error(deleteError.message);
}

// Returns driveFolderError when publishing succeeded but the Drive folder
// couldn't be created, so the UI can say so instead of failing silently.
export async function publishContentWeek(contentWeekId: string): Promise<{ driveFolderError: string | null }> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_weeks")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", contentWeekId);
  if (error) throw new Error(error.message);

  let driveFolderError: string | null = null;
  try {
    await createWeekDriveFolderIfMissing(contentWeekId);
  } catch (err) {
    // Never lets a Drive hiccup block publishing — that's the
    // everyday-critical action; the folder can be created afterwards.
    console.error("Couldn't auto-create Drive folder for week:", err);
    driveFolderError = err instanceof Error ? err.message : "Couldn't create the Drive folder.";
  }

  revalidatePath("/creative-direction");
  revalidatePath("/planner");
  revalidatePath("/");
  return { driveFolderError };
}

// For weeks that were published without a folder (e.g. before Drive was
// connected, or when creation failed): staff can create it with one click.
// Returns the error rather than throwing — Next.js masks thrown server-action
// errors in production, which would hide the real reason from staff.
export async function createWeekDriveFolder(contentWeekId: string): Promise<{ error: string | null }> {
  await requireStaff();
  try {
    await createWeekDriveFolderIfMissing(contentWeekId);
  } catch (err) {
    console.error("Couldn't create Drive folder for week:", err);
    return { error: err instanceof Error ? err.message : "Couldn't create the Drive folder." };
  }
  revalidatePath("/planner");
  revalidatePath("/reels-to-film");
  revalidatePath("/");
  return { error: null };
}

// Creates a dated Drive folder for the week unless it already has a link
// (never overwrites one someone pasted in by hand). Throws on failure.
async function createWeekDriveFolderIfMissing(contentWeekId: string) {
  const supabase = await createClient();
  const { data: week, error: weekError } = await supabase
    .from("content_weeks")
    .select("creator_id, week_start_date, drive_link")
    .eq("id", contentWeekId)
    .single();
  if (weekError || !week) throw new Error("Couldn't find that week.");
  if (week.drive_link) return;

  const [{ data: creator }, { data: driveLinks }] = await Promise.all([
    supabase.from("creators").select("name").eq("id", week.creator_id).single(),
    supabase
      .from("creator_drive_links")
      .select("weekly_root_drive_link")
      .eq("creator_id", week.creator_id)
      .maybeSingle(),
  ]);
  if (!creator) throw new Error("Couldn't find that week's creator.");

  const weeklyRootFolderId = driveLinks?.weekly_root_drive_link
    ? extractFolderId(driveLinks.weekly_root_drive_link)
    : null;

  const driveLink = await ensureWeekDriveFolder(creator.name, week.week_start_date, weeklyRootFolderId);

  const { error } = await supabase.from("content_weeks").update({ drive_link: driveLink }).eq("id", contentWeekId);
  if (error) throw new Error(error.message);
}
