"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isStaffRole } from "@/lib/roles";
import { decryptSecret } from "@/lib/onboarding/crypto";
import { syncModelInfoToChatterPortal } from "@/lib/onboarding/chatter-portal";
import { toEmbedUrl } from "@/lib/onboarding/video";

// Staff-side onboarding actions. Role checks happen here because these use
// the service-role client: owner for settings and passwords, management
// (owner + creative director) for documents and details.

type Result = { error: string | null };
const BUCKET = "creator-onboarding";

async function currentRole() {
  const profile = await getCurrentProfile();
  return { profile, role: profile?.role ?? null };
}

function isManagementRole(role: string | null) {
  return role === "owner" || role === "creative_director";
}

export async function saveOnboardingSettings(input: {
  agreementTitle: string;
  agreementBody: string;
  welcomeVideoUrl: string;
}): Promise<Result> {
  const { role } = await currentRole();
  if (role !== "owner") return { error: "Only the owner can change onboarding settings." };

  const title = input.agreementTitle.trim().slice(0, 200) || "Creator Agreement";
  const body = input.agreementBody.replace(/\r\n/g, "\n").slice(0, 100_000);
  const videoUrl = input.welcomeVideoUrl.trim();
  if (videoUrl && !toEmbedUrl(videoUrl)) {
    return { error: "That video link isn't a YouTube, Vimeo or Loom link the portal can play." };
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("onboarding_settings")
    .select("agreement_title, agreement_body, agreement_version")
    .eq("id", 1)
    .single();
  if (readError || !current) return { error: readError?.message ?? "Couldn't load the current settings." };

  // A wording change is a new version: creators already signed keep their
  // signed copy of the old one, anyone mid-signing is asked to review again.
  const changed = current.agreement_title !== title || current.agreement_body !== body;
  const { error } = await admin
    .from("onboarding_settings")
    .update({
      agreement_title: title,
      agreement_body: body,
      agreement_version: changed ? current.agreement_version + 1 : current.agreement_version,
      welcome_video_url: videoUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/onboarding");
  revalidatePath("/onboarding");
  return { error: null };
}

export async function revealLoginPassword(loginId: string): Promise<{ error: string | null; password?: string }> {
  const { profile, role } = await currentRole();
  if (!profile || role !== "owner") return { error: "Only the owner can see account passwords." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("creator_account_logins").select("password_encrypted").eq("id", loginId).maybeSingle();
  if (error || !data) return { error: error?.message ?? "Login not found." };
  let password: string;
  try {
    password = decryptSecret(data.password_encrypted);
  } catch (err) {
    console.error("Password decrypt failed:", err);
    return { error: "This password couldn't be decrypted. The encryption key may have changed." };
  }
  await admin.from("creator_login_reveals").insert({ login_id: loginId, revealed_by: profile.id });
  return { error: null, password };
}

export async function getOnboardingFileUrl(path: string): Promise<{ error: string | null; url?: string }> {
  const { role, profile } = await currentRole();
  const admin = createAdminClient();

  // Signatures: management, or the creator viewing their own signed copy.
  // ID and address documents: management only.
  if (path.startsWith("documents/")) {
    if (!isManagementRole(role)) return { error: "Only management can view these documents." };
  } else if (path.startsWith("signatures/")) {
    const ownCreatorPrefix = profile?.creator_id ? `signatures/${profile.creator_id}/` : null;
    if (!isManagementRole(role) && !(ownCreatorPrefix && path.startsWith(ownCreatorPrefix))) {
      return { error: "Not allowed." };
    }
  } else {
    return { error: "Not allowed." };
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 5 * 60);
  if (error || !data) return { error: error?.message ?? "Couldn't open that file." };
  return { error: null, url: data.signedUrl };
}

export async function setOnboardingRequired(creatorId: string, required: boolean): Promise<Result> {
  const { role } = await currentRole();
  if (!isManagementRole(role)) return { error: "Only management can change this." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("creator_onboarding")
    .upsert({ creator_id: creatorId, exempt: !required, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${creatorId}/onboarding`);
  revalidatePath("/admin/creators");
  return { error: null };
}

export async function resendModelInfoToChatterPortal(creatorId: string): Promise<Result> {
  const { role } = await currentRole();
  if (!role || !isStaffRole(role)) return { error: "Staff only." };
  const result = await syncModelInfoToChatterPortal(creatorId);
  revalidatePath(`/admin/creators/${creatorId}/onboarding`);
  return { error: result.error };
}
