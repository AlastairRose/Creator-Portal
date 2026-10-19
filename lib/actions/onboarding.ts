"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import { agreementBlanks, fillAgreement } from "@/lib/onboarding/agreement";
import { encryptSecret } from "@/lib/onboarding/crypto";
import { markOnboardingStep, type ModelInfoAnswers } from "@/lib/onboarding/state";
import { saveMyModelInfoEverywhere, syncModelInfoToChatterPortal } from "@/lib/onboarding/chatter-portal";

// Creator-side onboarding actions. Every one checks the signed-in user is a
// creator and only ever acts on their own creator_id; the sensitive tables
// have no client write access, so writes go through the service-role client
// after these checks. All return { error } instead of throwing, since
// Next.js hides thrown server-action errors in production.

const BUCKET = "creator-onboarding";
type Result = { error: string | null };

async function requireOnboardingCreator(): Promise<{ creatorId: string; profileId: string } | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) return null;
  return { creatorId: profile.creator_id, profileId: profile.id };
}

const NOT_ALLOWED: Result = { error: "Only a creator account can do this. Try signing in again." };

// ---------------------------------------------------------------- Step 1

export async function signAgreement(input: {
  values: Record<string, string>;
  signerName: string;
  signatureDataUrl: string;
  agreementVersion: number;
}): Promise<Result> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;
  const admin = createAdminClient();

  const { data: settings, error: settingsError } = await admin
    .from("onboarding_settings")
    .select("agreement_title, agreement_body, agreement_version")
    .eq("id", 1)
    .single();
  if (settingsError || !settings) return { error: "Couldn't load the agreement. Please try again." };
  if (!settings.agreement_body.trim()) return { error: "The agreement hasn't been set up yet. Please contact your manager." };
  if (settings.agreement_version !== input.agreementVersion) {
    return { error: "The agreement was just updated. Please refresh the page and review it again before signing." };
  }

  const values: Record<string, string> = {};
  for (const blank of agreementBlanks(settings.agreement_body)) {
    const v = (input.values?.[blank.key] ?? "").trim().slice(0, 500);
    if (!v) return { error: `Please fill in "${blank.label}".` };
    values[blank.key] = v;
  }
  const signerName = input.signerName.trim().slice(0, 200);
  if (!signerName) return { error: "Please type your full name to sign." };

  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.signatureDataUrl ?? "");
  if (!match) return { error: "Please draw your signature." };
  const png = Buffer.from(match[1], "base64");
  if (png.length < 200) return { error: "Please draw your signature." };
  if (png.length > 1_000_000) return { error: "That signature image is too large. Please clear it and sign again." };

  const signaturePath = `signatures/${me.creatorId}/${crypto.randomUUID()}.png`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(signaturePath, png, { contentType: "image/png" });
  if (uploadError) return { error: `Couldn't save your signature: ${uploadError.message}` };

  const h = await headers();
  const { error } = await admin.from("creator_agreements").insert({
    creator_id: me.creatorId,
    agreement_version: settings.agreement_version,
    agreement_title: settings.agreement_title,
    agreement_text: fillAgreement(settings.agreement_body, values),
    field_values: values,
    signer_name: signerName,
    signature_path: signaturePath,
    signer_ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    signer_user_agent: (h.get("user-agent") ?? "").slice(0, 500) || null,
  });
  if (error) return { error: error.message };

  await markOnboardingStep(me.creatorId, "agreement_signed_at");
  revalidatePath("/onboarding");
  return { error: null };
}

// ---------------------------------------------------------------- Step 2

const ALLOWED_DOC_TYPES = /^(image\/(jpeg|png|heic|heif|webp)|application\/pdf)$/;

// Files go straight from the creator's phone to private storage via a
// short-lived signed upload URL, so large photos of ID don't have to pass
// through the server (which has a small request size limit).
export async function createDocumentUploadUrl(
  kind: "id_document" | "proof_of_address",
  filename: string,
  contentType: string
): Promise<{ error: string | null; path?: string; token?: string }> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;
  if (kind !== "id_document" && kind !== "proof_of_address") return { error: "Unknown document type." };
  if (!ALLOWED_DOC_TYPES.test(contentType || "")) {
    return { error: "Please upload a photo (JPG, PNG or HEIC) or a PDF." };
  }
  const ext = (filename.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `documents/${me.creatorId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Couldn't start the upload." };
  return { error: null, path: data.path, token: data.token };
}

export type DetailsInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  documents: { kind: "id_document" | "proof_of_address"; path: string; name: string; type: string }[];
  logins: { platform: string; username: string; password: string; notes: string }[];
  noOnlyfansYet: boolean;
};

export async function saveOnboardingDetails(input: DetailsInput): Promise<Result> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;

  const firstName = input.firstName.trim().slice(0, 100);
  const lastName = input.lastName.trim().slice(0, 100);
  const phone = input.phone.trim().slice(0, 40);
  const email = input.email.trim().slice(0, 200);
  if (!firstName || !lastName) return { error: "Please enter your first and last name." };
  if (!phone) return { error: "Please enter your phone number." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address." };

  const prefix = `documents/${me.creatorId}/`;
  const documents = (input.documents ?? []).filter((d) => typeof d.path === "string" && d.path.startsWith(prefix));
  if (!documents.some((d) => d.kind === "id_document")) return { error: "Please upload your photo ID." };
  if (!documents.some((d) => d.kind === "proof_of_address")) return { error: "Please upload your proof of address." };

  const logins = (input.logins ?? [])
    .map((l) => ({
      platform: (l.platform ?? "").trim().slice(0, 80),
      username: (l.username ?? "").trim().slice(0, 200),
      password: (l.password ?? "").slice(0, 500),
      notes: (l.notes ?? "").trim().slice(0, 500),
    }))
    .filter((l) => l.platform || l.username || l.password);
  for (const l of logins) {
    if (!l.platform || !l.username || !l.password) {
      return { error: `Please fill in the account, username and password for every login${l.platform ? ` (${l.platform})` : ""}.` };
    }
  }
  const hasOnlyfans = logins.some((l) => /only\s*fans/i.test(l.platform));
  if (!hasOnlyfans && !input.noOnlyfansYet) {
    return { error: "Please add your OnlyFans login, or tick that you don't have an OnlyFans account yet." };
  }

  let encrypted: { platform: string; username: string; password_encrypted: string; notes: string | null }[];
  try {
    encrypted = logins.map((l) => ({
      platform: l.platform,
      username: l.username,
      password_encrypted: encryptSecret(l.password),
      notes: l.notes || null,
    }));
  } catch (err) {
    console.error("Login encryption failed:", err);
    return { error: "Logins can't be saved securely right now. Please contact your manager." };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: detailsError } = await admin.from("creator_personal_details").upsert({
    creator_id: me.creatorId,
    first_name: firstName,
    last_name: lastName,
    phone,
    email,
    updated_at: now,
  });
  if (detailsError) return { error: detailsError.message };

  const { error: docsError } = await admin.from("creator_documents").upsert(
    documents.map((d) => ({
      creator_id: me.creatorId,
      kind: d.kind,
      path: d.path,
      original_name: (d.name ?? "").slice(0, 200) || null,
      content_type: (d.type ?? "").slice(0, 100) || null,
    })),
    { onConflict: "path", ignoreDuplicates: true }
  );
  if (docsError) return { error: docsError.message };

  // A resubmission replaces the previous set of logins.
  const { error: deleteError } = await admin.from("creator_account_logins").delete().eq("creator_id", me.creatorId);
  if (deleteError) return { error: deleteError.message };
  if (encrypted.length > 0) {
    const { error: loginsError } = await admin
      .from("creator_account_logins")
      .insert(encrypted.map((l) => ({ ...l, creator_id: me.creatorId })));
    if (loginsError) return { error: loginsError.message };
  }

  await markOnboardingStep(me.creatorId, "details_submitted_at");
  revalidatePath("/onboarding");
  revalidatePath("/", "layout");
  return { error: null };
}

// ---------------------------------------------------------------- Step 3

function cleanAnswers(answers: ModelInfoAnswers): ModelInfoAnswers {
  const clean: ModelInfoAnswers = { fields: {}, lists: {} };
  for (const [key, value] of Object.entries(answers?.fields ?? {})) {
    if (typeof value === "string" && value.trim()) clean.fields[key.slice(0, 120)] = value.trim().slice(0, 2000);
  }
  for (const [key, items] of Object.entries(answers?.lists ?? {})) {
    if (!Array.isArray(items)) continue;
    clean.lists[key.slice(0, 60)] = items
      .filter((i) => i && typeof i.content === "string" && i.content.trim())
      .slice(0, 30)
      .map((i) => ({
        title: String(i.title ?? "").trim().slice(0, 120),
        content: i.content.trim().slice(0, 2000),
        ...(typeof i.key === "string" ? { key: i.key.slice(0, 120) } : {}),
      }));
  }
  return clean;
}

// My Info: the creator updating her answers any time after onboarding.
export async function saveMyModelInfo(answers: ModelInfoAnswers): Promise<Result> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;
  const { error } = await saveMyModelInfoEverywhere(me.creatorId, cleanAnswers(answers));
  if (error) return { error };
  try {
    await markOnboardingStep(me.creatorId, "model_info_submitted_at");
  } catch {
    // progress tracking only; the answers themselves are saved
  }
  revalidatePath("/my-info");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function saveModelInfo(answers: ModelInfoAnswers): Promise<Result & { synced?: boolean }> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;

  const clean = cleanAnswers(answers);
  const admin = createAdminClient();
  const { error } = await admin.from("creator_model_info").upsert({
    creator_id: me.creatorId,
    answers: clean,
    submitted_at: new Date().toISOString(),
    chatter_portal_synced_at: null,
    chatter_portal_sync_error: null,
  });
  if (error) return { error: error.message };

  await markOnboardingStep(me.creatorId, "model_info_submitted_at");
  const sync = await syncModelInfoToChatterPortal(me.creatorId);
  revalidatePath("/onboarding");
  return { error: null, synced: sync.ok };
}

// ---------------------------------------------------------------- Steps 4-5

export async function markNotificationsStepDone(): Promise<Result> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;
  try {
    await markOnboardingStep(me.creatorId, "notifications_done_at");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save." };
  }
  revalidatePath("/onboarding");
  return { error: null };
}

export async function markWelcomeVideoWatched(): Promise<Result> {
  const me = await requireOnboardingCreator();
  if (!me) return NOT_ALLOWED;
  try {
    await markOnboardingStep(me.creatorId, "video_watched_at");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save." };
  }
  revalidatePath("/onboarding");
  revalidatePath("/", "layout");
  return { error: null };
}
