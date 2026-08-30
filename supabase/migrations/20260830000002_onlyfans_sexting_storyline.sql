-- Free-text overview of the storyline/scenario for a Sexting request, shown
-- above the required-content checklist. Only meaningful when
-- content_type = 'sexting', same as sexting_drive_link.
alter table onlyfans_content_requests add column sexting_storyline text;
