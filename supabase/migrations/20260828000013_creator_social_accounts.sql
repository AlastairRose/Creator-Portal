-- Per-creator social account tracking for the Overall Plan tab: which
-- platforms are active, whether each is run by an autoposter or an account
-- manager, and a link to the profile. Staff-only, same as the rest of
-- Creative Direction — no creator-facing policy, so RLS default-denies
-- creators entirely.

create table creator_social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'tiktok', 'twitter', 'youtube')),
  is_active boolean not null default false,
  managed_by text check (managed_by in ('autoposter', 'account_manager')),
  profile_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, platform)
);
create index creator_social_accounts_creator_id_idx on creator_social_accounts(creator_id);

alter table creator_social_accounts enable row level security;

create policy "staff full access" on creator_social_accounts
  for all using (public.is_staff()) with check (public.is_staff());
