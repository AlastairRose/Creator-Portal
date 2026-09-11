"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { uploadChatScreenshot } from "@/lib/storage";
import { defaultDueBy } from "@/lib/customs";

// Public, unauthenticated intake — the sales team submits this via a plain
// shared link scoped to one creator, same as the old Airtable form. No
// Creator Portal login exists for them, so this uses the service-role
// client to write directly, bypassing RLS on purpose. Keep this action
// narrow: it can only insert a fresh 'outstanding' custom request for the
// bound creatorId, never read, update, or delete.
export type IntakeState = { error: string | null; success: boolean };

export async function submitOutstandingCustomIntake(
  creatorId: string,
  _prevState: IntakeState,
  formData: FormData
): Promise<IntakeState> {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Description can't be empty.", success: false };

  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const screenshots = formData.getAll("chat_screenshot").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  let chatScreenshotPaths: string[] = [];
  if (screenshots.length > 0) {
    try {
      chatScreenshotPaths = await Promise.all(screenshots.map((file) => uploadChatScreenshot(file)));
    } catch {
      return { error: "Couldn't upload those screenshots — try again.", success: false };
    }
  }

  const requestedAt = new Date();

  const admin = createAdminClient();
  const { error } = await admin.from("outstanding_customs").insert({
    creator_id: creatorId,
    status: "outstanding",
    description,
    sub_username: field("sub_username"),
    sub_name: field("sub_name"),
    length_of_video_or_call: field("length_of_video_or_call"),
    custom_or_call: field("custom_or_call"),
    outfit: field("outfit"),
    location: field("location"),
    chat_screenshot_paths: chatScreenshotPaths,
    chat_link: field("chat_link"),
    custom_price_agreed: field("custom_price_agreed"),
    snapchat_handle: field("snapchat_handle"),
    requested_at: requestedAt.toISOString(),
    // Due date is automatic — 72 hours from submission — not something the
    // sales team sets themselves.
    due_by: defaultDueBy(requestedAt),
  });
  if (error) return { error: error.message, success: false };

  return { error: null, success: true };
}
