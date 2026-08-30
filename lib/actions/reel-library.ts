"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import type { ReelDraftFields } from "@/lib/actions/creative-direction";

function toLibraryFields(fields: ReelDraftFields) {
  return {
    name: fields.name,
    idea: fields.idea?.trim() || null,
    inspo_link: fields.inspo_link,
    required_shots: fields.required_shots,
    hook: fields.hook,
    outfit: fields.outfit,
    location: fields.location,
    filming_style: fields.filming_style,
    editing_notes: fields.editing_notes,
    posting_notes: fields.posting_notes,
    vertical: fields.vertical,
  };
}

// Copies a reel's fields into R&D or Ideas as a new, independent row — the
// reel itself is untouched, this is purely a "keep this for later" action,
// same as how pushing an idea into a plan never removes it from the library.
export async function saveReelToRdIdeas(fields: ReelDraftFields, suitableCreatorId: string) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("rd_ideas").insert({
    added_by: profile.id,
    suitable_creator_ids: [suitableCreatorId],
    ...toLibraryFields(fields),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/rd");
}

export async function saveReelToIdeas(fields: ReelDraftFields, suitableCreatorId: string) {
  const profile = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").insert({
    added_by: profile.id,
    suitable_creator_ids: [suitableCreatorId],
    ...toLibraryFields(fields),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/creative-direction/ideas");
}
