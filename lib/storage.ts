"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "chat-screenshots";

// Always goes through the service-role client — the bucket is private with
// no client-side upload policies, since the public intake form has no
// session to carry one anyway. Called from both the public intake action
// and staff's own add/edit forms.
export async function uploadChatScreenshot(file: File): Promise<string> {
  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `customs/${crypto.randomUUID()}.${ext || "jpg"}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return path;
}

// Piggybacks on RLS instead of duplicating its logic: generates a signed
// URL only if the caller's own session can actually see a row referencing
// this path (staff, or their own creator row) — a plain authenticated
// query naturally returns nothing otherwise.
export async function getChatScreenshotSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outstanding_customs")
    .select("id")
    .eq("chat_screenshot_path", path)
    .maybeSingle();
  if (!data) return null;

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return signed.signedUrl;
}
