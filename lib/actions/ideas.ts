"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, requireCreator } from "@/lib/roles";
import { ensureDraftWeek, createDraftReelLenient, type ReelDraftFields } from "@/lib/actions/creative-direction";
import { getReelsForWeek } from "@/lib/queries";
import { baseIdeaName, likePrefix, nextVersionName } from "@/lib/idea-versions";

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

// Copies an idea as a new version ("Beach walk" -> "(v2)"), so variations can
// be worked on without changing the original.
export async function duplicateIdea(id: string): Promise<{ error: string | null }> {
  try {
    const profile = await requireStaff();
    const supabase = await createClient();
    const { data: original, error: readError } = await supabase.from("ideas").select("name, idea, inspo_link, required_shots, hook, outfit, location, filming_style, editing_notes, posting_notes, vertical, suitable_creator_ids").eq("id", id).single();
    if (readError || !original) return { error: readError?.message ?? "Idea not found." };
    const { data: similar } = await supabase
      .from("ideas")
      .select("name")
      .ilike("name", likePrefix(baseIdeaName(original.name as string)));
    const name = nextVersionName(original.name as string, (similar ?? []).map((r) => r.name as string));
    const { error } = await supabase.from("ideas").insert({ ...original, name, added_by: profile.id });
    if (error) return { error: error.message };
    revalidatePath("/creative-direction/ideas");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't duplicate that idea." };
  }
}
