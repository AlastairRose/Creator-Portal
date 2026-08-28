"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { ensureDraftWeek, createDraftReelLenient, type ReelDraftFields } from "@/lib/actions/creative-direction";
import { getReelsForWeek } from "@/lib/queries";

// Same shape as a reel's fields, plus which creators this idea might suit.
// Only `name` is ever required — an R&D idea is meant to be saved quickly
// with whatever's known and filled in properly later.
export type RdIdeaFields = ReelDraftFields & { suitable_creator_ids: string[] };

function normalizeRdIdeaFields(fields: RdIdeaFields) {
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

export async function createRdIdea(fields: RdIdeaFields) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("rd_ideas")
    .insert({ added_by: profile.id, ...normalizeRdIdeaFields(fields) });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/rd");
}

export async function updateRdIdea(id: string, fields: RdIdeaFields) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("rd_ideas").update(normalizeRdIdeaFields(fields)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/rd");
}

export async function deleteRdIdea(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("rd_ideas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/rd");
}

// Quickly seeds a draft reel in a creator's week from an R&D idea, carrying
// every field across (not just name/idea/inspo_link/vertical) via the
// lenient insert — same one duplication uses — since an R&D idea is often
// only partially filled in.
export async function pushRdIdeaToWeek(fields: ReelDraftFields, creatorId: string, weekStartDate: string) {
  await requireStaff();
  const weekId = await ensureDraftWeek(creatorId, weekStartDate);
  const reels = await getReelsForWeek(weekId);
  await createDraftReelLenient(weekId, creatorId, fields, reels.length);
}
