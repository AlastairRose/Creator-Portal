"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import { notifyProfile } from "@/lib/push";

type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Saves this device so the signed-in user gets phone notifications on it.
// Uses the service-role client after checking who's signed in, since the
// table has no client-facing policies.
export async function savePushSubscription(
  subscription: BrowserSubscription,
  userAgent: string
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're signed out. Sign in again and retry." };
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { error: "Your phone didn't return a valid notification subscription." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent.slice(0, 500),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("savePushSubscription failed:", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function removePushSubscription(endpoint: string): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: null };
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", profile.id);
  return { error: error?.message ?? null };
}

// Is this exact device registered for the signed-in user? Lets the setup
// guide stay hidden on phones that are already set up.
export async function isPushSubscriptionSaved(endpoint: string): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .eq("profile_id", profile.id)
    .maybeSingle();
  return !!data;
}

// Does the signed-in user have notifications on for ANY device? Used so a
// creator who already set them up (e.g. via the iPhone home-screen icon)
// isn't nagged when she opens the portal somewhere else, like a Safari tab.
export async function hasAnyPushSubscription(): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  const admin = createAdminClient();
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  return (count ?? 0) > 0;
}

export async function sendTestNotification(): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You're signed out." };
  try {
    const { sent } = await notifyProfile(profile.id, {
      title: "Notifications are on 🎉",
      body: "You'll get an alert here for new custom requests, new reels to film and new content requests.",
      url: "/planner",
      tag: "test",
    });
    if (sent === 0) return { error: "No notification could be delivered to this device." };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't send a test notification." };
  }
}
