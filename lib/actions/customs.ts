"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/roles";
import { uploadChatScreenshot } from "@/lib/storage";
import { defaultDueBy } from "@/lib/customs";
import type { OutstandingCustomStatus } from "@/lib/types";

export type CustomFields = {
  sub_username: string | null;
  sub_name: string | null;
  length_of_video_or_call: string | null;
  custom_or_call: string | null;
  outfit: string | null;
  location: string | null;
  description: string;
  chat_link: string | null;
  custom_price_agreed: string | null;
  snapchat_handle: string | null;
  due_by: string | null;
};

function normalizeCustomFields(fields: CustomFields) {
  if (!fields.description.trim()) throw new Error("Description can't be empty.");
  return {
    sub_username: fields.sub_username?.trim() || null,
    sub_name: fields.sub_name?.trim() || null,
    length_of_video_or_call: fields.length_of_video_or_call?.trim() || null,
    custom_or_call: fields.custom_or_call?.trim() || null,
    outfit: fields.outfit?.trim() || null,
    location: fields.location?.trim() || null,
    description: fields.description.trim(),
    chat_link: fields.chat_link?.trim() || null,
    custom_price_agreed: fields.custom_price_agreed?.trim() || null,
    snapchat_handle: fields.snapchat_handle?.trim() || null,
    due_by: fields.due_by || null,
  };
}

export async function createOutstandingCustom(
  creatorId: string,
  fields: CustomFields,
  status: Extract<OutstandingCustomStatus, "outstanding" | "to_do_later"> = "outstanding",
  screenshotFile?: File | null
) {
  const profile = await requireStaff();
  const chat_screenshot_path =
    screenshotFile && screenshotFile.size > 0 ? await uploadChatScreenshot(screenshotFile) : null;

  const requestedAt = new Date();
  const normalized = normalizeCustomFields(fields);

  const supabase = await createClient();
  const { error } = await supabase.from("outstanding_customs").insert({
    creator_id: creatorId,
    status,
    created_by: profile.id,
    chat_screenshot_path,
    requested_at: requestedAt.toISOString(),
    ...normalized,
    due_by: normalized.due_by ?? defaultDueBy(requestedAt),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function updateOutstandingCustom(
  id: string,
  fields: CustomFields,
  screenshotFile?: File | null
) {
  await requireStaff();
  const update: Record<string, unknown> = normalizeCustomFields(fields);
  if (screenshotFile && screenshotFile.size > 0) {
    update.chat_screenshot_path = await uploadChatScreenshot(screenshotFile);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("outstanding_customs").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

// No role check — RLS + the creator-update trigger are the real boundary.
// A creator's session can only ever flip their own 'outstanding' rows to
// 'uploaded', and can't touch any other field or status value.
export async function markCustomUploaded(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("outstanding_customs")
    .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

// Staff-only: moves a custom between to_do_later / outstanding / uploaded /
// sent — e.g. once payment clears (to_do_later -> outstanding), or once the
// chat manager/owner has sent the finished content (uploaded -> sent).
export async function setCustomStatus(id: string, status: OutstandingCustomStatus) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("outstanding_customs")
    .update({
      status,
      completed_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function deleteOutstandingCustom(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("outstanding_customs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}
