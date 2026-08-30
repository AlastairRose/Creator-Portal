"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, requireCreator } from "@/lib/roles";
import { ensureDraftWeek, createDraftReelLenient, type ReelDraftFields } from "@/lib/actions/creative-direction";
import { getReelsForWeek } from "@/lib/queries";

// Same shape as a reel's fields, plus which creators this idea might suit.
// Only `name` is ever required, same as R&D.
export type IdeaFields = ReelDraftFields & { suitable_creator_ids: string[] };

function normalizeIdeaFields(fields: IdeaFields) {
  if (!fields.name.trim()) throw new Error("Name can't be empty.");
  return {
    name: fields.name.trim(),
    idea: fields.idea?.trim() || null,
    inspo_link: fields.inspo_link?.trim() || null,
    required_shots: fields.required_shots?.trim() || null,
    hook: fields.hook?.trim() || null,
    outfit: fields.outfit?.trim() || null,
    location: fields.location?.trim() || null,
    filming_style: fields.filming_style?.trim() || null,
    editing_notes: fields.editing_notes?.trim() || null,
    posting_notes: fields.posting_notes?.trim() || null,
    vertical: fields.vertical?.trim() || null,
    suitable_creator_ids: fields.suitable_creator_ids,
  };
}

export async function createIdea(fields: IdeaFields) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").insert({ added_by: profile.id, ...normalizeIdeaFields(fields) });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ideas");
}

export async function updateIdea(id: string, fields: IdeaFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").update(normalizeIdeaFields(fields)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ideas");
}

export async function deleteIdea(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ideas");
}

export async function pushIdeaToWeek(fields: ReelDraftFields, creatorId: string, weekStartDate: string) {
  await requireStaff();
  const weekId = await ensureDraftWeek(creatorId, weekStartDate);
  const reels = await getReelsForWeek(weekId);
  await createDraftReelLenient(weekId, creatorId, fields, reels.length);
}

// A creator submitting their own idea from the Content Planner — only
// `name` required, tagged as suitable for just themselves, and flagged with
// submitted_by_creator_id so staff can tell it apart from one they added.
export async function submitOwnIdea(fields: ReelDraftFields) {
  const profile = await requireCreator();
  if (!fields.name.trim()) throw new Error("Give it a short name first.");

  const supabase = await createClient();
  const { error } = await supabase.from("ideas").insert({
    name: fields.name.trim(),
    idea: fields.idea?.trim() || null,
    inspo_link: fields.inspo_link?.trim() || null,
    required_shots: fields.required_shots?.trim() || null,
    hook: fields.hook?.trim() || null,
    outfit: fields.outfit?.trim() || null,
    location: fields.location?.trim() || null,
    filming_style: fields.filming_style?.trim() || null,
    editing_notes: fields.editing_notes?.trim() || null,
    posting_notes: fields.posting_notes?.trim() || null,
    vertical: fields.vertical?.trim() || null,
    suitable_creator_ids: [profile.creator_id],
    submitted_by_creator_id: profile.creator_id,
    added_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}
