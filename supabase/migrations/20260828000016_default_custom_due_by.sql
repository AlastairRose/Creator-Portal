-- due_by should always be set — 72 hours after requested_at — never left
-- blank. The intake form already computes this at insert time, but this
-- trigger guarantees it at the database level regardless of which code
-- path inserts a row (defense in depth, same reasoning as the RLS guard
-- triggers elsewhere). Only fills in due_by when it's null; never
-- overrides a value staff set deliberately.
create or replace function public.default_custom_due_by() returns trigger
language plpgsql as $$
begin
  if new.due_by is null then
    new.due_by := (new.requested_at + interval '72 hours')::date;
  end if;
  return new;
end;
$$;

create trigger outstanding_customs_default_due_by before insert on outstanding_customs
  for each row execute function public.default_custom_due_by();

-- Backfill existing rows (the Airtable import) that were left blank.
-- Runs outside any user session (no auth.uid()), so the creator-update
-- guard trigger would otherwise block it — disable it for this one
-- statement only.
alter table outstanding_customs disable trigger outstanding_customs_creator_update_guard;
update outstanding_customs
set due_by = (requested_at + interval '72 hours')::date
where due_by is null;
alter table outstanding_customs enable trigger outstanding_customs_creator_update_guard;
