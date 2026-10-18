"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isStaffRole, requireStaff } from "@/lib/roles";
import { deleteChatScreenshot, uploadChatScreenshot } from "@/lib/storage";
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

export async function updateOutstandingCustom(
  id: string,
  fields: CustomFields,
  newScreenshotFiles?: File[] | null
) {
  await requireStaff();
  const supabase = await createClient();
  const update: Record<string, unknown> = normalizeCustomFields(fields);

  if (newScreenshotFiles && newScreenshotFiles.length > 0) {
    const uploaded = await Promise.all(newScreenshotFiles.map((file) => uploadChatScreenshot(file)));
    const { data: current, error: fetchError } = await supabase
      .from("outstanding_customs")
      .select("chat_screenshot_paths")
      .eq("id", id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    update.chat_screenshot_paths = [...(current?.chat_screenshot_paths ?? []), ...uploaded];
  }

  const { error } = await supabase.from("outstanding_customs").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

// Removes one screenshot from a custom's gallery — fetches the current list
// rather than trusting the client's copy, so a stale UI can't resurrect a
// path someone else already removed.
export async function removeChatScreenshot(id: string, path: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("outstanding_customs")
    .select("chat_screenshot_paths")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const remaining = (current?.chat_screenshot_paths ?? []).filter((p: string) => p !== path);
  const { error } = await supabase
    .from("outstanding_customs")
    .update({ chat_screenshot_paths: remaining })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await deleteChatScreenshot(path);
  revalidatePath("/planner");
}

// A creator can only flip their OWN custom from 'outstanding' to 'uploaded'.
//
// This can't go through the creator's own session: Postgres checks the
// updated row against the SELECT policy too, and creators can only see
// 'outstanding' customs — so the moment the row becomes 'uploaded' it fails
// with "new row violates row-level security policy". Instead the checks are
// done here and the update runs with the server's own access.
//
// Returns the error rather than throwing — Next.js masks thrown server-action
// errors in production behind a generic "server error" page.
export async function markCustomUploaded(id: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're signed out. Sign in again and retry." };

  const admin = createAdminClient();
  const { data: custom, error: fetchError } = await admin
    .from("outstanding_customs")
    .select("creator_id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    console.error("markCustomUploaded fetch failed:", fetchError);
    return { error: fetchError.message };
  }
  if (!custom) return { error: "This custom no longer exists. Refresh the page." };

  const isStaff = isStaffRole(profile.role);
  if (!isStaff && (profile.role !== "creator" || custom.creator_id !== profile.creator_id)) {
    return { error: "You can only mark your own customs as uploaded." };
  }
  if (custom.status !== "outstanding") {
    return { error: "This custom has already been marked uploaded. Refresh the page." };
  }

  const { error } = await admin
    .from("outstanding_customs")
    .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "outstanding");
  if (error) {
    console.error("markCustomUploaded failed:", error);
    return { error: error.message };
  }
  revalidatePath("/planner");
  revalidatePath("/outstanding-customs");
  return { error: null };
}

// Staff-only: moves a custom between to_do_later / outstanding / uploaded /
// sent — e.g. once payment clears (to_do_later -> outstanding), or once the
// chat manager/owner has sent the finished content (uploaded -> sent).
export async function setCustomStatus(id: string, status: OutstandingCustomStatus): Promise<{ error: string | null }> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("outstanding_customs")
    .update({
      status,
      completed_at: status === "sent" ? new Date().toISOString() : null,
      ...(status === "uploaded" ? { uploaded_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("setCustomStatus failed:", error);
    return { error: error.message };
  }
  revalidatePath("/planner");
  revalidatePath("/outstanding-customs");
  return { error: null };
}

export async function deleteOutstandingCustom(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("outstanding_customs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}
