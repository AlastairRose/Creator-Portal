"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { createOnlyfansRequest, type OnlyfansRequestFields, type OnlyfansSextingItemFields } from "@/lib/actions/onlyfans";

export type OfcdIdeaFields = OnlyfansRequestFields & { title: string };

// Same content-type branching as a real request (see lib/actions/onlyfans.ts)
// — an idea isn't tied to a creator or urgency yet, so those aren't stored,
// just a title to identify it in the library list.
function normalizeOfcdIdeaFields(fields: OfcdIdeaFields) {
  if (!fields.title.trim()) throw new Error("Give this idea a title.");

  if (fields.content_type === "sexting") {
    const items: OnlyfansSextingItemFields[] = fields.sexting_items
      .map((item) => ({
        content_label: item.content_label.trim(),
        description: item.description?.trim() || null,
        length: item.length?.trim() || null,
        creator_required: item.creator_required,
      }))
      .filter((item) => item.content_label.length > 0);
    if (items.length === 0) throw new Error("Add at least one required content row.");
    return {
      idea: {
        title: fields.title.trim(),
        content_type: fields.content_type,
        description: null,
        length: null,
        sexting_drive_link: fields.sexting_drive_link?.trim() || null,
        sexting_storyline: fields.sexting_storyline?.trim() || null,
      },
      items,
    };
  }

  if (!fields.description?.trim()) throw new Error("Description can't be empty.");
  return {
    idea: {
      title: fields.title.trim(),
      content_type: fields.content_type,
      description: fields.description.trim(),
      length: fields.length?.trim() || null,
      sexting_drive_link: null,
      sexting_storyline: null,
    },
    items: [] as OnlyfansSextingItemFields[],
  };
}

export async function createOfcdIdea(fields: OfcdIdeaFields) {
  const profile = await requireStaff();
  const { idea, items } = normalizeOfcdIdeaFields(fields);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofcd_ideas")
    .insert({ added_by: profile.id, ...idea })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("ofcd_idea_sexting_items")
      .insert(items.map((item, index) => ({ ofcd_idea_id: data.id, sort_order: index, ...item })));
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/ofcd");
}

export async function updateOfcdIdea(id: string, fields: OfcdIdeaFields) {
  await requireStaff();
  const { idea, items } = normalizeOfcdIdeaFields(fields);

  const supabase = await createClient();
  const { error } = await supabase.from("ofcd_ideas").update(idea).eq("id", id);
  if (error) throw new Error(error.message);

  // Replace the whole checklist rather than diffing, same as a real request.
  const { error: deleteError } = await supabase.from("ofcd_idea_sexting_items").delete().eq("ofcd_idea_id", id);
  if (deleteError) throw new Error(deleteError.message);
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("ofcd_idea_sexting_items")
      .insert(items.map((item, index) => ({ ofcd_idea_id: id, sort_order: index, ...item })));
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/ofcd");
}

export async function deleteOfcdIdea(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("ofcd_ideas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ofcd");
}

// "Add to creator plan": creates a real request for the chosen creator via
// the same insert path as the manual "Add content request" form. The idea
// itself is untouched, so it stays reusable for other creators later.
export async function pushOfcdIdeaToCreator(creatorId: string, fields: OnlyfansRequestFields) {
  await createOnlyfansRequest(creatorId, fields);
}

// "Add to Ideas" from a real request row on a creator's Content Planner —
// copies its current fields into a new OFCD idea. The request is untouched.
export async function saveOnlyfansRequestToOfcd(title: string, fields: OnlyfansRequestFields) {
  await createOfcdIdea({ ...fields, title });
}
