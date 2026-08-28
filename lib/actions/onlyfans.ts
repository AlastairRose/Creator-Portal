"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import type { ContentRequestUrgency } from "@/lib/types";

export async function createOnlyfansRequest(
  creatorId: string,
  description: string,
  urgency: ContentRequestUrgency
) {
  const profile = await requireStaff();
  if (!description.trim()) throw new Error("Description can't be empty.");

  const supabase = await createClient();
  const { error } = await supabase.from("onlyfans_content_requests").insert({
    creator_id: creatorId,
    description: description.trim(),
    urgency,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function updateOnlyfansRequest(
  id: string,
  fields: { description: string; urgency: ContentRequestUrgency }
) {
  await requireStaff();
  if (!fields.description.trim()) throw new Error("Description can't be empty.");

  const supabase = await createClient();

  // Only reset the due-date anchor if urgency actually changed — editing
  // just the description shouldn't restart the countdown.
  const { data: existing } = await supabase
    .from("onlyfans_content_requests")
    .select("urgency")
    .eq("id", id)
    .single();

  const update: Record<string, unknown> = {
    description: fields.description.trim(),
    urgency: fields.urgency,
  };
  if (existing && existing.urgency !== fields.urgency) {
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
