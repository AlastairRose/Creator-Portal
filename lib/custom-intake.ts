import { createAdminClient } from "@/lib/supabase/admin";
import { uploadChatScreenshot } from "@/lib/storage";
import { defaultDueBy } from "@/lib/customs";
import { notifyCreator } from "@/lib/push";
import { formatDateUK } from "@/lib/format";

// Server-only. Logs a new outstanding custom for one creator - shared by the
// public intake link (lib/actions/intake.ts) and the Chatter Portal's
// "Customs & Calls" page (/api/integrations/customs), so both write exactly
// the same way. Video calls are no longer logged here: they go through the
// video call request flow instead.

export type NewCustomFields = {
  description: string;
  sub_username: string | null;
  sub_name: string | null;
  length_of_video_or_call: string | null;
  outfit: string | null;
  location: string | null;
  chat_link: string | null;
  custom_price_agreed: string | null;
  snapchat_handle: string | null;
};

export const CUSTOM_TEXT_FIELDS = [
  "sub_username",
  "sub_name",
  "length_of_video_or_call",
  "outfit",
  "location",
  "chat_link",
  "custom_price_agreed",
  "snapchat_handle",
] as const;

export async function createCustomRequest(input: {
  creatorId: string;
  chatterName: string;
  fields: NewCustomFields;
  screenshots: File[];
}): Promise<{ id: string } | { error: string }> {
  const { creatorId, chatterName, fields, screenshots } = input;
  if (!fields.description.trim()) return { error: "Description can't be empty." };
  if (!chatterName.trim()) return { error: "Add your name so management knows who logged this." };

  let chatScreenshotPaths: string[] = [];
  if (screenshots.length > 0) {
    try {
      chatScreenshotPaths = await Promise.all(screenshots.map((file) => uploadChatScreenshot(file)));
    } catch {
      return { error: "Couldn't upload those screenshots — try again." };
    }
  }

  const requestedAt = new Date();
  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("outstanding_customs")
    .insert({
      creator_id: creatorId,
      status: "outstanding",
      description: fields.description.trim(),
      sub_username: fields.sub_username,
      sub_name: fields.sub_name,
      length_of_video_or_call: fields.length_of_video_or_call,
      custom_or_call: "Custom",
      outfit: fields.outfit,
      location: fields.location,
      chat_screenshot_paths: chatScreenshotPaths,
      chat_link: fields.chat_link,
      custom_price_agreed: fields.custom_price_agreed,
      snapchat_handle: fields.snapchat_handle,
      requested_at: requestedAt.toISOString(),
      // Due date is automatic — 72 hours from submission — not something the
      // sales team sets themselves.
      due_by: defaultDueBy(requestedAt),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Management-only (see custom_chatter_names). The custom itself is already
  // saved, so a failure here is logged rather than failing the submission.
  const { error: chatterError } = await admin
    .from("custom_chatter_names")
    .insert({ custom_id: inserted.id, chatter_name: chatterName.trim().slice(0, 100) });
  if (chatterError) console.error("Couldn't save chatter name for custom:", chatterError);

  // Kept neutral on purpose: this shows on the creator's lock screen.
  await notifyCreator(creatorId, {
    title: "New custom request",
    body: `You have a new custom request, due ${formatDateUK(defaultDueBy(requestedAt))}.`,
    url: "/planner",
  });

  return { id: inserted.id };
}
