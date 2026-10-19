-- Video calls v2: accept -> wait for the fan to pay -> "your call is ready".
--
--   pending   waiting on the creator (20 min to reply; after that it shows
--             as "missed" until she suggests times)
--   missed    she didn't reply in time, then suggested times for the fan
--   accepted  she said yes; the chat team is getting payment (20 min)
--   ready     payment received - she's told the call is ready
--   declined  not available / price too low / doesn't want to
--   cancelled by the chat team, or because the fan didn't pay
--
-- Safe to run whether or not 20261019010000_video_call_requests.sql has
-- already been run: it creates anything missing first.

create table if not exists video_call_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  chatter_portal_creator_id text,
  requested_by_name text not null,
  requested_by_ref text,
  fan_name text not null,
  length_minutes integer not null check (length_minutes between 1 and 240),
  price_usd numeric(10, 2),
  notes text,
  timing text not null check (timing in ('asap', 'scheduled')),
  requested_for timestamptz,
  expires_at timestamptz not null,
  status text not null default 'pending',
  decline_note text,
  alternative_times timestamptz[] not null default '{}',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists video_call_requests_creator_idx on video_call_requests (creator_id, created_at desc);
create index if not exists video_call_requests_requested_by_idx on video_call_requests (requested_by_ref, created_at desc);
alter table video_call_requests enable row level security;

drop policy if exists "creator selects own video call requests" on video_call_requests;
create policy "creator selects own video call requests" on video_call_requests
  for select using (creator_id = public.current_creator_id());
drop policy if exists "staff select video call requests" on video_call_requests;
create policy "staff select video call requests" on video_call_requests
  for select using (public.is_staff());

create table if not exists chatter_portal_creator_links (
  chatter_portal_creator_id text primary key,
  creator_id uuid not null references creators(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table chatter_portal_creator_links enable row level security;

-- New columns for the payment flow and the chat team's to-do list.
alter table video_call_requests add column if not exists decline_reason text;
alter table video_call_requests add column if not exists accepted_at timestamptz;
alter table video_call_requests add column if not exists payment_deadline timestamptz;
alter table video_call_requests add column if not exists paid_at timestamptz;
alter table video_call_requests add column if not exists paid_by_name text;
alter table video_call_requests add column if not exists cancel_reason text;
alter table video_call_requests add column if not exists cancelled_by_name text;
alter table video_call_requests add column if not exists team_seen_at timestamptz;
alter table video_call_requests add column if not exists team_seen_by_name text;

-- Carry over anything answered under the first version.
update video_call_requests set status = 'declined', decline_reason = 'unavailable' where status = 'unavailable';
update video_call_requests set decline_reason = 'not_interested' where status = 'declined' and decline_reason is null;
update video_call_requests set cancel_reason = 'chatter_cancelled' where status = 'cancelled' and cancel_reason is null;
update video_call_requests set status = 'ready', paid_at = responded_at where status = 'accepted' and paid_at is null;

alter table video_call_requests drop constraint if exists video_call_requests_status_check;
alter table video_call_requests add constraint video_call_requests_status_check
  check (status in ('pending', 'missed', 'accepted', 'ready', 'declined', 'cancelled'));
alter table video_call_requests drop constraint if exists video_call_requests_decline_reason_check;
alter table video_call_requests add constraint video_call_requests_decline_reason_check
  check (decline_reason is null or decline_reason in ('unavailable', 'price_too_low', 'not_interested'));
alter table video_call_requests drop constraint if exists video_call_requests_cancel_reason_check;
alter table video_call_requests add constraint video_call_requests_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('chatter_cancelled', 'fan_didnt_pay'));
