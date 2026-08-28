"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { ensureDraftWeek, createDraftReelLenient } from "@/lib/actions/creative-direction";
import { getReelsForWeek } from "@/lib/queries";

export type RdIdeaFields = {
  title: string;
  source_link: string | null;
  notes: string | null;
  vertical: string | null;
  suitable_creator_ids: string[];
};

function normalizeRdIdeaFields(fields: RdIdeaFields) {
  if (!fields.title.trim()) throw new Error("Title can't be empty.");
  return {
    title: fields.title.trim(),
    source_link: fields.source_link?.trim() || null,
    notes: fields.notes?.trim() || null,
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

// Quickly seeds a draft reel in a creator's week from an R&D idea — only
// Name/Idea/Inspo link/Vertical are known at this point, so it uses the
// lenient insert (same one duplication uses) rather than demanding every
// reel field up front. The creative director fills in the rest afterwards
// from the Reel Planner tab.
export async function pushRdIdeaToWeek(
  idea: { title: string; notes: string | null; source_link: string | null; vertical: string | null },
  creatorId: string,
  weekStartDate: string
) {
  await requireStaff();
  const weekId = await ensureDraftWeek(creatorId, weekStartDate);
  const reels = await getReelsForWeek(weekId);
  await createDraftReelLenient(
    weekId,
    creatorId,
    {
      name: idea.title,
      idea: idea.notes || idea.title,
      inspo_link: idea.source_link,
      vertical: idea.vertical,
      required_shots: null,
      hook: null,
      outfit: null,
      location: null,
      filming_style: null,
      editing_notes: null,
      posting_notes: null,
    },
    reels.length
  );
}
