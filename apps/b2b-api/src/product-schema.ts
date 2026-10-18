/** Additive foundation. Activation remains false until all feature services and
 * version gates are integrated. Never edit migrations 001-005 or snapshot JSON. */
export const PRODUCT_MIGRATION_ID = '006-product-foundation';
export const PRODUCT_SCHEMA = `
ALTER TABLE b2b_organization ADD COLUMN product_active boolean NOT NULL DEFAULT false;
ALTER TABLE b2b_organization ADD COLUMN product_access_revision bigint NOT NULL DEFAULT 0 CHECK(product_access_revision>=0);
ALTER TABLE b2b_membership ADD COLUMN product_role text CHECK(product_role IN ('superadmin','admin','coach','member'));
ALTER TABLE b2b_membership ADD COLUMN access_revision bigint NOT NULL DEFAULT 0 CHECK(access_revision>=0);
ALTER TABLE b2b_invitation ADD COLUMN product_role text CHECK(product_role IN ('superadmin','admin','coach','member'));
UPDATE b2b_membership SET product_role=CASE WHEN role='admin' THEN 'superadmin' ELSE role END;
UPDATE b2b_invitation SET product_role=CASE WHEN role='admin' THEN 'superadmin' ELSE role END;
ALTER TABLE b2b_membership ALTER COLUMN product_role SET NOT NULL;
ALTER TABLE b2b_invitation ALTER COLUMN product_role SET NOT NULL;
ALTER TABLE b2b_membership ADD CONSTRAINT b2b_product_role_mapping CHECK(role=CASE WHEN product_role='superadmin' THEN 'admin' ELSE product_role END);
ALTER TABLE b2b_invitation ADD CONSTRAINT b2b_product_invitation_role_mapping CHECK(role=CASE WHEN product_role='superadmin' THEN 'admin' ELSE product_role END);
CREATE FUNCTION b2b_product_role_compatibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.product_role IS NULL THEN NEW.product_role=CASE WHEN NEW.role='admin' THEN 'superadmin' ELSE NEW.role END; END IF;
 ELSIF NEW.role IS DISTINCT FROM OLD.role AND NEW.product_role IS NOT DISTINCT FROM OLD.product_role THEN
  NEW.product_role=CASE WHEN NEW.role='admin' THEN 'superadmin' ELSE NEW.role END;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_00_product_role BEFORE INSERT OR UPDATE ON b2b_membership FOR EACH ROW EXECUTE FUNCTION b2b_product_role_compatibility();
CREATE TRIGGER b2b_00_product_invitation_role BEFORE INSERT OR UPDATE ON b2b_invitation FOR EACH ROW EXECUTE FUNCTION b2b_product_role_compatibility();
CREATE FUNCTION b2b_product_last_superadmin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.active AND OLD.product_role='superadmin' AND
  (TG_OP='DELETE' OR NOT NEW.active OR NEW.product_role<>'superadmin' OR NEW.organization_id<>OLD.organization_id OR NEW.user_id<>OLD.user_id) THEN
  -- A real row write serializes competing removals, including repeatable-read transactions.
  UPDATE b2b_organization SET product_access_revision=product_access_revision+1 WHERE id=OLD.organization_id;
  IF NOT EXISTS(SELECT 1 FROM b2b_membership WHERE organization_id=OLD.organization_id AND user_id<>OLD.user_id AND active AND product_role='superadmin') THEN
   RAISE EXCEPTION 'Last active organization superadmin cannot be removed' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.active IS DISTINCT FROM OLD.active OR NEW.product_role IS DISTINCT FROM OLD.product_role THEN NEW.access_revision=OLD.access_revision+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_10_product_superadmin BEFORE UPDATE OR DELETE ON b2b_membership FOR EACH ROW EXECUTE FUNCTION b2b_product_last_superadmin();

ALTER TABLE b2b_program ADD COLUMN archived_at timestamptz;
ALTER TABLE b2b_program ADD COLUMN schema_version smallint NOT NULL DEFAULT 1 CHECK(schema_version IN (1,2));
ALTER TABLE b2b_program_version ADD COLUMN schema_version smallint NOT NULL DEFAULT 1 CHECK(schema_version IN (1,2));
ALTER TABLE b2b_execution ADD UNIQUE(organization_id,branch_id,id,member_id);
ALTER TABLE b2b_audit ADD COLUMN branch_id text;
ALTER TABLE b2b_audit ADD COLUMN operation_id text;
ALTER TABLE b2b_audit ADD COLUMN before_revision bigint;
ALTER TABLE b2b_audit ADD COLUMN after_revision bigint;
ALTER TABLE b2b_audit ADD COLUMN changed_fields jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(changed_fields)='array');
ALTER TABLE b2b_audit ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
CREATE UNIQUE INDEX b2b_product_audit_operation ON b2b_audit(organization_id,actor_id,operation_id,action,resource_id) WHERE operation_id IS NOT NULL;
INSERT INTO b2b_audit(organization_id,action,resource_id,changed_fields)
 SELECT id,'product.role-migration',id,'["membership.product_role","invitation.product_role"]' FROM b2b_organization;

CREATE TABLE b2b_goal_program (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, id text NOT NULL,
 content jsonb NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')), archived_at timestamptz,
 PRIMARY KEY(organization_id,branch_id,id), UNIQUE(organization_id,branch_id,member_id,id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id),
 FOREIGN KEY(organization_id,member_id) REFERENCES b2b_membership(organization_id,user_id)
);
CREATE TABLE b2b_goal_program_revision (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, goal_program_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>=0), content jsonb NOT NULL, actor_id text NOT NULL REFERENCES b2b_auth_user(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,goal_program_id,revision),
 FOREIGN KEY(organization_id,branch_id,member_id,goal_program_id) REFERENCES b2b_goal_program(organization_id,branch_id,member_id,id)
);
CREATE TABLE b2b_enrollment (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, id text NOT NULL, goal_program_id text NOT NULL, issued_goal_revision integer NOT NULL,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), status text NOT NULL CHECK(status IN ('active','ended')), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,id), UNIQUE(organization_id,branch_id,member_id,id),
 FOREIGN KEY(organization_id,branch_id,member_id,goal_program_id) REFERENCES b2b_goal_program(organization_id,branch_id,member_id,id),
 FOREIGN KEY(organization_id,branch_id,goal_program_id,issued_goal_revision) REFERENCES b2b_goal_program_revision(organization_id,branch_id,goal_program_id,revision)
);
CREATE TABLE b2b_enrollment_revision (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, enrollment_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>=0), content jsonb NOT NULL, actor_id text NOT NULL REFERENCES b2b_auth_user(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,enrollment_id,revision),
 FOREIGN KEY(organization_id,branch_id,member_id,enrollment_id) REFERENCES b2b_enrollment(organization_id,branch_id,member_id,id)
);
CREATE TABLE b2b_stage_revision (
 organization_id text NOT NULL, branch_id text NOT NULL, enrollment_id text NOT NULL, enrollment_revision integer NOT NULL, id text NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>=0), start_date date NOT NULL, end_date date NOT NULL CHECK(end_date>=start_date), content jsonb NOT NULL,
 PRIMARY KEY(organization_id,branch_id,enrollment_id,enrollment_revision,id),
 UNIQUE(organization_id,branch_id,enrollment_id,enrollment_revision,ordinal),
 FOREIGN KEY(organization_id,branch_id,enrollment_id,enrollment_revision) REFERENCES b2b_enrollment_revision(organization_id,branch_id,enrollment_id,revision)
);
CREATE TABLE b2b_occurrence (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, id text NOT NULL,
 enrollment_id text NOT NULL, issued_enrollment_revision integer NOT NULL, stage_id text NOT NULL, slot_id text NOT NULL, slot_ordinal integer NOT NULL CHECK(slot_ordinal>=0),
 program_id text NOT NULL, program_version integer NOT NULL,
 original_date date NOT NULL, original_week_start date NOT NULL CHECK(extract(isodow FROM original_week_start)=1), time_zone text NOT NULL,
 scheduled_date date NOT NULL, current_week_start date NOT NULL CHECK(extract(isodow FROM current_week_start)=1), permitted_date_override date,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), eligibility text NOT NULL CHECK(eligibility IN ('required','cancelled')), cancellation_reason text,
 PRIMARY KEY(organization_id,branch_id,id), UNIQUE(organization_id,branch_id,member_id,id),
 UNIQUE(organization_id,branch_id,enrollment_id,stage_id,slot_id,slot_ordinal),
 CHECK(original_date>=original_week_start AND original_date<original_week_start+7),
 CHECK(scheduled_date>=current_week_start AND scheduled_date<current_week_start+7),
 FOREIGN KEY(organization_id,branch_id,member_id,enrollment_id) REFERENCES b2b_enrollment(organization_id,branch_id,member_id,id),
 FOREIGN KEY(organization_id,branch_id,enrollment_id,issued_enrollment_revision,stage_id) REFERENCES b2b_stage_revision(organization_id,branch_id,enrollment_id,enrollment_revision,id),
 FOREIGN KEY(organization_id,branch_id,program_id,program_version) REFERENCES b2b_program_version(organization_id,branch_id,program_id,version)
);
CREATE TABLE b2b_occurrence_revision (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, occurrence_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>=0), snapshot jsonb NOT NULL, actor_id text NOT NULL REFERENCES b2b_auth_user(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,occurrence_id,revision),
 FOREIGN KEY(organization_id,branch_id,member_id,occurrence_id) REFERENCES b2b_occurrence(organization_id,branch_id,member_id,id)
);
CREATE TABLE b2b_training_session (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, id text NOT NULL,
 occurrence_id text, legacy_assignment_id text, legacy_execution_id text, program_id text NOT NULL, program_version integer NOT NULL,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,id), UNIQUE(organization_id,branch_id,member_id,id),
 UNIQUE(organization_id,branch_id,legacy_execution_id),
 CHECK((occurrence_id IS NOT NULL)::integer+(legacy_assignment_id IS NOT NULL)::integer=1),
 CHECK(legacy_execution_id IS NULL OR legacy_assignment_id IS NOT NULL),
 FOREIGN KEY(organization_id,branch_id,member_id,occurrence_id) REFERENCES b2b_occurrence(organization_id,branch_id,member_id,id),
 FOREIGN KEY(organization_id,branch_id,legacy_assignment_id,member_id) REFERENCES b2b_program_assignment(organization_id,branch_id,id,member_id),
 FOREIGN KEY(organization_id,branch_id,legacy_execution_id,member_id) REFERENCES b2b_execution(organization_id,branch_id,id,member_id),
 FOREIGN KEY(organization_id,branch_id,program_id,program_version) REFERENCES b2b_program_version(organization_id,branch_id,program_id,version)
);
CREATE TABLE b2b_session_revision (
 organization_id text NOT NULL, branch_id text NOT NULL, member_id text NOT NULL, session_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>=0), schema_version smallint NOT NULL CHECK(schema_version IN (1,2)),
 operation_id text, snapshot jsonb NOT NULL, actor_id text NOT NULL REFERENCES b2b_auth_user(id), accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,session_id,revision),
 CHECK(schema_version<>1 OR revision=0),
 FOREIGN KEY(organization_id,branch_id,member_id,session_id) REFERENCES b2b_training_session(organization_id,branch_id,member_id,id)
);
CREATE TABLE b2b_operation_receipt (
 organization_id text NOT NULL, branch_id text NOT NULL, actor_id text NOT NULL, operation_id text NOT NULL,
 resource_id text NOT NULL, revision integer NOT NULL CHECK(revision>=0), request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'), response jsonb NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,actor_id,operation_id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES b2b_membership(organization_id,user_id)
);
CREATE TABLE b2b_routine_supplement (
 organization_id text NOT NULL, branch_id text NOT NULL, program_id text NOT NULL, program_version integer NOT NULL,
 source_snapshot_hash text NOT NULL CHECK(source_snapshot_hash ~ '^[a-f0-9]{64}$'), snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,program_id,program_version),
 FOREIGN KEY(organization_id,branch_id,program_id,program_version) REFERENCES b2b_program_version(organization_id,branch_id,program_id,version)
);
-- Explicit enrichment storage: seeding may fill this table, never overwrite immutable published JSON.
CREATE TABLE b2b_reviewed_relation (
 id text PRIMARY KEY, source_exercise_id text NOT NULL REFERENCES b2b_exercise(id), target_exercise_id text NOT NULL REFERENCES b2b_exercise(id),
 catalog_revision text NOT NULL, source_content_hash text NOT NULL, target_content_hash text NOT NULL, metadata jsonb NOT NULL,
 CHECK(source_exercise_id<>target_exercise_id)
);
-- Health belongs to the B2B identity. An organization is only a revocable audience.
CREATE TABLE b2b_health (
 owner_id text PRIMARY KEY REFERENCES b2b_auth_user(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE b2b_health_operation (
 owner_id text NOT NULL REFERENCES b2b_auth_user(id), operation_id text NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 revision integer NOT NULL CHECK(revision>=0), response jsonb NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,operation_id)
);
CREATE TABLE b2b_health_consent (
 organization_id text NOT NULL, branch_id text NOT NULL, owner_id text NOT NULL, id text NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 categories jsonb NOT NULL CHECK(jsonb_typeof(categories)='array' AND jsonb_array_length(categories)>0),
 audience text NOT NULL CHECK(audience='current-authorized-branch-trainers'), disclosure_version integer NOT NULL CHECK(disclosure_version=1),
 granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 PRIMARY KEY(organization_id,branch_id,id), UNIQUE(organization_id,branch_id,owner_id,id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id),
 FOREIGN KEY(organization_id,owner_id) REFERENCES b2b_membership(organization_id,user_id)
);
CREATE UNIQUE INDEX b2b_health_active_consent ON b2b_health_consent(organization_id,branch_id,owner_id) WHERE revoked_at IS NULL;
CREATE TABLE b2b_health_consent_revision (
 organization_id text NOT NULL, branch_id text NOT NULL, owner_id text NOT NULL, consent_id text NOT NULL, revision integer NOT NULL CHECK(revision>=0),
 snapshot jsonb NOT NULL, actor_id text REFERENCES b2b_auth_user(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,branch_id,consent_id,revision),
 FOREIGN KEY(organization_id,branch_id,owner_id,consent_id) REFERENCES b2b_health_consent(organization_id,branch_id,owner_id,id)
);
CREATE FUNCTION b2b_product_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical product records are append-only' USING ERRCODE='23514'; END $$;
CREATE FUNCTION b2b_product_occurrence_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['scheduled_date','current_week_start','permitted_date_override','revision','eligibility','cancellation_reason'])
 IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['scheduled_date','current_week_start','permitted_date_override','revision','eligibility','cancellation_reason']) THEN
  RAISE EXCEPTION 'Issued occurrence identity and original linkage are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_occurrence_identity BEFORE UPDATE ON b2b_occurrence FOR EACH ROW EXECUTE FUNCTION b2b_product_occurrence_identity();
CREATE TRIGGER b2b_occurrence_preserve BEFORE DELETE ON b2b_occurrence FOR EACH ROW EXECUTE FUNCTION b2b_product_append_only();
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['b2b_goal_program_revision','b2b_enrollment_revision','b2b_stage_revision','b2b_occurrence_revision','b2b_session_revision','b2b_operation_receipt','b2b_routine_supplement','b2b_health_operation','b2b_health_consent_revision'] LOOP
  EXECUTE format('CREATE TRIGGER product_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION b2b_product_append_only()',table_name);
 END LOOP;
END $$;

-- Bind the denormalized routine link to its original occurrence/assignment too.
ALTER TABLE b2b_occurrence ADD UNIQUE(organization_id,branch_id,member_id,id,program_id,program_version);
ALTER TABLE b2b_program_assignment ADD UNIQUE(organization_id,branch_id,member_id,id,program_id,version);
ALTER TABLE b2b_execution ADD UNIQUE(organization_id,branch_id,member_id,id,assignment_id);
ALTER TABLE b2b_training_session ADD FOREIGN KEY(organization_id,branch_id,member_id,occurrence_id,program_id,program_version) REFERENCES b2b_occurrence(organization_id,branch_id,member_id,id,program_id,program_version);
ALTER TABLE b2b_training_session ADD FOREIGN KEY(organization_id,branch_id,member_id,legacy_assignment_id,program_id,program_version) REFERENCES b2b_program_assignment(organization_id,branch_id,member_id,id,program_id,version);
ALTER TABLE b2b_training_session ADD FOREIGN KEY(organization_id,branch_id,member_id,legacy_execution_id,legacy_assignment_id) REFERENCES b2b_execution(organization_id,branch_id,member_id,id,assignment_id);
CREATE FUNCTION b2b_product_session_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'revision') IS DISTINCT FROM (to_jsonb(OLD)-'revision') THEN
  RAISE EXCEPTION 'Session original linkage is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_session_identity BEFORE UPDATE ON b2b_training_session FOR EACH ROW EXECUTE FUNCTION b2b_product_session_identity();
CREATE TRIGGER b2b_session_preserve BEFORE DELETE ON b2b_training_session FOR EACH ROW EXECUTE FUNCTION b2b_product_append_only();

CREATE INDEX b2b_occurrence_week ON b2b_occurrence(organization_id,branch_id,member_id,current_week_start);
CREATE INDEX b2b_session_member ON b2b_training_session(organization_id,branch_id,member_id);
`;
