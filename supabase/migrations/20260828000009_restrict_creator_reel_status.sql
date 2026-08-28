-- Creators should only ever move a reel from 'planned' to 'uploaded',
-- 'unable_to_record', or 'not_liked'. 'edited' and 'posted' are staff/editor
-- calls (tracked from Content Planner), not something a creator sets
-- themselves. The original trigger only blocked 'posted' — this closes the
-- 'edited' gap too.
--
-- Also drops the reference to `notes`, a column that no longer exists on
-- `reels` (replaced by the granular content fields in a later migration).
-- That stale reference was latent and harmless so far only because every
-- update so far has come from a staff session, which returns early above —
-- it would have thrown "record reels has no field notes" the moment an
-- actual creator tried to update a reel.
create or replace function public.enforce_creator_reel_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    return new;
  end if;
  if new.idea is distinct from old.idea
     or new.name is distinct from old.name
     or new.inspo_link is distinct from old.inspo_link
     or new.required_shots is distinct from old.required_shots
     or new.hook is distinct from old.hook
     or new.outfit is distinct from old.outfit
     or new.location is distinct from old.location
     or new.filming_style is distinct from old.filming_style
     or new.editing_notes is distinct from old.editing_notes
     or new.posting_notes is distinct from old.posting_notes
     or new.vertical is distinct from old.vertical
     or new.content_week_id is distinct from old.content_week_id
     or new.creator_id is distinct from old.creator_id
     or new.flagged_for_reuse is distinct from old.flagged_for_reuse
     or new.reused_in_week_id is distinct from old.reused_in_week_id
     or new.sort_order is distinct from old.sort_order
     or new.status in ('edited', 'posted') then
    raise exception 'not permitted';
  end if;
  return new;
end;
$$;
