-- Single-row table holding the founder's connected Google account, used to
-- auto-create a dated Drive folder for a creator when their week is
-- published. Owner-only — a refresh token here is effectively as sensitive
-- as a password, and this is never read by any client-facing query, only
-- from server actions/route handlers.
create table google_drive_connection (
  id uuid primary key default gen_random_uuid(),
  connected_by uuid references profiles(id) on delete set null,
  google_account_email text,
  root_folder_id text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table google_drive_connection enable row level security;

create policy "owner full access" on google_drive_connection
  for all using (public.is_owner()) with check (public.is_owner());
