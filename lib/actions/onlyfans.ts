"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import type { ContentRequestUrgency, OnlyfansContentType } from "@/lib/types";

export type OnlyfansSextingItemFields = {
  content_label: string;
  description: string | null;
  length: string | null;
  creator_required: boolean;
};

export type OnlyfansRequestFields = {
  content_type: OnlyfansContentType;
  description: string | null;
  length: string | null;
  urgency: ContentRequestUrgency;
  sexting_drive_link: string | null;
  sexting_storyline: string | null;
  sexting_items: OnlyfansSextingItemFields[];
};

// Sexting requests carry no top-level description/length of their own — the
// checklist rows are the content. Every other type is purely a description +
// length shown in full to the creator, with no checklist.
function normalizeRequestFields(fields: OnlyfansRequestFields) {
  if (fields.content_type === "sexting") {
    const items = fields.sexting_items
      .map((item) => ({
        content_label: item.content_label.trim(),
        description: item.description?.trim() || null,
        length: item.length?.trim() || null,
        creator_required: item.creator_required,
      }))
      .filter((item) => item.content_label.length > 0);
    if (items.length === 0) throw new Error("Add at least one required content row.");
    return {
      request: {
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
    request: {
      content_type: fields.content_type,
      description: fields.description.trim(),
      length: fields.length?.trim() || null,
      sexting_drive_link: null,
      sexting_storyline: null,
    },
    items: [] as OnlyfansSextingItemFields[],
  };
}

export async function createOnlyfansRequest(creatorId: string, fields: OnlyfansRequestFields) {
  const profile = await requireStaff();
  const { request, items } = normalizeRequestFields(fields);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onlyfans_content_requests")
    .insert({
      creator_id: creatorId,
      urgency: fields.urgency,
      created_by: profile.id,
      ...request,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("onlyfans_sexting_items").insert(
      items.map((item, index) => ({
        request_id: data.id,
        sort_order: index,
        ...item,
      }))
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/planner");
}

export async function updateOnlyfansRequest(id: string, fields: OnlyfansRequestFields) {
  await requireStaff();
  const { request, items } = normalizeRequestFields(fields);

  const supabase = await createClient();

  // Only reset the due-date anchor if urgency actually changed — editing
  // other fields shouldn't restart the countdown.
  const { data: existing } = await supabase
    .from("onlyfans_content_requests")
    .select("urgency")
    .eq("id", id)
    .single();

  const update: Record<string, unknown> = { urgency: fields.urgency, ...request };
  if (existing && existing.urgency !== fields.urgency) {
    update.urgency_set_at = new Date().toISOString();
  }

  const { error } = await supabase.from("onlyfans_content_requests").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  // Replace the whole checklist rather than diffing — the form always
  // submits its full current row set, and there's never more than a handful
  // of rows, so this is simpler than reconciling adds/edits/removals.
  const { error: deleteError } = await supabase.from("onlyfans_sexting_items").delete().eq("request_id", id);
  if (deleteError) throw new Error(deleteError.message);
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("onlyfans_sexting_items").insert(
      items.map((item, index) => ({
        request_id: id,
        sort_order: index,
        ...item,
      }))
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/planner");
}

// Lightweight path for the inline urgency dropdown shown on each row of the
// table — doesn't touch the description/checklist, so it can't accidentally
// clobber them.
export async function updateOnlyfansRequestUrgency(id: string, urgency: ContentRequestUrgency) {
  await requireStaff();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("onlyfans_content_requests")
    .select("urgency")
    .eq("id", id)
    .single();

  const update: Record<string, unknown> = { urgency };
  if (existing && existing.urgency !== urgency) {
    update.urgency_set_at = new Date().toISOString();
  }

  const { error } = await supabase.from("onlyfans_content_requests").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function markOnlyfansRequestComplete(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("onlyfans_content_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function deleteOnlyfansRequest(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("onlyfans_content_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}
