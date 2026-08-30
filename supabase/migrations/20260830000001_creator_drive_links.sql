-- Persistent, per-creator Google Drive upload links shown on the main
-- OnlyFans Content and Outstanding Customs sections of the Content Planner
-- (Reels already has its own per-week drive link on content_weeks). Staff
-- set these; creators only ever need to read them to know where to upload,
-- so there's no creator write policy.
create table creator_drive_links (
  creator_id uuid primary key references creators(id) on delete cascade,
  onlyfans_drive_link text,
  customs_drive_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table creator_drive_links enable row level security;

create policy "staff full access" on creator_drive_links
  for all using (public.is_staff()) with check (public.is_staff());

create policy "creator selects own drive links" on creator_drive_links
  for select using (creator_id = public.current_creator_id());
