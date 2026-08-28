-- R&D (Research & Development): a shared library where the creative
-- director saves ideas found online (usually reels), tagged by vertical and
-- by which creators might suit them. Not scoped to one creator — staff-only,
-- same as the rest of Creative Direction.

create table rd_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_link text,
  notes text,
  vertical text,
  suitable_creator_ids uuid[] not null default '{}',
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rd_ideas_vertical_idx on rd_ideas(vertical);

alter table rd_ideas enable row level security;

create policy "staff full access" on rd_ideas
  for all using (public.is_staff()) with check (public.is_staff());
