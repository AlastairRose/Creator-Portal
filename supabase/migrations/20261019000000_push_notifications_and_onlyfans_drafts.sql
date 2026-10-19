-- 1) Phone (web push) notifications for creators. One row per device a user
--    has turned notifications on for. Only ever read/written by the server
--    with the service-role key, so RLS is on with no policies.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_profile_id_idx on push_subscriptions(profile_id);
alter table push_subscriptions enable row level security;

-- 2) OnlyFans requests start as drafts staff can build up, then publish as
--    one list (one notification). Drafts are invisible to creators.
alter table onlyfans_content_requests add column draft boolean not null default false;
alter table onlyfans_content_requests add column published_at timestamptz;

drop policy "creator selects own onlyfans requests" on onlyfans_content_requests;
create policy "creator selects own onlyfans requests" on onlyfans_content_requests
  for select using (creator_id = public.current_creator_id() and draft = false);

drop policy "creator selects own required sexting items" on onlyfans_sexting_items;
create policy "creator selects own required sexting items" on onlyfans_sexting_items
  for select using (
    creator_required = true
    and exists (
      select 1 from onlyfans_content_requests r
      where r.id = request_id and r.creator_id = public.current_creator_id() and r.draft = false
    )
  );
