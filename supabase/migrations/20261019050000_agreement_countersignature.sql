-- The agency's countersignature on a creator's agreement (the agreement
-- starts "once signed by both parties"). Added by the owner from the
-- creator's onboarding page.
alter table creator_agreements add column countersigned_at timestamptz;
alter table creator_agreements add column countersigned_by uuid references profiles(id) on delete set null;
alter table creator_agreements add column countersigner_name text;
alter table creator_agreements add column countersignature_path text;
