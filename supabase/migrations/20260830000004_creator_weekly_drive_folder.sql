-- Optional per-creator override for where auto-created weekly Drive folders
-- go. When set, "Week of {date}" is created directly inside this folder
-- instead of under the default "Creator Portal / {creator name}" folder.
alter table creator_drive_links add column weekly_root_drive_link text;
