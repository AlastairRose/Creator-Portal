-- A video call request still unanswered after 12 hours gets one reminder
-- notification (e.g. it arrived while she was asleep). This records when.
alter table video_call_requests add column if not exists reminder_sent_at timestamptz;
