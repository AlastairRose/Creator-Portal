-- "Ideas": a second shared idea library alongside R&D, for original ideas
-- (rather than R&D's "found online") and for creators to submit their own.
-- Same shape as rd_ideas (mirrors Reel's fields), plus
-- submitted_by_creator_id so staff can tell a creator's own submission
-- apart from one staff added directly.
create table ideas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  idea text,
  inspo_link text,
  required_shots text,
  hook text,
  outfit text,
  location text,
  filming_style text,
  editing_notes text,
  posting_notes text,
  vertical text,
  suitable_creator_ids uuid[] not null default '{}',
  submitted_by_creator_id uuid references creators(id) on delete set null,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_vertical_idx on ideas(vertical);

alter table ideas enable row level security;

create policy "staff full access" on ideas
  for all using (public.is_staff()) with check (public.is_staff());

-- A creator can submit their own idea, but never read the library back
-- (matches Winning Ideas: staff-only visibility, RLS default-denies select).
create policy "creator submits own idea" on ideas
  for insert with check (submitted_by_creator_id = public.current_creator_id());
