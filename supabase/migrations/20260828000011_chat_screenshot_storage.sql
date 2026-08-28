-- Real file upload for the "Screenshot of chat" field (instead of a pasted
-- link). Private bucket — screenshots are sensitive chat content, so they're
-- served via short-lived signed URLs generated server-side (always through
-- the service-role client), never a public bucket URL.
insert into storage.buckets (id, name, public)
values ('chat-screenshots', 'chat-screenshots', false)
on conflict (id) do nothing;

-- Column now stores the storage object path (e.g. "customs/<uuid>.jpg"),
-- not a pasted URL — renamed for clarity. Table is empty so no backfill.
alter table outstanding_customs rename column chat_screenshot_url to chat_screenshot_path;
