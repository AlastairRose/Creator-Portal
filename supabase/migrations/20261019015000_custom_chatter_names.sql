-- Which chatter logged each custom request. Kept in its own table (not a
-- column on outstanding_customs) because row-level security can't hide a
-- single column: creators and editors can read their customs' rows, but
-- only management (owner + creative director) may see who the chatter was.
create or replace function public.is_manager() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'creative_director')
  );
$$;
revoke execute on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;

create table custom_chatter_names (
  custom_id uuid primary key references outstanding_customs(id) on delete cascade,
  chatter_name text not null,
  created_at timestamptz not null default now()
);
alter table custom_chatter_names enable row level security;

create policy "management full access" on custom_chatter_names
  for all using (public.is_manager()) with check (public.is_manager());
