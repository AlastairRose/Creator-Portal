"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import { escapeHtml, sendEmail } from "@/lib/email";
import { notifyCreator } from "@/lib/push";

// Creators giving the agency partner access to Instagram / Facebook in Meta
// Business Suite. Uses the service-role client after its own role checks.

type Result = { error: string | null };
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.lbc-creator.app";

function cleanHandle(value: string): string {
  return value.trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").slice(0, 60);
}

async function currentCreator() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) return null;
  return { profile, creatorId: profile.creator_id };
}

async function emailManagement(subject: string, html: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("email").in("role", ["owner", "creative_director"]);
    const to = [...new Set((data ?? []).map((p) => (p.email as string | null)?.trim()).filter((e): e is string => !!e))];
    if (to.length) await sendEmail({ to, subject, html });
  } catch (err) {
    console.error("Couldn't email management about Meta access:", err);
  }
}

async function creatorName(creatorId: string): Promise<string> {
  const { data } = await createAdminClient().from("creators").select("name").eq("id", creatorId).maybeSingle();
  return (data?.name as string | undefined) ?? "A creator";
}

export async function submitMetaAccess(input: { instagramHandle: string }): Promise<Result> {
  const me = await currentCreator();
  if (!me) return { error: "Only creators can do this." };
  const handle = cleanHandle(input.instagramHandle);
  if (!handle) return { error: "Please type your Instagram username." };

  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("creator_meta_access")
    .upsert({ creator_id: me.creatorId, instagram_handle: handle, status: "submitted", help_message: null, submitted_at: now, updated_at: now });
  if (error) return { error: error.message };

  const name = await creatorName(me.creatorId);
  await emailManagement(
    `${name} has shared Meta access`,
    `<p><strong>${escapeHtml(name)}</strong> says she has given LB Collective partner access to Instagram <strong>@${escapeHtml(handle)}</strong>.</p>
     <p>Check it has arrived under Business settings → Accounts in Meta Business Suite, then mark it received:</p>
     <p><a href="${APP_URL}/admin/creators/${me.creatorId}/onboarding">Open ${escapeHtml(name)}'s onboarding page</a></p>`,
  );
  revalidatePath("/meta-access");
  return { error: null };
}

export async function requestMetaHelp(input: { instagramHandle: string; message: string; stuckAt: string }): Promise<Result> {
  const me = await currentCreator();
  if (!me) return { error: "Only creators can do this." };
  const handle = cleanHandle(input.instagramHandle);
  const message = input.message.trim().slice(0, 2000);
  const stuckAt = input.stuckAt.trim().slice(0, 200);

  const admin = createAdminClient();
  const { data: existing } = await admin.from("creator_meta_access").select("status").eq("creator_id", me.creatorId).maybeSingle();
  if (existing?.status === "confirmed") return { error: "We've already received your access. Nothing more to do." };

  const now = new Date().toISOString();
  const { error } = await admin.from("creator_meta_access").upsert({
    creator_id: me.creatorId,
    instagram_handle: handle || null,
    status: "help",
    help_message: [stuckAt && `Stuck at: ${stuckAt}`, message].filter(Boolean).join("\n") || null,
    submitted_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };

  const name = await creatorName(me.creatorId);
  await emailManagement(
    `${name} needs help giving Meta access`,
    `<p><strong>${escapeHtml(name)}</strong> is stuck giving LB Collective access to Instagram${handle ? ` <strong>@${escapeHtml(handle)}</strong>` : ""}.</p>
     ${stuckAt ? `<p>Stuck at: ${escapeHtml(stuckAt)}</p>` : ""}
     ${message ? `<p>Her message: ${escapeHtml(message)}</p>` : ""}
     <p>You can also send her an access request from your Business Suite instead.</p>
     <p><a href="${APP_URL}/admin/creators/${me.creatorId}/onboarding">Open ${escapeHtml(name)}'s onboarding page</a></p>`,
  );
  revalidatePath("/meta-access");
  return { error: null };
}

export async function confirmMetaAccess(creatorId: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "owner" && profile.role !== "creative_director")) {
    return { error: "Only management can confirm this." };
  }
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: existing } = await admin.from("creator_meta_access").select("creator_id").eq("creator_id", creatorId).maybeSingle();
  const { error } = existing
    ? await admin
        .from("creator_meta_access")
        .update({ status: "confirmed", confirmed_at: now, confirmed_by: profile.id, updated_at: now })
        .eq("creator_id", creatorId)
    : await admin
        .from("creator_meta_access")
        .insert({ creator_id: creatorId, status: "confirmed", submitted_at: now, confirmed_at: now, confirmed_by: profile.id, updated_at: now });
  if (error) return { error: error.message };

  await notifyCreator(creatorId, {
    title: "Instagram access received",
    body: "Thanks! We've received access to your account. Nothing more to do.",
    url: "/meta-access",
  });
  revalidatePath(`/admin/creators/${creatorId}/onboarding`);
  revalidatePath("/admin/creators");
  return { error: null };
}

// "Not received yet": sends the creator back through the steps.
export async function resetMetaAccess(creatorId: string): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "owner" && profile.role !== "creative_director")) {
    return { error: "Only management can change this." };
  }
  const { error } = await createAdminClient().from("creator_meta_access").delete().eq("creator_id", creatorId);
  if (error) return { error: error.message };
  await notifyCreator(creatorId, {
    title: "Instagram access",
    body: "We haven't received access to your account yet. Please check the steps in the portal again.",
    url: "/meta-access",
  });
  revalidatePath(`/admin/creators/${creatorId}/onboarding`);
  revalidatePath("/admin/creators");
  return { error: null };
}
