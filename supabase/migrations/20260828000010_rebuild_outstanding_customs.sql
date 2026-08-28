-- Reworks outstanding_customs to match the founder's real Airtable fields
-- (Sub Username/Name, Length, Custom/Call, Outfit, Location, chat link,
-- price agreed, Due by, Snapchat) and their real status workflow, which is
-- four buckets rather than the original three:
--
--   outstanding   -- creator's active to-do, they can see and act on this
--   to_do_later   -- not yet fully paid for; staff-only, creator never sees
--   uploaded      -- creator has filmed/uploaded; "ready to send" queue,
--                    staff-only from this point on — disappears from the
--                    creator's list the moment they mark it uploaded
--   sent          -- final state, staff-only
--
-- A creator's only permitted action on a row is outstanding -> uploaded;
-- everything else (content fields, other transitions, to_do_later, sent)
-- is staff-only, enforced by both RLS and the trigger below (defense in
-- depth, since a row policy alone can't stop a creator editing a different
-- column on a row they're allowed to touch). Uses ALTER rather than
-- drop+recreate — table is empty (verified) but ALTER is the safer habit
-- regardless.

alter table outstanding_customs add column sub_username text;
alter table outstanding_customs add column sub_name text;
alter table outstanding_customs add column length_of_video_or_call text;
alter table outstanding_customs add column custom_or_call text;
alter table outstanding_customs add column outfit text;
alter table outstanding_customs add column location text;
alter table outstanding_customs add column chat_screenshot_url text;
alter table outstanding_customs add column chat_link text;
alter table outstanding_customs add column custom_price_agreed text;
alter table outstanding_customs add column snapchat_handle text;
alter table outstanding_customs add column due_by date;
alter table outstanding_customs add column uploaded_at timestamptz;

alter table outstanding_customs alter column status set default 'outstanding';
alter table outstanding_customs drop constraint outstanding_customs_status_check;
alter table outstanding_customs add constraint outstanding_customs_status_check
  check (status in ('outstanding', 'to_do_later', 'uploaded', 'sent'));

drop policy "staff full access" on outstanding_customs;
drop policy "creator selects own customs" on outstanding_customs;

create policy "staff full access" on outstanding_customs
  for all using (public.is_staff()) with check (public.is_staff());

create policy "creator selects own outstanding customs" on outstanding_customs
  for select using (creator_id = public.current_creator_id() and status = 'outstanding');

create policy "creator marks own custom uploaded" on outstanding_customs
  for update using (creator_id = public.current_creator_id() and status = 'outstanding')
  with check (creator_id = public.current_creator_id());

create or replace function public.enforce_creator_custom_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    return new;
  end if;
  if old.status is distinct from 'outstanding' or new.status is distinct from 'uploaded' then
    raise exception 'not permitted';
  end if;
  if new.description is distinct from old.description
     or new.sub_username is distinct from old.sub_username
     or new.sub_name is distinct from old.sub_name
     or new.length_of_video_or_call is distinct from old.length_of_video_or_call
     or new.custom_or_call is distinct from old.custom_or_call
     or new.outfit is distinct from old.outfit
     or new.location is distinct from old.location
     or new.chat_screenshot_url is distinct from old.chat_screenshot_url
     or new.chat_link is distinct from old.chat_link
     or new.custom_price_agreed is distinct from old.custom_price_agreed
     or new.snapchat_handle is distinct from old.snapchat_handle
     or new.requested_at is distinct from old.requested_at
     or new.due_by is distinct from old.due_by
     or new.completed_at is distinct from old.completed_at
     or new.notes is distinct from old.notes
     or new.creator_id is distinct from old.creator_id
     or new.created_by is distinct from old.created_by then
    raise exception 'not permitted';
  end if;
  return new;
end;
$$;
create trigger outstanding_customs_creator_update_guard before update on outstanding_customs
  for each row execute function public.enforce_creator_custom_update();
