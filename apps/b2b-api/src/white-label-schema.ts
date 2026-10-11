/** 004 is additive: relational scope is backfilled without rewriting historical JSON. */
export const WHITE_LABEL_SCHEMA = `
CREATE FUNCTION b2b_principal_branch_id(organization_id text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE WHEN length(organization_id)<=150 THEN organization_id||'-principal' ELSE 'principal_'||md5(organization_id) END
$$;

CREATE TABLE b2b_branch (
 id text PRIMARY KEY,
 organization_id text NOT NULL REFERENCES b2b_organization(id),
 slug text NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text NOT NULL,
 address text NOT NULL DEFAULT '', contact text NOT NULL DEFAULT '', timezone text NOT NULL DEFAULT 'UTC',
 opening_hours jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 public boolean NOT NULL DEFAULT false,
 draft jsonb NOT NULL DEFAULT '{"headline":"","introduction":"","activities":[],"openingHours":[],"gallery":[],"floorPlan":null,"spatialModel":null}',
 published jsonb, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 published_revision integer, published_at timestamptz,
 UNIQUE(organization_id,id), UNIQUE(organization_id,slug)
);
INSERT INTO b2b_branch(id,organization_id,slug,name,address,contact,public,draft,published,published_revision,published_at)
SELECT b2b_principal_branch_id(o.id),o.id,'principal','Principal',coalesce(o.brand->>'address',''),coalesce(o.brand->>'contact',''),w.published IS NOT NULL,
 coalesce(w.draft,'{"headline":"","introduction":"","activities":[],"openingHours":[],"gallery":[],"floorPlan":null,"spatialModel":null}'::jsonb),
 w.published->'content',w.published_revision,w.published_at
FROM b2b_organization o LEFT JOIN b2b_website w ON w.organization_id=o.id;

CREATE TABLE b2b_branch_grant (
 organization_id text NOT NULL, branch_id text NOT NULL, user_id text NOT NULL,
 role text NOT NULL CHECK(role IN ('coach','member')), active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,branch_id,user_id,role),
 FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id),
 FOREIGN KEY(organization_id,user_id) REFERENCES b2b_membership(organization_id,user_id)
);
INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role,active)
SELECT organization_id,b2b_principal_branch_id(organization_id),user_id,role,active
FROM b2b_membership WHERE role IN ('coach','member');

CREATE TABLE b2b_domain (
 host text PRIMARY KEY CHECK(host=lower(host) AND length(host)<=260 AND host ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?(:[1-9][0-9]{0,4})?$'
  AND CASE WHEN position(':' in host)>0 THEN split_part(host,':',2)::integer<=65535 ELSE true END),
 organization_id text NOT NULL REFERENCES b2b_organization(id),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','verified','active','paused')),
 primary_domain boolean NOT NULL DEFAULT false,
 verified_at timestamptz, dns_verified_at timestamptz, tls_verified_at timestamptz, tls_expires_at timestamptz,
 verification_token text NOT NULL DEFAULT '', verification_evidence text NOT NULL DEFAULT '',
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,host),
 CHECK(status<>'active' OR (verified_at IS NOT NULL AND dns_verified_at IS NOT NULL AND tls_verified_at IS NOT NULL AND tls_expires_at IS NOT NULL AND tls_expires_at>tls_verified_at))
);
CREATE UNIQUE INDEX b2b_domain_primary_idx ON b2b_domain(organization_id) WHERE primary_domain AND status='active';
CREATE TABLE b2b_session_context (
 session_id text PRIMARY KEY REFERENCES b2b_auth_session(id) ON DELETE CASCADE,
 organization_id text NOT NULL, domain_host text NOT NULL, domain_generation integer NOT NULL CHECK(domain_generation>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,domain_host) REFERENCES b2b_domain(organization_id,host)
);

CREATE TABLE b2b_theme (
 organization_id text PRIMARY KEY REFERENCES b2b_organization(id),
 draft jsonb NOT NULL, published jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 published_version integer NOT NULL DEFAULT 1 CHECK(published_version>0)
);
CREATE TABLE b2b_theme_version (
 organization_id text NOT NULL REFERENCES b2b_organization(id), version integer NOT NULL CHECK(version>0), data jsonb NOT NULL,
 actor_id text REFERENCES b2b_auth_user(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,version)
);
INSERT INTO b2b_theme(organization_id,draft,published)
SELECT o.id,jsonb_build_object('brand',o.brand),jsonb_build_object('brand',coalesce(w.published->'brand',o.brand))
FROM b2b_organization o LEFT JOIN b2b_website w ON w.organization_id=o.id;
INSERT INTO b2b_theme_version(organization_id,version,data) SELECT organization_id,1,published FROM b2b_theme;

CREATE TABLE b2b_module_configuration (
 organization_id text NOT NULL REFERENCES b2b_organization(id),
 module text NOT NULL CHECK(module IN ('website','equipment','floorPlan','media','voice')),
 platform_enabled boolean NOT NULL DEFAULT true, brand_enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,module)
);
INSERT INTO b2b_module_configuration(organization_id,module)
SELECT o.id,m.module FROM b2b_organization o CROSS JOIN unnest(ARRAY['website','equipment','floorPlan','media','voice']) m(module);
CREATE TABLE b2b_branch_module (
 organization_id text NOT NULL, branch_id text NOT NULL, module text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,branch_id,module),
 FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id),
 FOREIGN KEY(organization_id,module) REFERENCES b2b_module_configuration(organization_id,module)
);
CREATE TABLE b2b_branch_catalog (
 organization_id text NOT NULL, branch_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('machine','exercise')), resource_id text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,branch_id,kind,resource_id),
 FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id)
);

ALTER TABLE b2b_unit ADD COLUMN branch_id text;
ALTER TABLE b2b_machine ADD COLUMN branch_id text;
ALTER TABLE b2b_exercise ADD COLUMN branch_id text;
ALTER TABLE b2b_program ADD COLUMN branch_id text;
ALTER TABLE b2b_program_version ADD COLUMN branch_id text;
ALTER TABLE b2b_program_assignment ADD COLUMN branch_id text;
ALTER TABLE b2b_program_assignment ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE b2b_execution ADD COLUMN branch_id text;
ALTER TABLE b2b_coach_assignment ADD COLUMN branch_id text;
ALTER TABLE b2b_invitation ADD COLUMN branch_id text;
ALTER TABLE b2b_unit_batch ADD COLUMN branch_id text;
ALTER TABLE b2b_media ADD COLUMN branch_id text;

UPDATE b2b_unit SET branch_id=b2b_principal_branch_id(organization_id);
UPDATE b2b_machine SET branch_id=b2b_principal_branch_id(organization_id) WHERE organization_id IS NOT NULL;
UPDATE b2b_exercise SET branch_id=b2b_principal_branch_id(organization_id) WHERE organization_id IS NOT NULL;
UPDATE b2b_program SET branch_id=b2b_principal_branch_id(organization_id);
UPDATE b2b_program_version SET branch_id=b2b_principal_branch_id(organization_id);
UPDATE b2b_program_assignment SET branch_id=b2b_principal_branch_id(organization_id);
UPDATE b2b_execution SET branch_id=b2b_principal_branch_id(organization_id);
UPDATE b2b_coach_assignment SET branch_id=b2b_principal_branch_id(organization_id);
UPDATE b2b_invitation SET branch_id=b2b_principal_branch_id(organization_id) WHERE role<>'admin';
UPDATE b2b_unit_batch SET branch_id=b2b_principal_branch_id(organization_id);
-- Existing media could be referenced by the brand website and remains brand-owned.

ALTER TABLE b2b_unit ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE b2b_program ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE b2b_program_version ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE b2b_program_assignment ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE b2b_execution ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE b2b_coach_assignment ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE b2b_unit_batch ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE b2b_unit ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_machine ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_exercise ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_machine ADD CHECK(organization_id IS NOT NULL OR branch_id IS NULL);
ALTER TABLE b2b_exercise ADD CHECK(organization_id IS NOT NULL OR branch_id IS NULL);
ALTER TABLE b2b_unit ADD UNIQUE(organization_id,branch_id,id);
ALTER TABLE b2b_program ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_program ADD UNIQUE(organization_id,branch_id,id);
ALTER TABLE b2b_program_version ADD FOREIGN KEY(organization_id,branch_id,program_id) REFERENCES b2b_program(organization_id,branch_id,id);
ALTER TABLE b2b_program_version ADD UNIQUE(organization_id,branch_id,program_id,version);
ALTER TABLE b2b_program_assignment ADD FOREIGN KEY(organization_id,branch_id,program_id,version) REFERENCES b2b_program_version(organization_id,branch_id,program_id,version);
ALTER TABLE b2b_program_assignment ADD UNIQUE(organization_id,branch_id,id,member_id);
ALTER TABLE b2b_execution ADD FOREIGN KEY(organization_id,branch_id,assignment_id,member_id) REFERENCES b2b_program_assignment(organization_id,branch_id,id,member_id);
ALTER TABLE b2b_coach_assignment DROP CONSTRAINT b2b_coach_assignment_pkey;
ALTER TABLE b2b_coach_assignment ADD PRIMARY KEY(organization_id,branch_id,coach_id,member_id);
ALTER TABLE b2b_coach_assignment ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_invitation ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_invitation ADD CHECK((role='admin' AND branch_id IS NULL) OR (role<>'admin' AND branch_id IS NOT NULL));
ALTER TABLE b2b_unit_batch DROP CONSTRAINT b2b_unit_batch_pkey;
ALTER TABLE b2b_unit_batch ADD PRIMARY KEY(organization_id,branch_id,id);
ALTER TABLE b2b_unit_batch ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
ALTER TABLE b2b_media ADD FOREIGN KEY(organization_id,branch_id) REFERENCES b2b_branch(organization_id,id);
CREATE INDEX b2b_unit_branch_idx ON b2b_unit(organization_id,branch_id);
CREATE INDEX b2b_assignment_branch_idx ON b2b_program_assignment(organization_id,branch_id,member_id);
CREATE INDEX b2b_execution_branch_idx ON b2b_execution(organization_id,branch_id,member_id);
CREATE INDEX b2b_branch_grant_user_idx ON b2b_branch_grant(organization_id,user_id) WHERE active;

-- Legacy writes remain scoped to Principal until all callers pass a branch explicitly.
-- These triggers never infer another existing branch or widen access to new branches.
CREATE FUNCTION b2b_initialize_organization_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO b2b_branch(id,organization_id,slug,name,address,contact) VALUES(b2b_principal_branch_id(NEW.id),NEW.id,'principal','Principal',coalesce(NEW.brand->>'address',''),coalesce(NEW.brand->>'contact',''));
 INSERT INTO b2b_theme(organization_id,draft,published) VALUES(NEW.id,jsonb_build_object('brand',NEW.brand),jsonb_build_object('brand',NEW.brand));
 INSERT INTO b2b_theme_version(organization_id,version,data) VALUES(NEW.id,1,jsonb_build_object('brand',NEW.brand));
 INSERT INTO b2b_module_configuration(organization_id,module) SELECT NEW.id,unnest(ARRAY['website','equipment','floorPlan','media','voice']);
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_initialize_organization_scope AFTER INSERT ON b2b_organization FOR EACH ROW EXECUTE FUNCTION b2b_initialize_organization_scope();
CREATE FUNCTION b2b_initialize_membership_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role IN ('coach','member') AND current_setting('b2b.explicit_branch_scope',true) IS DISTINCT FROM 'on' THEN
  INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role,active)
  VALUES(NEW.organization_id,b2b_principal_branch_id(NEW.organization_id),NEW.user_id,NEW.role,NEW.active)
  ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_initialize_membership_scope AFTER INSERT ON b2b_membership FOR EACH ROW EXECUTE FUNCTION b2b_initialize_membership_scope();
CREATE FUNCTION b2b_default_principal_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_id IS NULL THEN NEW.branch_id=b2b_principal_branch_id(NEW.organization_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_unit_scope BEFORE INSERT ON b2b_unit FOR EACH ROW EXECUTE FUNCTION b2b_default_principal_scope();
CREATE TRIGGER b2b_program_scope BEFORE INSERT ON b2b_program FOR EACH ROW EXECUTE FUNCTION b2b_default_principal_scope();
CREATE TRIGGER b2b_coach_assignment_scope BEFORE INSERT ON b2b_coach_assignment FOR EACH ROW EXECUTE FUNCTION b2b_default_principal_scope();
CREATE TRIGGER b2b_unit_batch_scope BEFORE INSERT ON b2b_unit_batch FOR EACH ROW EXECUTE FUNCTION b2b_default_principal_scope();
CREATE FUNCTION b2b_default_catalog_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_id IS NULL AND NEW.organization_id IS NOT NULL THEN NEW.branch_id=b2b_principal_branch_id(NEW.organization_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_machine_scope BEFORE INSERT ON b2b_machine FOR EACH ROW EXECUTE FUNCTION b2b_default_catalog_scope();
CREATE TRIGGER b2b_exercise_scope BEFORE INSERT ON b2b_exercise FOR EACH ROW EXECUTE FUNCTION b2b_default_catalog_scope();
CREATE FUNCTION b2b_default_invitation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_id IS NULL AND NEW.role<>'admin' THEN NEW.branch_id=b2b_principal_branch_id(NEW.organization_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_invitation_scope BEFORE INSERT ON b2b_invitation FOR EACH ROW EXECUTE FUNCTION b2b_default_invitation_scope();
CREATE FUNCTION b2b_default_program_version_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_id IS NULL THEN SELECT branch_id INTO NEW.branch_id FROM b2b_program WHERE organization_id=NEW.organization_id AND id=NEW.program_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_program_version_scope BEFORE INSERT ON b2b_program_version FOR EACH ROW EXECUTE FUNCTION b2b_default_program_version_scope();
CREATE TRIGGER b2b_program_assignment_scope BEFORE INSERT ON b2b_program_assignment FOR EACH ROW EXECUTE FUNCTION b2b_default_program_version_scope();
CREATE FUNCTION b2b_default_execution_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.branch_id IS NULL THEN SELECT branch_id INTO NEW.branch_id FROM b2b_program_assignment WHERE organization_id=NEW.organization_id AND id=NEW.assignment_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b2b_execution_scope BEFORE INSERT ON b2b_execution FOR EACH ROW EXECUTE FUNCTION b2b_default_execution_scope();
`;
