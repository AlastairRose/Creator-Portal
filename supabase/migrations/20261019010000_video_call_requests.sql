-- Video call requests sent from the Chatter Portal. A chatter asks; the
-- creator gets a phone notification and accepts, says "not available now"
-- with up to 3 times they could do instead, or declines outright.
--
-- Written only by the server (service-role key) after its own checks:
-- the Chatter Portal via /api/integrations/video-calls (shared secret), and
-- creators via the respondToVideoCall server action. Reads go through RLS.

create table video_call_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  chatter_portal_creator_id text,
  requested_by_name text not null,
  requested_by_ref text, -- the chatter's user id in the Chatter Portal
  fan_name text not null,
  length_minutes integer not null check (length_minutes between 1 and 240),
  price_usd numeric(10, 2),
  notes text,
  timing text not null check (timing in ('asap', 'scheduled')),
  requested_for timestamptz, -- set when timing = 'scheduled'
  expires_at timestamptz not null, -- pending requests past this show as expired
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'unavailable', 'declined', 'cancelled')),
  decline_note text,
  alternative_times timestamptz[] not null default '{}',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index video_call_requests_creator_idx on video_call_requests (creator_id, created_at desc);
create index video_call_requests_requested_by_idx on video_call_requests (requested_by_ref, created_at desc);

alter table video_call_requests enable row level security;

create policy "creator selects own video call requests" on video_call_requests
  for select using (creator_id = public.current_creator_id());

create policy "staff select video call requests" on video_call_requests
  for select using (public.is_staff());

-- Which Creator Portal creator each Chatter Portal creator is. The two
-- portals keep separate creator lists, so this is set once per creator
-- from the Chatter Portal. Server-only: RLS on, no policies.
create table chatter_portal_creator_links (
  chatter_portal_creator_id text primary key,
  creator_id uuid not null references creators(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table chatter_portal_creator_links enable row level security;
