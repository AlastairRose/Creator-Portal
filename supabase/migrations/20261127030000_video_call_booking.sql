-- The chat team books one of the times a creator suggested: a new scheduled
-- request, already accepted, waiting for the fan's payment.
alter table video_call_requests add column if not exists booked_from_request_id uuid references video_call_requests(id) on delete set null;
alter table video_call_requests add column if not exists creator_time_zone text;
