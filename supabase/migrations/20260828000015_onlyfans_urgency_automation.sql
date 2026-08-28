-- Reworks OnlyFans Content to match the founder's real Airtable base and
-- automate its due tag instead of a manually-typed due date:
--
--   urgency: 'highly_requested' (defaults to a 7-day target) |
--            'complete_when_possible' (14-day target) | 'not_required' (no tag)
--   urgency_set_at: when the urgency was last (re)set — the anchor the
--     7/14-day target counts from. Reset to now() only when urgency
--     actually changes, not on every edit, so escalating something from
--     "not required" to "highly requested" gives it a fresh 7 days rather
--     than treating it as already overdue.
--
-- The due tag itself (Due in the next 2 weeks / Due this week / Due in 3
-- days / Due today / Overdue) is never stored — always computed live from
-- urgency + urgency_set_at, same lesson learned from Outstanding Customs'
-- due-date precision bug.

alter table onlyfans_content_requests add column urgency_set_at timestamptz not null default now();
alter table onlyfans_content_requests drop column logged_at;

alter table onlyfans_content_requests alter column urgency drop default;
alter table onlyfans_content_requests drop constraint onlyfans_content_requests_urgency_check;
alter table onlyfans_content_requests add constraint onlyfans_content_requests_urgency_check
  check (urgency in ('highly_requested', 'complete_when_possible', 'not_required'));
alter table onlyfans_content_requests alter column urgency set default 'complete_when_possible';
