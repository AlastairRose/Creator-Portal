"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/roles";
import {
  addMessage,
  CHAT_COLUMNS,
  cleanMessage,
  MESSAGE_COLUMNS,
  pingTeamAboutChat,
  videoCallSummary,
  type ChatMessage,
  type ChatTopic,
  type CreatorChat,
} from "@/lib/creator-chats";

// The creator's side of the live chat with the chat team.

const TOPICS: ChatTopic[] = ["chat_custom", "chat_context", "custom_closing", "video_call"];

async function me() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "creator" || !profile.creator_id) return null;
  return { profile, creatorId: profile.creator_id };
}

async function ownChat(chatId: string, creatorId: string): Promise<CreatorChat | null> {
  const { data } = await createAdminClient().from("creator_chats").select(CHAT_COLUMNS).eq("id", chatId).maybeSingle();
  return data && data.creator_id === creatorId ? (data as CreatorChat) : null;
}

export async function startCreatorChat(input: {
  topic: ChatTopic;
  fanName?: string;
  videoCallId?: string | null;
  message: string;
}): Promise<{ error: string | null; chatId?: string }> {
  const who = await me();
  if (!who) return { error: "Only creators can start a chat with the chat team." };
  if (!TOPICS.includes(input.topic)) return { error: "Pick what it's about." };
  const message = cleanMessage(input.message);
  if (!message) return { error: "Type your message first." };
  const fanName = (input.fanName ?? "").trim().slice(0, 120) || null;

  const admin = createAdminClient();
  let videoCallId: string | null = null;
  let summary: string | null = null;
  if (input.videoCallId) {
    summary = await videoCallSummary(input.videoCallId, who.creatorId);
    if (summary) videoCallId = input.videoCallId;
  }

  const { data: chat, error } = await admin
    .from("creator_chats")
    .insert({ creator_id: who.creatorId, topic: input.topic, fan_name: fanName, video_call_request_id: videoCallId })
    .select("id")
    .single();
  if (error || !chat) return { error: error?.message ?? "Couldn't start the chat." };

  if (summary) await addMessage(chat.id, "system", null, summary);
  const sent = await addMessage(chat.id, "creator", who.profile.display_name ?? null, message);
  if (sent.error) return { error: sent.error };
  await pingTeamAboutChat(chat.id, message, true);
  return { error: null, chatId: chat.id };
}

export async function sendCreatorMessage(chatId: string, body: string): Promise<{ error: string | null }> {
  const who = await me();
  if (!who) return { error: "Only creators can send this." };
  const chat = await ownChat(chatId, who.creatorId);
  if (!chat) return { error: "Chat not found." };
  const message = cleanMessage(body);
  if (!message) return { error: "Type your message first." };
  const sent = await addMessage(chatId, "creator", who.profile.display_name ?? null, message);
  if (sent.error) return sent;
  await pingTeamAboutChat(chatId, message, false);
  return { error: null };
}

export async function closeCreatorChat(chatId: string): Promise<{ error: string | null }> {
  const who = await me();
  if (!who) return { error: "Only creators can do this." };
  const chat = await ownChat(chatId, who.creatorId);
  if (!chat) return { error: "Chat not found." };
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("creator_chats")
    .update({ status: "closed", closed_at: now, closed_by_name: who.profile.display_name ?? "Creator" })
    .eq("id", chatId);
  if (error) return { error: error.message };
  await addMessage(chatId, "system", null, "Chat closed by the creator.");
  return { error: null };
}

// Polled by the chat screen every few seconds.
export async function loadMyChats(openChatId?: string | null): Promise<{
  error: string | null;
  chats: (CreatorChat & { unread: boolean })[];
  messages: ChatMessage[];
}> {
  const who = await me();
  if (!who) return { error: "Only creators can see this.", chats: [], messages: [] };
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 3600e3).toISOString();
  const { data: chats, error } = await admin
    .from("creator_chats")
    .select(CHAT_COLUMNS)
    .eq("creator_id", who.creatorId)
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (error) return { error: error.message, chats: [], messages: [] };

  let messages: ChatMessage[] = [];
  const open = openChatId ? (chats ?? []).find((c) => c.id === openChatId) : null;
  if (open) {
    const { data } = await admin.from("creator_chat_messages").select(MESSAGE_COLUMNS).eq("chat_id", open.id).order("created_at").limit(500);
    messages = (data ?? []) as ChatMessage[];
    // Reading it counts as seen.
    if (open.last_sender === "team" && (!open.creator_last_read_at || open.creator_last_read_at < open.last_message_at)) {
      const now = new Date().toISOString();
      await admin.from("creator_chats").update({ creator_last_read_at: now }).eq("id", open.id);
      open.creator_last_read_at = now;
    }
  }

  return {
    error: null,
    chats: ((chats ?? []) as CreatorChat[]).map((c) => ({
      ...c,
      unread: c.last_sender === "team" && (!c.creator_last_read_at || c.creator_last_read_at < c.last_message_at),
    })),
    messages,
  };
}

// Her recent video calls, to pick which one a chat is about.
export async function loadMyRecentVideoCalls(): Promise<{ id: string; label: string }[]> {
  const who = await me();
  if (!who) return [];
  const { data } = await createAdminClient()
    .from("video_call_requests")
    .select("id, fan_name, length_minutes, status, created_at")
    .eq("creator_id", who.creatorId)
    .gte("created_at", new Date(Date.now() - 14 * 24 * 3600e3).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    label: `${r.fan_name} · ${r.length_minutes} min · ${String(r.status).replace("_", " ")}`,
  }));
}
