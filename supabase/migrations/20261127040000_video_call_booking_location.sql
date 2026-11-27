-- The location the chat team has for the creator (which may not be where she
-- really is), so a booked call's time is shown against that location.
alter table video_call_requests add column if not exists creator_location text;
