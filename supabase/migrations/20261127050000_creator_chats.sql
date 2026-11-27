-- Live chat between a creator and the chat team, only for custom requests,
-- video calls and helping with an ongoing fan chat. Everything else goes to
-- management in WhatsApp. Creators write from the Creator Portal; the chat
-- team replies from the Chatter Portal (through the integration API).
-- Written only by the server after its own checks.

create table creator_chats (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  topic text not null check (topic in ('chat_custom', 'chat_context', 'custom_closing', 'video_call')),
  fan_name text,
  video_call_request_id uuid references video_call_requests(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_sender text check (last_sender in ('creator', 'team')),
  creator_last_read_at timestamptz,
  team_last_read_at timestamptz,
  discord_pinged_at timestamptz,
  closed_at timestamptz,
  closed_by_name text
);
create index creator_chats_creator_id_idx on creator_chats(creator_id, last_message_at desc);
create index creator_chats_status_idx on creator_chats(status, last_message_at desc);

create table creator_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references creator_chats(id) on delete cascade,
  sender text not null check (sender in ('creator', 'team', 'system')),
  sender_name text,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index creator_chat_messages_chat_id_idx on creator_chat_messages(chat_id, created_at);

alter table creator_chats enable row level security;
alter table creator_chat_messages enable row level security;
create policy "creator reads own chats" on creator_chats
  for select using (creator_id = public.current_creator_id());
create policy "staff read chats" on creator_chats
  for select using (public.is_staff());
create policy "creator reads own chat messages" on creator_chat_messages
  for select using (exists (select 1 from creator_chats c where c.id = chat_id and c.creator_id = public.current_creator_id()));
create policy "staff read chat messages" on creator_chat_messages
  for select using (public.is_staff());

-- The 1-hour-before reminder for a booked call, and her "I'll be there".
alter table video_call_requests add column if not exists attendance_reminder_sent_at timestamptz;
alter table video_call_requests add column if not exists attendance_confirmed_at timestamptz;
