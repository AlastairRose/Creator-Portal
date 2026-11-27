"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  closeCreatorChat,
  loadMyChats,
  loadMyRecentVideoCalls,
  sendCreatorMessage,
  startCreatorChat,
} from "@/lib/actions/creator-chats";
import type { ChatMessage, ChatTopic, CreatorChat } from "@/lib/creator-chats";

// The creator's "Message the Chat Team" screen. A few questions first: only
// customs, video calls and helping with a fan chat open a live chat. Anything
// else is pointed to management in WhatsApp, because management, not the
// creator, manages the chatters.

const POLL_MS = 4000;

const TOPIC_LABELS: Record<ChatTopic, string> = {
  chat_custom: "Helping close a custom in a fan chat",
  chat_context: "Details or context for a fan chat",
  custom_closing: "A fan chat closing a custom",
  video_call: "A video call",
};

type Step =
  | { kind: "question"; id: string; question: string; options: { label: string; next: Step }[] }
  | { kind: "whatsapp"; message: string }
  | { kind: "chat"; topic: ChatTopic; prompt: string };

const WHATSAPP_MANAGEMENT: Step = {
  kind: "whatsapp",
  message: "Anything else goes to management. Please message them in your WhatsApp group.",
};

const TREE: Step = {
  kind: "question",
  id: "root",
  question: "What would you like help with?",
  options: [
    {
      label: "Marketing (reels, posting, accounts)",
      next: {
        kind: "whatsapp",
        message: "For anything about reels, posting or your accounts, please raise it with your creative director or management in your WhatsApp group.",
      },
    },
    {
      label: "A fan chat",
      next: {
        kind: "question",
        id: "chatting",
        question: "What about the chatting?",
        options: [
          {
            label: "The chatter doesn't sound like me",
            next: {
              kind: "whatsapp",
              message: "Please raise this with management in your WhatsApp group. They'll work on it with the chat team.",
            },
          },
          {
            label: "I'd like to help close a custom in an ongoing chat",
            next: { kind: "chat", topic: "chat_custom", prompt: "Tell the chatter how you'd like to help close it." },
          },
          {
            label: "I'd like to give the chatter details or context on an ongoing chat",
            next: { kind: "chat", topic: "chat_context", prompt: "What should the chatter know?" },
          },
          { label: "Something else about the chatting", next: WHATSAPP_MANAGEMENT },
        ],
      },
    },
    {
      label: "Custom requests",
      next: {
        kind: "question",
        id: "customs",
        question: "What about custom requests?",
        options: [
          {
            label: "I can't complete a custom",
            next: {
              kind: "whatsapp",
              message: "Please raise this in your WhatsApp group, or message Shona privately if you'd prefer.",
            },
          },
          {
            label: "I can see a chat closing a custom and want to speak with the chatter",
            next: { kind: "chat", topic: "custom_closing", prompt: "What would you like to tell the chatter?" },
          },
        ],
      },
    },
    {
      label: "Video calls",
      next: {
        kind: "question",
        id: "calls",
        question: "What about video calls?",
        options: [
          {
            label: "I'd like to suggest times or discuss a video call sale",
            next: { kind: "chat", topic: "video_call", prompt: "What would you like to tell the chatter?" },
          },
          {
            label: "I need to cancel or change a booked video call",
            next: {
              kind: "whatsapp",
              message: "Please raise this in your WhatsApp group, so management can sort it out with the fan.",
            },
          },
        ],
      },
    },
    { label: "Something else", next: WHATSAPP_MANAGEMENT },
  ],
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
  prefill,
}: {
  initialChatId: string | null;
  prefill: { topic: ChatTopic; videoCallId: string | null; message: string } | null;
}) {
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [path, setPath] = useState<Step[] | null>(
    prefill ? [TREE, { kind: "chat", topic: prefill.topic, prompt: "What would you like to tell the chat team?" }] : null
  );
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

  if (path) {
    return (
      <Wizard
        path={path}
        setPath={setPath}
        prefill={prefill}
        onStarted={(id) => {
          setPath(null);
          setOpenId(id);
        }}
      />
    );
  }

  const openChats = (chats ?? []).filter((c) => c.status === "open");
  const closedChats = (chats ?? []).filter((c) => c.status === "closed");

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => setPath([TREE])}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 sm:w-auto sm:self-start"
      >
        Start a new message
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {chats === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : chats.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">No messages yet.</p>
      ) : (
        <>
          {openChats.length > 0 && <ChatList title="Open" chats={openChats} onOpen={setOpenId} />}
          {closedChats.length > 0 && <ChatList title="Closed" chats={closedChats} onOpen={setOpenId} />}
        </>
      )}
    </div>
  );
}

function ChatList({ title, chats, onOpen }: { title: string; chats: ChatRow[]; onOpen: (id: string) => void }) {
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
            <span className="block truncate text-sm font-medium">{TOPIC_LABELS[c.topic]}</span>
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

function Wizard({
  path,
  setPath,
  prefill,
  onStarted,
}: {
  path: Step[];
  setPath: (p: Step[] | null) => void;
  prefill: { topic: ChatTopic; videoCallId: string | null; message: string } | null;
  onStarted: (chatId: string) => void;
}) {
  const step = path[path.length - 1];
  const back = () => setPath(path.length > 1 ? path.slice(0, -1) : null);

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={back} className="self-start text-xs text-muted hover:underline">
        ← Back
      </button>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        {step.kind === "question" && (
          <>
            <h2 className="text-base font-semibold">{step.question}</h2>
            {step.options.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setPath([...path, o.next])}
                className="w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-left text-sm hover:border-accent"
              >
                {o.label}
              </button>
            ))}
          </>
        )}
        {step.kind === "whatsapp" && (
          <>
            <h2 className="text-base font-semibold">Message management</h2>
            <p className="text-sm">{step.message}</p>
            <p className="text-xs text-muted">
              The chat team can help with custom requests, video calls and fan chats. Management looks after everything else.
            </p>
            <button type="button" onClick={() => setPath(null)} className="self-start text-sm font-medium text-accent hover:underline">
              Done
            </button>
          </>
        )}
        {step.kind === "chat" && <Compose topic={step.topic} prompt={step.prompt} prefill={prefill} onStarted={onStarted} />}
      </section>
    </div>
  );
}

function Compose({
  topic,
  prompt,
  prefill,
  onStarted,
}: {
  topic: ChatTopic;
  prompt: string;
  prefill: { topic: ChatTopic; videoCallId: string | null; message: string } | null;
  onStarted: (chatId: string) => void;
}) {
  const [fanName, setFanName] = useState("");
  const [videoCallId, setVideoCallId] = useState(prefill?.topic === topic ? prefill.videoCallId ?? "" : "");
  const [calls, setCalls] = useState<{ id: string; label: string }[]>([]);
  const [message, setMessage] = useState(prefill?.topic === topic ? prefill.message : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (topic !== "video_call") return;
    loadMyRecentVideoCalls().then(setCalls).catch(() => setCalls([]));
  }, [topic]);

  return (
    <>
      <h2 className="text-base font-semibold">{TOPIC_LABELS[topic]}</h2>
      <p className="text-xs text-muted">
        This goes to the chat team on shift. They&apos;ll reply here, and you&apos;ll get a notification.
      </p>
      {topic === "video_call" ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Which video call? (optional)
          <select
            id="chat-video-call"
            value={videoCallId}
            onChange={(e) => setVideoCallId(e.target.value)}
            className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground"
          >
            <option value="">Not about a specific one</option>
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Fan&apos;s name or username (helps the chatter find the chat)
          <input
            id="chat-fan-name"
            value={fanName}
            onChange={(e) => setFanName(e.target.value)}
            maxLength={120}
            autoCapitalize="none"
            className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        {prompt}
        <textarea
          id="chat-first-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startCreatorChat({ topic, fanName, videoCallId: videoCallId || null, message });
            if (result.error || !result.chatId) setError(result.error ?? "Couldn't send that.");
            else onStarted(result.chatId);
          })
        }
        className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send to the chat team"}
      </button>
    </>
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
          <h2 className="text-base font-semibold">{TOPIC_LABELS[chat.topic]}</h2>
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
