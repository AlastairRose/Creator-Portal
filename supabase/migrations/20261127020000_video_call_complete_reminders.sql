-- Reminders to mark a paid video call complete. First one 72 hours after
-- payment (or 24 hours after the call's set time), then every 24 hours.
alter table video_call_requests add column if not exists complete_reminder_sent_at timestamptz;
alter table video_call_requests add column if not exists complete_reminder_count integer not null default 0;
