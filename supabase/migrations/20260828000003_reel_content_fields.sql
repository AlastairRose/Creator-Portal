-- Replaces the generic idea/notes fields on `reels` with the founder's
-- actual per-reel planning template (matches their existing Notion setup):
-- Idea, Required shots, Hook, Outfit/Location, Filming Style,
-- Editing/Posting Notes, Vertical. Also adds 'edited' as a status between
-- 'uploaded' and 'posted', since editors track that stage separately.

alter table reels
  add column required_shots text,
  add column hook text,
  add column outfit_location text,
  add column filming_style text,
  add column editing_notes text,
  add column vertical text;

alter table reels drop column notes;

alter table reels drop constraint reels_status_check;
alter table reels add constraint reels_status_check
  check (status in ('planned', 'uploaded', 'edited', 'posted', 'unable_to_record', 'not_liked'));
