-- Creators give the agency partner access to their Instagram / Facebook in
-- Meta Business Suite. The portal walks them through it; this records where
-- each creator is up to. Written by the server only (service role).

alter table onboarding_settings add column if not exists meta_business_id text;

create table creator_meta_access (
  creator_id uuid primary key references creators(id) on delete cascade,
  instagram_handle text,
  status text not null check (status in ('submitted', 'help', 'confirmed')),
  help_message text,
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table creator_meta_access enable row level security;
create policy "staff read meta access" on creator_meta_access
  for select using (public.is_staff());
create policy "creator reads own meta access" on creator_meta_access
  for select using (creator_id = public.current_creator_id());
