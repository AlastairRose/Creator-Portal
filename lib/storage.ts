"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/roles";

const BUCKET = "chat-screenshots";
const SOPS_BUCKET = "sop-documents";

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

// SOPs are staff-only across the board (no per-row visibility variance like
// chat screenshots have), so this just gates on requireStaff() directly
// rather than piggybacking on a row query.
export async function uploadSopDocument(file: File): Promise<{ path: string; filename: string }> {
  await requireStaff();
  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `sops/${crypto.randomUUID()}.${ext || "pdf"}`;
  const { error } = await admin.storage
    .from(SOPS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return { path, filename: file.name };
}

export async function getSopDocumentSignedUrl(path: string): Promise<string | null> {
  await requireStaff();
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(SOPS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return signed.signedUrl;
}

export async function deleteSopDocument(path: string): Promise<void> {
  await requireStaff();
  const admin = createAdminClient();
  await admin.storage.from(SOPS_BUCKET).remove([path]);
}
