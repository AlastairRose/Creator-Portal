-- A manually-entered comparison figure for the % change calculator, instead
-- of relying on a previous report of the same period_type actually existing
-- in the system (which isn't always true, e.g. the first monthly report).
alter table reports add column last_month_revenue numeric(12, 2);
