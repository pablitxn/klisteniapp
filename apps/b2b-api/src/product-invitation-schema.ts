/** NULL preserves legacy scalar invitations; [] explicitly grants no branch.
 * Existing invitation rows and prior migration text remain untouched. */
export const PRODUCT_INVITATION_MIGRATION_ID = '011-product-invitation-grants';
export const PRODUCT_INVITATION_SCHEMA = `
ALTER TABLE b2b_invitation ADD COLUMN branch_grants jsonb;
ALTER TABLE b2b_invitation ADD CONSTRAINT b2b_invitation_grants_array
 CHECK(branch_grants IS NULL OR jsonb_typeof(branch_grants)='array');
ALTER TABLE b2b_invitation DROP CONSTRAINT b2b_invitation_check;
ALTER TABLE b2b_invitation ADD CONSTRAINT b2b_invitation_scope_check CHECK(
 (branch_grants IS NULL AND ((role='admin' AND branch_id IS NULL) OR (role<>'admin' AND branch_id IS NOT NULL)))
 OR (branch_grants IS NOT NULL AND branch_id IS NULL)
);
CREATE OR REPLACE FUNCTION b2b_default_invitation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_grants IS NULL AND NEW.branch_id IS NULL AND NEW.role<>'admin'
 THEN NEW.branch_id=b2b_principal_branch_id(NEW.organization_id); END IF;
 RETURN NEW;
END $$;
`;
