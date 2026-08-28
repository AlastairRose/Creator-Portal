-- Creator Portal identity/role layer, sitting on top of the shared Supabase
-- project (same database as Outlier Engine). Every other Creator Portal
-- table's RLS depends on the helper functions defined here.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('owner', 'creative_director', 'editor', 'creator')),
  creator_id uuid references creators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_role_requires_creator_id check (
    (role = 'creator' and creator_id is not null) or
    (role <> 'creator' and creator_id is null)
  )
);

-- Only one creator-role login per creator.
create unique index profiles_creator_id_unique_idx
  on profiles(creator_id) where role = 'creator';

-- Security-definer helpers. These bypass RLS internally (definer, not
-- invoker) which is what lets policies on `profiles` itself call is_staff()
-- without recursing back into profiles' own RLS.
create or replace function public.is_staff() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'creative_director', 'editor')
  );
$$;

create or replace function public.is_owner() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.current_creator_id() returns uuid
language sql security definer stable
set search_path = public
as $$
  select creator_id from public.profiles where id = auth.uid();
$$;

revoke execute on function public.is_staff() from public;
revoke execute on function public.is_owner() from public;
revoke execute on function public.current_creator_id() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.current_creator_id() to authenticated;

alter table profiles enable row level security;

-- Anyone can see their own profile row; staff can see everyone's (needed for
-- the roster/admin views and for joining creator names onto staff-wide pages).
create policy "select own or staff" on profiles
  for select using (id = auth.uid() or public.is_staff());

-- Only an owner can create/update/delete profile rows through the normal
-- client. In practice, inviteUser() uses the service-role admin client
-- instead (the inviting owner isn't the new row's id), but this policy still
-- covers role changes/removals done via a normal owner session.
create policy "owner manages profiles" on profiles
  for all using (public.is_owner()) with check (public.is_owner());
