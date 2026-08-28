-- Splits the combined outfit/location field into two separate fields.
alter table reels drop column outfit_location;
alter table reels add column outfit text;
alter table reels add column location text;
