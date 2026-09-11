-- Support multiple chat screenshots per custom request instead of just one
-- (a request often comes with more than one message/image worth keeping).
alter table outstanding_customs add column chat_screenshot_paths text[] not null default '{}';

-- Runs outside any user session (no auth.uid()), so the creator-update guard
-- trigger would otherwise block this backfill — disable it for this one
-- statement only (same reasoning as the due_by backfill in 20260828000016).
alter table outstanding_customs disable trigger outstanding_customs_creator_update_guard;
update outstanding_customs
set chat_screenshot_paths = array[chat_screenshot_path]
where chat_screenshot_path is not null;
alter table outstanding_customs enable trigger outstanding_customs_creator_update_guard;

alter table outstanding_customs drop column chat_screenshot_path;

-- Trigger bodies embed column names as plain text, so a column rename
-- doesn't propagate into them automatically — this exact class of bug
-- already bit this trigger once before (see 20260828000012). Redefine it
-- here too, pointed at the new column.
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
     or new.chat_screenshot_paths is distinct from old.chat_screenshot_paths
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
