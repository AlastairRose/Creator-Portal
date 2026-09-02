-- Reposts are scheduled in advance, not posted same-day — "last posted
-- date" (auto-set to today on a click) wasn't a practical fit. Renamed to
-- reflect a forward-looking scheduled date staff pick directly, rather than
-- a same-day mark-as-done action. Existing values carry over as-is.
alter table winning_reels rename column last_posted_date to scheduled_for;
