-- Creators mark a paid video call as completed, with notes for the chat
-- team to update the fan's notes.
alter table video_call_requests add column if not exists completed_at timestamptz;
alter table video_call_requests add column if not exists completion_notes text;
alter table video_call_requests drop constraint if exists video_call_requests_status_check;
alter table video_call_requests add constraint video_call_requests_status_check
  check (status in ('pending', 'missed', 'accepted', 'ready', 'completed', 'declined', 'cancelled'));
