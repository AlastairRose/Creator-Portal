-- Email notifications when new files land in a creator's Drive upload
-- folders. A scheduled job lists each watched folder, emails staff about any
-- file it hasn't seen before, then records it here so it's never reported
-- twice. Only ever read/written by the server with the service-role key, so
-- RLS is on with no policies (no client access at all).

-- Folders that have been scanned at least once. The first scan of a folder
-- only records what's already in it, so turning this on (or a new week's
-- folder appearing) doesn't email about every file that was already there.
create table drive_watched_folders (
  folder_id text primary key,
  first_scanned_at timestamptz not null default now()
);

create table drive_seen_files (
  file_id text primary key,
  folder_id text not null references drive_watched_folders(folder_id) on delete cascade,
  first_seen_at timestamptz not null default now()
);
create index drive_seen_files_folder_id_idx on drive_seen_files(folder_id);

alter table drive_watched_folders enable row level security;
alter table drive_seen_files enable row level security;
