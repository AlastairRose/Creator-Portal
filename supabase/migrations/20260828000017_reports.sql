-- Weekly/monthly creator reports. % reels completed and % revenue change
-- are never stored — computed at render time (from reels/content_weeks in
-- range, and from the prior report of the same period_type, respectively).
create table reports (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  period_type text not null check (period_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  revenue numeric(12, 2),
  went_well text,
  can_improve text,
  next_plan text,
  generated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, period_type, period_start)
);
create index reports_creator_id_idx on reports(creator_id, period_type, period_start desc);

alter table reports enable row level security;

create policy "staff full access" on reports
  for all using (public.is_staff()) with check (public.is_staff());

create policy "creator selects own reports" on reports
  for select using (creator_id = public.current_creator_id());
