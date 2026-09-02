-- Staff-only library of SOP documents and guides — an uploaded document
-- and/or a link to a video, per entry. Mirrors the chat-screenshots
-- pattern: a private storage bucket, uploads always go through the
-- service-role client, and signed URLs are only ever generated for a
-- verified staff session (see lib/storage.ts).
create table sops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  description text,
  document_path text,
  document_filename text,
  video_link text,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sops_category_idx on sops(category);

alter table sops enable row level security;

create policy "staff full access" on sops
  for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('sop-documents', 'sop-documents', false)
on conflict (id) do nothing;
