-- 15 minutes before a booked call she hasn't confirmed: warn the chat team
-- in Discord and nudge her once more. Recorded so it only happens once.
alter table video_call_requests add column if not exists no_confirm_alert_sent_at timestamptz;
