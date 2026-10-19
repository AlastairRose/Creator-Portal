import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-only. Sends phone notifications to every device a creator's
// account has turned notifications on for. Best-effort by design: a failed
// notification must never break the action that triggered it (publishing a
// week, logging a custom, etc.), so this never throws.

export type PushMessage = {
  title: string;
  body: string;
  url: string; // portal path the notification opens, e.g. "/reels-to-film"
  tag?: string; // a newer notification with the same tag replaces the older one
};

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:lolasbunnycollective@gmail.com";
  if (!publicKey || !privateKey) {
    console.warn("Phone notifications aren't configured (missing VAPID keys) — skipping.");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function notifyCreator(creatorId: string, message: PushMessage): Promise<void> {
  try {
    if (!configure()) return;
    const admin = createAdminClient();
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("role", "creator");
    if (profilesError) throw profilesError;
    const profileIds = (profiles ?? []).map((p) => p.id as string);
    if (profileIds.length === 0) return;
    await sendToProfiles(profileIds, message);
  } catch (err) {
    console.error(`Couldn't send phone notification to creator ${creatorId}:`, err);
  }
}

export async function notifyProfile(profileId: string, message: PushMessage): Promise<{ sent: number }> {
  if (!configure()) return { sent: 0 };
  return sendToProfiles([profileId], message);
}

async function sendToProfiles(profileIds: string[], message: PushMessage): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", profileIds);
  if (error) throw error;

  const payload = JSON.stringify(message);
  const expired: string[] = [];
  const delivered: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 * 3, urgency: "high" }
        );
        delivered.push(s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the phone unsubscribed or the browser data was cleared.
        if (status === 404 || status === 410) expired.push(s.id);
        else console.error("Push send failed:", status, err);
      }
    })
  );

  if (expired.length > 0) await admin.from("push_subscriptions").delete().in("id", expired);
  if (delivered.length > 0) {
    await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", delivered);
  }
  return { sent: delivered.length };
}
