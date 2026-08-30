-- OnlyFans Content requests now carry a content type (Sexting, PPV, Wall
-- Posts, Voice Notes, Day-to-Day, Other). Every type except Sexting is
-- purely description + length, all shown to the creator. Sexting requests
-- instead break down into a checklist of individual required items (see
-- onlyfans_sexting_items below), so `description`/`length` on the request
-- row itself only apply to non-sexting types.
alter table onlyfans_content_requests
  add column content_type text not null default 'other'
    check (content_type in ('sexting', 'ppv', 'wall_posts', 'voice_notes', 'day_to_day', 'other'));

alter table onlyfans_content_requests alter column description drop not null;
alter table onlyfans_content_requests add column length text;

-- Where the creator should upload the sexting content for this request.
-- Only meaningful when content_type = 'sexting'.
alter table onlyfans_content_requests add column sexting_drive_link text;

alter table onlyfans_content_requests add constraint onlyfans_content_requests_description_required
  check (content_type = 'sexting' or description is not null);

-- One checklist row per required piece of sexting content. `creator_required`
-- is the tick box the planner sets: ticked rows are steps the creator needs
-- to complete and are shown on their content planner; unticked rows are
-- staff-only steps (e.g. internal prep) that never reach the creator. This
-- is enforced at the RLS level below, not just hidden in the UI, since a
-- creator's session can query this table directly.
create table onlyfans_sexting_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references onlyfans_content_requests(id) on delete cascade,
  content_label text not null,
  description text,
  length text,
  creator_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index onlyfans_sexting_items_request_id_idx on onlyfans_sexting_items(request_id);

alter table onlyfans_sexting_items enable row level security;

create policy "staff full access" on onlyfans_sexting_items
  for all using (public.is_staff()) with check (public.is_staff());

create policy "creator selects own required sexting items" on onlyfans_sexting_items
  for select using (
    creator_required = true
    and exists (
      select 1 from onlyfans_content_requests r
      where r.id = request_id and r.creator_id = public.current_creator_id()
    )
  );
