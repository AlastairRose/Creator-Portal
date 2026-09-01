-- "Winning 30": a per-creator bank of previously winning reels worth
-- reposting. Sorted by last_posted_date ascending wherever it's read (see
-- getWinningReels) so the most overdue-for-a-repost sits at the top and
-- whatever was just reposted drops to the bottom.
create table winning_reels (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  title text not null,
  original_link text,
  footage_link text,
  last_posted_date date not null default current_date,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index winning_reels_creator_id_idx on winning_reels(creator_id);

alter table winning_reels enable row level security;

create policy "staff full access" on winning_reels
  for all using (public.is_staff()) with check (public.is_staff());
