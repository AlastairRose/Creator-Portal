-- Closes a cross-app security gap created by sharing one Supabase project
-- with Outlier Engine: that app's tables currently allow "any logged-in
-- user, full access" (policy "authenticated full access"), with no role
-- concept. Once Creator Portal starts creating real login accounts for
-- individual creators against this same database, that policy would let a
-- creator read/write every OTHER creator's Instagram performance data via a
-- direct PostgREST call — bypassing both apps' UIs entirely.
--
-- This migration lives only in Creator Portal's migrations folder. It runs
-- against the shared database, but nothing in the Outlier Engine repo/app
-- changes — its own code is untouched, only the underlying table policies.
--
-- Depends on is_staff() / current_creator_id() from
-- 20260828000000_profiles_and_roles.sql.

drop policy "authenticated full access" on creators;
create policy "staff full access" on creators
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on global_keywords;
create policy "staff full access" on global_keywords
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on creator_keywords;
create policy "staff full access" on creator_keywords
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on posts;
create policy "staff full access" on posts
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on follower_logs;
create policy "staff full access" on follower_logs
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on post_metrics_daily;
create policy "staff full access" on post_metrics_daily
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on creator_daily_snapshots;
create policy "staff full access" on creator_daily_snapshots
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on sync_log;
create policy "staff full access" on sync_log
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on creator_meta_connections;
create policy "staff full access" on creator_meta_connections
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on creator_demographics;
create policy "staff full access" on creator_demographics
  for all using (public.is_staff()) with check (public.is_staff());

drop policy "authenticated full access" on creator_account_totals;
create policy "staff full access" on creator_account_totals
  for all using (public.is_staff()) with check (public.is_staff());

-- Narrow read-only exceptions so a creator's own Dashboard can show their
-- Meta-sourced posted-reel counts and basic profile info, without opening
-- up any other creator's row.
create policy "creator reads own posts" on posts
  for select using (creator_id = public.current_creator_id());

create policy "creator reads own creator row" on creators
  for select using (id = public.current_creator_id());
