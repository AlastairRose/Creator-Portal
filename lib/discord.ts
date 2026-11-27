import { createAdminClient } from "@/lib/supabase/admin";
import { DECLINE_REASON_LABELS, PAYMENT_WINDOW_MINUTES, type DeclineReason } from "@/lib/video-calls";

// Posts to the chat team's Discord channel through a channel webhook. The
// webhook link is a secret, set in Vercel as DISCORD_VIDEO_CALL_WEBHOOK_URL.
// Best-effort: a Discord problem must never stop a creator's answer saving.

const CHATTER_PORTAL_URL = (process.env.CHATTER_PORTAL_URL || "https://chatter-portal.vercel.app").replace(/\/+$/, "");
const CHAT_TEAM_TIME_ZONE = "Asia/Manila";

async function postToDiscord(content: string): Promise<void> {
  const url = process.env.DISCORD_VIDEO_CALL_WEBHOOK_URL;
  if (!url) {
    console.warn("Discord isn't set up (no DISCORD_VIDEO_CALL_WEBHOOK_URL) - skipping.");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Video Calls",
        content: content.slice(0, 2000),
        allowed_mentions: { parse: ["everyone"] },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Discord post failed:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("Discord post failed:", err);
  }
}

function manilaTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: CHAT_TEAM_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "@everyone Lola has responded to their video call request…"
export async function announceVideoCallResponse(requestId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from("video_call_requests")
      .select("creator_id, status, fan_name, requested_by_name, length_minutes, decline_reason, decline_note, alternative_times")
      .eq("id", requestId)
      .maybeSingle();
    if (!r) return;
    const { data: creator } = await admin.from("creators").select("name").eq("id", r.creator_id).maybeSingle();
    const name = (creator?.name as string | undefined) ?? "A creator";

    const times = ((r.alternative_times as string[] | null) ?? []).map(manilaTime);
    let answer: string;
    if (r.status === "accepted") {
      answer = `✅ **Accepted.** Get the fan's payment within ${PAYMENT_WINDOW_MINUTES} minutes, then mark it paid.`;
    } else if (r.status === "declined") {
      answer = `❌ **Declined:** ${DECLINE_REASON_LABELS[r.decline_reason as DeclineReason] ?? "no reason given"}.`;
      if (times.length) answer += `\nShe's free instead: ${times.join(", ")} (Manila time)`;
    } else if (r.status === "missed") {
      answer = `🕑 **Missed it, but offered other times:** ${times.join(", ")} (Manila time)`;
    } else {
      return;
    }
    if (r.decline_note) answer += `\nHer note: "${String(r.decline_note).replace(/@/g, "@​")}"`;

    // Names come from people's own typing, so stop them pinging anyone.
    const safe = (s: unknown) => String(s ?? "").replace(/@/g, "@​").replace(/[*_`~|>]/g, "");
    await postToDiscord(
      [
        `@everyone **${safe(name)}** has responded to their video call request. Please follow up.`,
        answer,
        `Fan: ${safe(r.fan_name)} · ${r.length_minutes} min · requested by ${safe(r.requested_by_name)}`,
        `${CHATTER_PORTAL_URL}/video-calls`,
      ].join("\n")
    );
  } catch (err) {
    console.error("Couldn't announce video call response on Discord:", err);
  }
}

// Owner-only check that the webhook works. Returns a readable result.
export async function sendDiscordTest(): Promise<{ error: string | null }> {
  const url = process.env.DISCORD_VIDEO_CALL_WEBHOOK_URL;
  if (!url) return { error: "The Discord webhook isn't set up in Vercel yet (DISCORD_VIDEO_CALL_WEBHOOK_URL)." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Video Calls",
        content:
          "@everyone 🧪 **Test message** from the Creator Portal. When a creator answers a video call request, it will be posted here like this. No action needed.",
        allowed_mentions: { parse: ["everyone"] },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `Discord said ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't reach Discord." };
  }
}
