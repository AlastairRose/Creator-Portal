-- Per-creator "Overall Plan" set by the creative director: agreed weekly
-- reel target (drives the planned-vs-agreed count on the Reel Planner tab),
-- niche/branding description, and the list of verticals the creator has
-- agreed to make. Staff-only, same as the rest of Creative Direction — no
-- creator-facing policy, so RLS default-denies creators entirely.

create table creator_plans (
  creator_id uuid primary key references creators(id) on delete cascade,
  agreed_reels_per_week integer,
  niche_branding text,
  verticals_agreed text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table creator_plans enable row level security;

create policy "staff full access" on creator_plans
  for all using (public.is_staff()) with check (public.is_staff());
