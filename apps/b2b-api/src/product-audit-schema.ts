/** Successor to 006: audit identity includes the branch-scoped resource identity.
 * Existing rows are never rewritten or deduplicated by this migration. */
export const PRODUCT_AUDIT_MIGRATION_ID = '008-product-audit-branch-identity';
export const PRODUCT_AUDIT_SCHEMA = `
LOCK TABLE b2b_audit IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(
   SELECT 1 FROM b2b_audit WHERE operation_id IS NOT NULL
   GROUP BY organization_id,actor_id,operation_id,action,branch_id,resource_id HAVING count(*)>1
 ) THEN
   RAISE EXCEPTION 'Product audit migration requires review of existing duplicate identities; no historical rows were changed' USING ERRCODE='23514';
 END IF;
END $$;
DROP INDEX b2b_product_audit_operation;
CREATE UNIQUE INDEX b2b_product_audit_operation ON b2b_audit
 (organization_id,actor_id,operation_id,action,branch_id,resource_id)
 NULLS NOT DISTINCT WHERE operation_id IS NOT NULL;
`;
