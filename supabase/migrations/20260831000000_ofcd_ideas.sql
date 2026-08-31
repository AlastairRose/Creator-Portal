-- OFCD: a staff-only bank of OnlyFans content ideas, mirroring the shape of
-- a real onlyfans_content_requests row (same content types, same sexting
-- checklist), except not yet tied to a creator. An idea gets "Added to a
-- creator's plan" by copying its fields into a real request row (see
-- createOfcdIdeaFromRequest / pushOfcdIdeaToCreator) — pushing never
-- deletes the idea, same reuse-not-move pattern as R&D/Ideas.
create table ofcd_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_type text not null default 'other'
    check (content_type in ('sexting', 'ppv', 'wall_posts', 'voice_notes', 'day_to_day', 'other')),
  description text,
  length text,
  sexting_drive_link text,
  sexting_storyline text,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ofcd_ideas enable row level security;

create policy "staff full access" on ofcd_ideas
  for all using (public.is_staff()) with check (public.is_staff());

create table ofcd_idea_sexting_items (
  id uuid primary key default gen_random_uuid(),
  ofcd_idea_id uuid not null references ofcd_ideas(id) on delete cascade,
  content_label text not null,
  description text,
  length text,
  creator_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ofcd_idea_sexting_items_idea_id_idx on ofcd_idea_sexting_items(ofcd_idea_id);

alter table ofcd_idea_sexting_items enable row level security;

create policy "staff full access" on ofcd_idea_sexting_items
  for all using (public.is_staff()) with check (public.is_staff());
