-- Defaulting an unscheduled reel to today read as "already handled" and
-- risked it silently never getting posted. scheduled_for is now nullable
-- with no default — empty means genuinely not yet scheduled.
alter table winning_reels alter column scheduled_for drop not null;
alter table winning_reels alter column scheduled_for drop default;
