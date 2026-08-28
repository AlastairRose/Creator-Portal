-- Splits the combined editing/posting notes field into two separate fields.
alter table reels add column posting_notes text;
