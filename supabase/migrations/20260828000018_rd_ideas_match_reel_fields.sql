-- R&D ideas now carry the exact same fields as a reel (Name/Idea/Inspo
-- link/Required shots/Hook/Outfit/Location/Filming style/Vertical/Editing
-- notes/Posting notes), so pushing one to a creator's plan carries
-- everything across instead of just name/idea/inspo_link/vertical. Table
-- was empty, so renaming in place rather than add+drop.
alter table rd_ideas rename column title to name;
alter table rd_ideas rename column source_link to inspo_link;
alter table rd_ideas rename column notes to idea;

alter table rd_ideas add column required_shots text;
alter table rd_ideas add column hook text;
alter table rd_ideas add column outfit text;
alter table rd_ideas add column location text;
alter table rd_ideas add column filming_style text;
alter table rd_ideas add column editing_notes text;
alter table rd_ideas add column posting_notes text;
