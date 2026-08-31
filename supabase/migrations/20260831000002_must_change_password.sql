-- Every account today was created by the owner picking a temporary
-- password and sharing it out of band (see inviteUser) — nobody has ever
-- set their own. Defaulting this to true backfills every existing profile
-- as well as any future insert that doesn't explicitly opt out (e.g.
-- linkExistingUser, for someone who already has a real password from
-- elsewhere in the shared project).
alter table profiles add column must_change_password boolean not null default true;
