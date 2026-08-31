-- "ANT-ena": a bank of upcoming worldwide cultural/entertainment/sporting
-- events the creative director can browse to plan content ideas around.
-- Entries can be added manually (land as 'confirmed' immediately) or found
-- by the weekly AI web-search job (land as 'suggested', needing a staff
-- glance before they're trusted) — see lib/cultural-events-search.ts.
create table cultural_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_end_date date,
  category text,
  regions text[] not null default '{}',
  description text,
  status text not null default 'confirmed' check (status in ('suggested', 'confirmed', 'dismissed')),
  source text not null default 'manual' check (source in ('manual', 'ai_suggested')),
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cultural_events_event_date_idx on cultural_events(event_date);

alter table cultural_events enable row level security;

create policy "staff full access" on cultural_events
  for all using (public.is_staff()) with check (public.is_staff());
