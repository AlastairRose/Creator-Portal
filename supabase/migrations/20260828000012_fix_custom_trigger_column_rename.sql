-- The chat_screenshot_url -> chat_screenshot_path rename (previous
-- migration) doesn't propagate into PL/pgSQL function bodies — this trigger
-- still referenced the old column name and would throw "record has no field
-- chat_screenshot_url" the moment a creator (not staff) touched a row.
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
     or new.chat_screenshot_path is distinct from old.chat_screenshot_path
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
