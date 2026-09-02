-- Bring back a "last posted" record alongside scheduled_for: scheduled_for
-- is the forward-looking next repost date, this tracks when it was
-- actually last posted (nullable — never posted yet for a fresh entry).
alter table winning_reels add column last_posted_date date;
