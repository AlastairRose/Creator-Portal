-- Content Planner's OnlyFans Content and Outstanding Custom sections.
-- Staff manage both; creators get read-only visibility into their own rows.

create table onlyfans_content_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  description text not null,
  logged_at date not null default current_date,
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onlyfans_content_requests_creator_id_idx on onlyfans_content_requests(creator_id);

create table outstanding_customs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  description text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  completed_at timestamptz,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outstanding_customs_creator_id_status_idx on outstanding_customs(creator_id, status);

alter table onlyfans_content_requests enable row level security;
alter table outstanding_customs enable row level security;

create policy "staff full access" on onlyfans_content_requests
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff full access" on outstanding_customs
  for all using (public.is_staff()) with check (public.is_staff());

create policy "creator selects own onlyfans requests" on onlyfans_content_requests
  for select using (creator_id = public.current_creator_id());

create policy "creator selects own customs" on outstanding_customs
  for select using (creator_id = public.current_creator_id());
