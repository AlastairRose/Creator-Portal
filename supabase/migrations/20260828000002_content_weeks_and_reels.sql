-- The weekly content-planning model: one content_week per creator per week,
-- holding a list of reels. Draft weeks are only visible to staff (the
-- Creative Direction workspace); publishing a week is what makes it show up
-- in the creator's own Content Planner.

create table content_weeks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  week_start_date date not null, -- Monday of the ISO week
  status text not null default 'draft' check (status in ('draft', 'published')),
  drive_link text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, week_start_date),
  unique (id, creator_id) -- lets reels FK on both columns together, below
);
create index content_weeks_creator_id_idx on content_weeks(creator_id);
create index content_weeks_week_start_date_idx on content_weeks(week_start_date);

create table reels (
  id uuid primary key default gen_random_uuid(),
  content_week_id uuid not null,
  creator_id uuid not null references creators(id) on delete cascade,
  foreign key (content_week_id, creator_id)
    references content_weeks(id, creator_id) on delete cascade,
  idea text not null,
  notes text,
  status text not null default 'planned'
    check (status in ('planned', 'uploaded', 'posted', 'unable_to_record', 'not_liked')),
  status_reason text,
  flagged_for_reuse boolean not null default false,
  reused_in_week_id uuid references content_weeks(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reels_content_week_id_idx on reels(content_week_id);
create index reels_creator_id_status_idx on reels(creator_id, status);

alter table content_weeks enable row level security;
alter table reels enable row level security;

create policy "staff full access" on content_weeks
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff full access" on reels
  for all using (public.is_staff()) with check (public.is_staff());

-- Creators only ever see/touch their own PUBLISHED weeks and reels.
create policy "creator selects own published weeks" on content_weeks
  for select using (creator_id = public.current_creator_id() and status = 'published');

create policy "creator updates own published week" on content_weeks
  for update using (creator_id = public.current_creator_id() and status = 'published')
  with check (creator_id = public.current_creator_id());

create policy "creator selects own published reels" on reels
  for select using (
    creator_id = public.current_creator_id()
    and exists (
      select 1 from content_weeks cw
      where cw.id = reels.content_week_id and cw.status = 'published'
    )
  );

create policy "creator updates own published reels" on reels
  for update using (
    creator_id = public.current_creator_id()
    and exists (
      select 1 from content_weeks cw
      where cw.id = reels.content_week_id and cw.status = 'published'
    )
  )
  with check (creator_id = public.current_creator_id());

-- Defense in depth: RLS row policies can't stop a creator from editing a
-- DIFFERENT column on a row they're otherwise allowed to touch (e.g.
-- flipping their own week back to 'draft', or a reel straight to 'posted').
-- These triggers let staff change anything, but restrict a non-staff
-- (creator) update to only the columns they should be able to touch.
create or replace function public.enforce_creator_reel_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    return new;
  end if;
  if new.idea is distinct from old.idea
     or new.notes is distinct from old.notes
     or new.content_week_id is distinct from old.content_week_id
     or new.creator_id is distinct from old.creator_id
     or new.flagged_for_reuse is distinct from old.flagged_for_reuse
     or new.reused_in_week_id is distinct from old.reused_in_week_id
     or new.sort_order is distinct from old.sort_order
     or new.status = 'posted' then
    raise exception 'not permitted';
  end if;
  return new;
end;
$$;
create trigger reels_creator_update_guard before update on reels
  for each row execute function public.enforce_creator_reel_update();

create or replace function public.enforce_creator_content_week_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.week_start_date is distinct from old.week_start_date
     or new.creator_id is distinct from old.creator_id
     or new.published_at is distinct from old.published_at then
    raise exception 'not permitted';
  end if;
  return new; -- only drive_link may change
end;
$$;
create trigger content_weeks_creator_update_guard before update on content_weeks
  for each row execute function public.enforce_creator_content_week_update();
