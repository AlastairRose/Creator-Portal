-- Breaks the single "revenue" figure into Total Revenue / Agency Share /
-- Creator Share, and adds a screenshot gallery per report (same private
-- bucket + signed-URL pattern as outstanding_customs' chat screenshots).
alter table reports rename column revenue to total_revenue;
alter table reports add column agency_share numeric(12, 2);
alter table reports add column creator_share numeric(12, 2);
alter table reports add column screenshot_paths text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('report-screenshots', 'report-screenshots', false)
on conflict (id) do nothing;
