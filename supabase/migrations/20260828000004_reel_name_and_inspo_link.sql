-- `name` is the short label used when sharing a collapsed summary on the
-- Content Planner (Name, Vertical, Inspo Link, Outfit/Location, click to
-- reveal full detail). `inspo_link` is a reference link to a similar reel,
-- shown separately from the free-text `idea` field.

alter table reels add column name text not null;
alter table reels add column inspo_link text;
