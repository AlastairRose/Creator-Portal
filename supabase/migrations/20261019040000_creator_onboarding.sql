-- Creator onboarding: agreement + e-signature, personal details and ID
-- documents, account logins (encrypted, owner-only), model info, then
-- notifications and a welcome video.
--
-- Everything here is written by the server (service-role key) after its own
-- checks, so tables only carry SELECT policies for the people allowed to
-- read them. Sensitive tables (details, documents, logins) are never
-- readable by creators or editors.

-- Wording + video, edited by the owner. Single row.
create table onboarding_settings (
  id int primary key default 1 check (id = 1),
  agreement_title text not null default 'Creator Agreement',
  agreement_body text not null default '',
  agreement_version int not null default 1,
  welcome_video_url text,
  updated_at timestamptz not null default now()
);
insert into onboarding_settings (id) values (1);
alter table onboarding_settings enable row level security;
create policy "staff read onboarding settings" on onboarding_settings
  for select using (public.is_staff());

-- Progress per creator. Creators who already existed when onboarding was
-- switched on are marked exempt so they aren't suddenly locked out; staff
-- can switch it on for them from the creator's onboarding page.
create table creator_onboarding (
  creator_id uuid primary key references creators(id) on delete cascade,
  exempt boolean not null default false,
  agreement_signed_at timestamptz,
  details_submitted_at timestamptz,
  model_info_submitted_at timestamptz,
  notifications_done_at timestamptz,
  video_watched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into creator_onboarding (creator_id, exempt) select id, true from creators;
alter table creator_onboarding enable row level security;
create policy "staff read onboarding progress" on creator_onboarding
  for select using (public.is_staff());
create policy "creator reads own onboarding progress" on creator_onboarding
  for select using (creator_id = public.current_creator_id());

-- The signed agreement, frozen exactly as the creator saw it.
create table creator_agreements (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  agreement_version int not null,
  agreement_title text not null,
  agreement_text text not null, -- with the creator's blanks filled in
  field_values jsonb not null default '{}',
  signer_name text not null,
  signature_path text not null, -- PNG in the creator-onboarding bucket
  signed_at timestamptz not null default now(),
  signer_ip text,
  signer_user_agent text
);
create index creator_agreements_creator_id_idx on creator_agreements(creator_id);
alter table creator_agreements enable row level security;
create policy "management reads agreements" on creator_agreements
  for select using (public.is_manager());
create policy "creator reads own agreements" on creator_agreements
  for select using (creator_id = public.current_creator_id());

create table creator_personal_details (
  creator_id uuid primary key references creators(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table creator_personal_details enable row level security;
create policy "management reads personal details" on creator_personal_details
  for select using (public.is_manager());

create table creator_documents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  kind text not null check (kind in ('id_document', 'proof_of_address')),
  path text not null unique,
  original_name text,
  content_type text,
  uploaded_at timestamptz not null default now()
);
create index creator_documents_creator_id_idx on creator_documents(creator_id);
alter table creator_documents enable row level security;
create policy "management reads documents" on creator_documents
  for select using (public.is_manager());

-- Passwords are AES-256-GCM encrypted by the server before they get here
-- (key in the ONBOARDING_ENCRYPTION_KEY env var, never in the database).
-- No policies at all: only the server reads this, and only reveals a
-- password to the owner, logging each reveal.
create table creator_account_logins (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  platform text not null,
  username text not null,
  password_encrypted text not null,
  notes text,
  created_at timestamptz not null default now()
);
create index creator_account_logins_creator_id_idx on creator_account_logins(creator_id);
alter table creator_account_logins enable row level security;

create table creator_login_reveals (
  id uuid primary key default gen_random_uuid(),
  login_id uuid not null references creator_account_logins(id) on delete cascade,
  revealed_by uuid references profiles(id) on delete set null,
  revealed_at timestamptz not null default now()
);
alter table creator_login_reveals enable row level security;

-- Model info answers. Also sent to the Chatter Portal's Model Information
-- page; this copy is kept so it can be re-sent if that fails.
create table creator_model_info (
  creator_id uuid primary key references creators(id) on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  chatter_portal_synced_at timestamptz,
  chatter_portal_sync_error text
);
alter table creator_model_info enable row level security;
create policy "staff read model info" on creator_model_info
  for select using (public.is_staff());

-- Private bucket for signatures, ID and proof-of-address files. No storage
-- policies: uploads go through short-lived signed upload URLs the server
-- issues, and downloads through short-lived signed URLs for management.
insert into storage.buckets (id, name, public, file_size_limit)
values ('creator-onboarding', 'creator-onboarding', false, 20971520)
on conflict (id) do nothing;
