import { createAdminClient } from "@/lib/supabase/admin";
import { postToDiscord, discordSafe } from "@/lib/discord";
import { notifyCreator } from "@/lib/push";

// Server-only helpers for the creator <-> chat team live chat.

export type ChatTopic = "chat_custom" | "chat_context" | "custom_closing" | "video_call";

export const CHAT_TOPIC_LABELS: Record<ChatTopic, string> = {
  chat_custom: "Helping close a custom in a fan chat",
  chat_context: "Details or context for a fan chat",
  custom_closing: "A fan chat closing a custom",
  video_call: "A video call",
};

export type CreatorChat = {
  id: string;
  creator_id: string;
  topic: ChatTopic;
  fan_name: string | null;
  video_call_request_id: string | null;
  status: "open" | "closed";
  created_at: string;
  last_message_at: string;
  last_sender: "creator" | "team" | null;
  creator_last_read_at: string | null;
  team_last_read_at: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender: "creator" | "team" | "system";
  sender_name: string | null;
  body: string;
  created_at: string;
};

export const CHAT_COLUMNS =
  "id, creator_id, topic, fan_name, video_call_request_id, status, created_at, last_message_at, last_sender, creator_last_read_at, team_last_read_at, closed_at, closed_by_name";
export const MESSAGE_COLUMNS = "id, chat_id, sender, sender_name, body, created_at";

const CHATTER_PORTAL_URL = (process.env.CHATTER_PORTAL_URL || "https://chatter-portal.vercel.app").replace(/\/+$/, "");
// Don't @everyone the team for every line of a back-and-forth.
const DISCORD_PING_GAP_MS = 10 * 60_000;

export function cleanMessage(body: unknown): string {
  return typeof body === "string" ? body.replace(/\r\n/g, "\n").trim().slice(0, 4000) : "";
}

export async function addMessage(
  chatId: string,
  sender: ChatMessage["sender"],
  senderName: string | null,
  body: string
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("creator_chat_messages").insert({ chat_id: chatId, sender, sender_name: senderName, body });
  if (error) return { error: error.message };
  if (sender !== "system") {
    const readField = sender === "creator" ? { creator_last_read_at: now } : { team_last_read_at: now };
    await admin
      .from("creator_chats")
      .update({ last_message_at: now, last_sender: sender, status: "open", closed_at: null, closed_by_name: null, ...readField })
      .eq("id", chatId);
  }
  return { error: null };
}

// "@everyone Lola has messaged the chat team about a video call."
export async function pingTeamAboutChat(chatId: string, preview: string, isNew: boolean): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: chat } = await admin.from("creator_chats").select("creator_id, topic, fan_name, discord_pinged_at").eq("id", chatId).maybeSingle();
    if (!chat) return;
    const last = chat.discord_pinged_at ? new Date(chat.discord_pinged_at).getTime() : 0;
    if (!isNew && Date.now() - last < DISCORD_PING_GAP_MS) return;
    // Claim the ping so two quick messages don't both post.
    const claim = admin.from("creator_chats").update({ discord_pinged_at: new Date().toISOString() }).eq("id", chatId);
    const { data: claimed } = await (chat.discord_pinged_at ? claim.eq("discord_pinged_at", chat.discord_pinged_at) : claim.is("discord_pinged_at", null)).select("id");
    if (!claimed?.length) return;

    const { data: creator } = await admin.from("creators").select("name").eq("id", chat.creator_id).maybeSingle();
    const name = discordSafe(creator?.name ?? "A creator");
    const topic = CHAT_TOPIC_LABELS[chat.topic as ChatTopic] ?? "a chat";
    const short = preview.length > 300 ? `${preview.slice(0, 300)}…` : preview;
    await postToDiscord(
      [
        `@everyone **${name}** ${isNew ? "has started a chat with the chat team" : "has sent the chat team a message"}: ${topic.toLowerCase()}${
          chat.fan_name ? ` (fan: ${discordSafe(chat.fan_name)})` : ""
        }.`,
        `> ${discordSafe(short).replace(/\n/g, "\n> ")}`,
        `Reply in the Chatter Portal: ${CHATTER_PORTAL_URL}/creator-chats`,
      ].join("\n")
    );
  } catch (err) {
    console.error("Couldn't ping Discord about a creator chat:", err);
  }
}

export async function notifyCreatorOfReply(chatId: string, creatorId: string): Promise<void> {
  // Kept neutral on purpose: this shows on the creator's lock screen.
  await notifyCreator(creatorId, {
    title: "New message from the chat team",
    body: "Tap to read and reply.",
    url: `/chat-team?chat=${chatId}`,
    tag: `creator-chat-${chatId}`,
  });
}

// A short summary of a video call, posted into a chat about it.
export async function videoCallSummary(videoCallId: string, creatorId: string): Promise<string | null> {
  const { data: r } = await createAdminClient()
    .from("video_call_requests")
    .select("creator_id, fan_name, length_minutes, price_usd, timing, requested_for, status")
    .eq("id", videoCallId)
    .maybeSingle();
  if (!r || r.creator_id !== creatorId) return null;
  const when =
    r.timing === "scheduled" && r.requested_for
      ? new Date(r.requested_for).toLocaleString("en-GB", { timeZone: "Asia/Manila", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) + " Manila time"
      : "ASAP";
  const price = r.price_usd !== null ? ` · $${Number(r.price_usd).toFixed(2)}` : "";
  return `About the video call with ${r.fan_name}: ${r.length_minutes} min${price} · ${when} · status: ${r.status}.`;
}
