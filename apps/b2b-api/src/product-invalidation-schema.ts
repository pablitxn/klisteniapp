/** Notifications participate in the writer's transaction. They contain identifiers
 * only and are delivered by PostgreSQL after commit; rollback emits nothing. */
export const PRODUCT_INVALIDATION_MIGRATION_ID = '010-product-invalidation';
export const PRODUCT_INVALIDATION_SCHEMA = `
CREATE FUNCTION b2b_product_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item jsonb; previous jsonb; following jsonb; relevant text[];
BEGIN
 previous=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 following=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 relevant=string_to_array(TG_ARGV[0],',');
 IF TG_OP='UPDATE' AND NOT EXISTS(SELECT 1 FROM unnest(relevant) field WHERE previous->field IS DISTINCT FROM following->field) THEN RETURN NEW; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(jsonb_build_array(previous,following)) WHERE value<>'null'::jsonb LOOP
  PERFORM pg_notify('klisteni_b2b_invalidation',jsonb_build_object(
   'schema',TG_TABLE_SCHEMA,'kind',TG_TABLE_NAME,
   'organizationId',CASE WHEN TG_TABLE_NAME='b2b_organization' THEN item->>'id' ELSE item->>'organization_id' END,
   'actorId',COALESCE(item->>'user_id',item->>'userId'),
   'ownerId',item->>'owner_id',
   'branchId',CASE WHEN TG_TABLE_NAME='b2b_branch' THEN item->>'id' ELSE item->>'branch_id' END,
   'sessionId',CASE WHEN TG_TABLE_NAME='b2b_auth_session' THEN item->>'id' ELSE item->>'session_id' END
  )::text);
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_membership FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('organization_id,user_id,active,product_role,access_revision');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_branch_grant FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('organization_id,branch_id,user_id,role,active');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_health_consent FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('organization_id,branch_id,owner_id,revision,categories,audience,disclosure_version,revoked_at');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_health FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('owner_id,revision,data');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_branch FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('organization_id,id,status');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_organization FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('id,product_active,service_enabled,service_ends_at,product_access_revision');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_domain FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('host,organization_id,generation,status,verified_at,dns_verified_at,tls_verified_at,tls_expires_at');
CREATE TRIGGER product_notify AFTER UPDATE OR DELETE ON b2b_auth_session FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('id,userId,token,expiresAt');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_session_context FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('session_id,organization_id,domain_host,domain_generation');
CREATE TRIGGER product_notify AFTER INSERT OR UPDATE OR DELETE ON b2b_unified_session_context FOR EACH ROW EXECUTE FUNCTION b2b_product_notify('session_id,origin');
`;
