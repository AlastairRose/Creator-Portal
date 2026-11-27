"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  closeCreatorChat,
  loadMyChats,
  loadMyRecentVideoCalls,
  sendCreatorMessage,
  startCreatorChat,
} from "@/lib/actions/creator-chats";
import type { ChatMessage, CreatorChat } from "@/lib/creator-chats";

// A creator's messages with the chat team. She can only start one from a
// video call request (the "Message the chat team about this call" link on
// the call), so it stays about video calls. Everything else goes to
// management in WhatsApp.

const POLL_MS = 4000;

const TOPIC_LABELS: Record<string, string> = {
  chat_custom: "Helping close a custom in a fan chat",
  chat_context: "Details or context for a fan chat",
  custom_closing: "A fan chat closing a custom",
  video_call: "A video call",
};

type ChatRow = CreatorChat & { unread: boolean };

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ChatTeam({
  initialChatId,
  callId,
  changeTime,
}: {
  initialChatId: string | null;
  callId: string | null;
  changeTime: boolean;
}) {
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialChatId);
  const [composeFor, setComposeFor] = useState<string | null>(callId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await loadMyChats(openId);
    if (result.error) setError(result.error);
    setChats(result.chats);
    setMessages(result.messages);
  }, [openId]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  // Coming from a call: carry on its open chat if there is one.
  const existingForCall = composeFor && chats ? chats.find((c) => c.video_call_request_id === composeFor && c.status === "open") : null;
  useEffect(() => {
    if (!existingForCall) return;
    const t = setTimeout(() => {
      setOpenId(existingForCall.id);
      setComposeFor(null);
    }, 0);
    return () => clearTimeout(t);
  }, [existingForCall]);

  const openChat = chats?.find((c) => c.id === openId) ?? null;

  if (openId) {
    return (
      <Thread
        chat={openChat}
        messages={messages}
        onBack={() => {
          setOpenId(null);
          setMessages([]);
        }}
        onChanged={refresh}
      />
    );
  }

  if (composeFor) {
    if (chats === null) return <p className="text-sm text-muted">Loading…</p>;
    return (
      <Compose
        callId={composeFor}
        startText={changeTime ? "I need to change the time of this call. Could we move it to: " : ""}
        onCancel={() => setComposeFor(null)}
        onStarted={(id) => {
          setComposeFor(null);
          setOpenId(id);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        To message the chat team, open a video call request in your Content Planner and tap{" "}
        <strong className="text-foreground">Message the chat team about this call</strong>.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {chats === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : chats.length === 0 ? null : (
        <>
          <ChatList title="Open" chats={chats.filter((c) => c.status === "open")} onOpen={setOpenId} />
          <ChatList title="Closed" chats={chats.filter((c) => c.status === "closed")} onOpen={setOpenId} />
        </>
      )}
    </div>
  );
}

function ChatList({ title, chats, onOpen }: { title: string; chats: ChatRow[]; onOpen: (id: string) => void }) {
  if (chats.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      {chats.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onOpen(c.id)}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-left hover:border-accent"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{TOPIC_LABELS[c.topic] ?? "A chat"}</span>
            <span className="block truncate text-xs text-muted">
              {c.fan_name ? `Fan: ${c.fan_name} · ` : ""}
              {timeLabel(c.last_message_at)}
            </span>
          </span>
          {c.unread && <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white">New reply</span>}
        </button>
      ))}
    </section>
  );
}

function Compose({
  callId,
  startText,
  onCancel,
  onStarted,
}: {
  callId: string;
  startText: string;
  onCancel: () => void;
  onStarted: (chatId: string) => void;
}) {
  const [label, setLabel] = useState<string | null>(null);
  const [message, setMessage] = useState(startText);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadMyRecentVideoCalls()
      .then((calls) => setLabel(calls.find((c) => c.id === callId)?.label ?? null))
      .catch(() => setLabel(null));
  }, [callId]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <button type="button" onClick={onCancel} className="self-start text-xs text-muted hover:underline">
        ← Back
      </button>
      <h2 className="text-base font-semibold">Message the chat team about this call</h2>
      {label && <p className="text-sm text-muted">{label}</p>}
      <p className="text-xs text-muted">
        For suggesting times or anything about this video call. They&apos;ll reply here, and you&apos;ll get a
        notification. For anything else, message management in your WhatsApp group.
      </p>
      <textarea
        id="chat-first-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="What would you like the chat team to know?"
        className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending || !message.trim()}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startCreatorChat({ topic: "video_call", videoCallId: callId, message });
            if (result.error || !result.chatId) setError(result.error ?? "Couldn't send that.");
            else onStarted(result.chatId);
          })
        }
        className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send to the chat team"}
      </button>
    </section>
  );
}

function Thread({
  chat,
  messages,
  onBack,
  onChanged,
}: {
  chat: ChatRow | null;
  messages: ChatMessage[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    if (!chat) return;
    const body = text;
    startTransition(async () => {
      setError(null);
      const result = await sendCreatorMessage(chat.id, body);
      if (result.error) setError(result.error);
      else {
        setText("");
        onChanged();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:underline">
          ← All messages
        </button>
        {chat?.status === "open" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await closeCreatorChat(chat.id);
                if (result.error) setError(result.error);
                else onChanged();
              })
            }
            className="text-xs text-muted hover:underline"
          >
            Close chat
          </button>
        )}
      </div>
      {chat && (
        <div>
          <h2 className="text-base font-semibold">{TOPIC_LABELS[chat.topic] ?? "A chat"}</h2>
          {chat.fan_name && <p className="text-xs text-muted">Fan: {chat.fan_name}</p>}
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        {messages.length === 0 && <p className="p-4 text-center text-sm text-muted">Loading…</p>}
        {messages.map((m) =>
          m.sender === "system" ? (
            <p key={m.id} className="px-2 py-1 text-center text-xs text-muted">
              {m.body}
            </p>
          ) : (
            <div key={m.id} className={`flex flex-col gap-0.5 ${m.sender === "creator" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.sender === "creator" ? "bg-accent text-white" : "bg-surface-raised"
                }`}
              >
                {m.body}
              </div>
              <span className="px-1 text-[11px] text-muted">
                {m.sender === "team" ? `${m.sender_name ?? "Chat team"} · ` : ""}
                {timeLabel(m.created_at)}
              </span>
            </div>
          )
        )}
        <div ref={bottom} />
      </div>
      {chat?.status === "closed" && <p className="text-xs text-muted">This chat is closed. Sending a message opens it again.</p>}
      <div className="flex flex-col gap-2">
        <textarea
          id="chat-reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Type a message"
          className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          disabled={pending || !text.trim() || !chat}
          onClick={send}
          className="self-end rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
