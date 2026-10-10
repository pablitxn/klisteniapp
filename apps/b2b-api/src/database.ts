import { Pool } from 'pg';
import type { Config } from './config.ts';
export function createPool(config: Pick<Config, 'databaseUrl'>): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    application_name: 'klisteni-b2b-api',
  });
  pool.on('error', () => console.error('B2B database connection failed'));
  return pool;
}
export const SCHEMA = `
CREATE TABLE b2b_environment (id boolean PRIMARY KEY DEFAULT true CHECK(id), purpose text NOT NULL CHECK(purpose IN ('normal','demo')));
INSERT INTO b2b_environment (purpose) VALUES ('normal');
CREATE TABLE b2b_platform_admin (user_id text PRIMARY KEY REFERENCES b2b_auth_user(id) ON DELETE CASCADE);
CREATE TABLE b2b_organization (id text PRIMARY KEY, slug text UNIQUE NOT NULL, brand jsonb NOT NULL, service_enabled boolean NOT NULL DEFAULT true, service_ends_at timestamptz);
CREATE TABLE b2b_membership (organization_id text NOT NULL REFERENCES b2b_organization(id), user_id text NOT NULL REFERENCES b2b_auth_user(id), role text NOT NULL CHECK(role IN ('admin','coach','member')), active boolean NOT NULL DEFAULT true, PRIMARY KEY(organization_id,user_id));
CREATE TABLE b2b_coach_assignment (organization_id text NOT NULL, coach_id text NOT NULL, member_id text NOT NULL, PRIMARY KEY(organization_id,coach_id,member_id), FOREIGN KEY(organization_id,coach_id) REFERENCES b2b_membership(organization_id,user_id), FOREIGN KEY(organization_id,member_id) REFERENCES b2b_membership(organization_id,user_id));
CREATE TABLE b2b_invitation (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES b2b_organization(id), email text NOT NULL, name text NOT NULL, role text NOT NULL CHECK(role IN ('admin','coach','member')), token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_by text NOT NULL REFERENCES b2b_auth_user(id));
CREATE TABLE b2b_machine (id text PRIMARY KEY, organization_id text REFERENCES b2b_organization(id), data jsonb NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0));
CREATE TABLE b2b_unit (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES b2b_organization(id), machine_id text NOT NULL REFERENCES b2b_machine(id), label text NOT NULL, location text NOT NULL DEFAULT '', assets jsonb NOT NULL DEFAULT '[]', adjustments text NOT NULL DEFAULT '', UNIQUE(organization_id,id));
CREATE TABLE b2b_exercise (id text PRIMARY KEY, organization_id text REFERENCES b2b_organization(id), data jsonb NOT NULL, status text NOT NULL CHECK(status IN ('draft','published')), version integer NOT NULL DEFAULT 1 CHECK(version>0), revision integer NOT NULL DEFAULT 0);
CREATE TABLE b2b_program (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES b2b_organization(id), data jsonb NOT NULL, published_version integer, revision integer NOT NULL DEFAULT 0, UNIQUE(organization_id,id));
CREATE TABLE b2b_program_version (organization_id text NOT NULL, program_id text NOT NULL, version integer NOT NULL CHECK(version>0), snapshot jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,program_id,version), FOREIGN KEY(organization_id,program_id) REFERENCES b2b_program(organization_id,id));
CREATE TABLE b2b_program_assignment (id text PRIMARY KEY, organization_id text NOT NULL, member_id text NOT NULL, program_id text NOT NULL, version integer NOT NULL, assigned_by text NOT NULL REFERENCES b2b_auth_user(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), FOREIGN KEY(organization_id,member_id) REFERENCES b2b_membership(organization_id,user_id), FOREIGN KEY(organization_id,program_id,version) REFERENCES b2b_program_version(organization_id,program_id,version));
CREATE TABLE b2b_execution (organization_id text NOT NULL, id text NOT NULL, member_id text NOT NULL, assignment_id text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,member_id) REFERENCES b2b_membership(organization_id,user_id), FOREIGN KEY(organization_id,assignment_id) REFERENCES b2b_program_assignment(organization_id,id));
CREATE INDEX b2b_assignment_member_idx ON b2b_program_assignment(organization_id,member_id);
CREATE INDEX b2b_execution_member_idx ON b2b_execution(organization_id,member_id);
CREATE TABLE b2b_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id text REFERENCES b2b_organization(id), actor_id text REFERENCES b2b_auth_user(id), action text NOT NULL, resource_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE b2b_public_rate_limit (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
`;
export const LIFECYCLE_SCHEMA = `
ALTER TABLE b2b_machine ADD COLUMN revision integer NOT NULL DEFAULT 0;
UPDATE b2b_machine SET data=jsonb_build_object('derivedFromId',NULL,'derivedFromVersion',NULL)||data;
ALTER TABLE b2b_unit ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE b2b_unit ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE b2b_unit ADD COLUMN public boolean NOT NULL DEFAULT true;
-- Preserve already published snapshots; adding an empty machine collection never resolves mutable current models into history.
UPDATE b2b_program_version SET snapshot=jsonb_build_object('machines','[]'::jsonb)||snapshot WHERE NOT snapshot ? 'machines';
`;
export const CONTENT_SCHEMA = `
ALTER TABLE b2b_machine ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','published'));
UPDATE b2b_machine SET status='published';
ALTER TABLE b2b_exercise DROP CONSTRAINT b2b_exercise_status_check;
ALTER TABLE b2b_exercise ADD CONSTRAINT b2b_exercise_status_check CHECK(status IN ('draft','reviewed','published'));
CREATE TABLE b2b_website (organization_id text PRIMARY KEY REFERENCES b2b_organization(id), draft jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, published jsonb, published_revision integer, published_at timestamptz);
-- Preserve previously public installations; new organizations start with no publication.
INSERT INTO b2b_website(organization_id,draft,published,published_revision,published_at)
SELECT id,jsonb_build_object('headline',brand->>'name','introduction',coalesce(brand->>'description',''),'activities','[]'::jsonb,'openingHours','[]'::jsonb,'gallery','[]'::jsonb),
jsonb_build_object('brand',brand,'content',jsonb_build_object('headline',brand->>'name','introduction',coalesce(brand->>'description',''),'activities','[]'::jsonb,'openingHours','[]'::jsonb,'gallery','[]'::jsonb)),0,now() FROM b2b_organization;
CREATE TABLE b2b_unit_batch(organization_id text NOT NULL REFERENCES b2b_organization(id), id text NOT NULL, input jsonb NOT NULL, result jsonb NOT NULL, PRIMARY KEY(organization_id,id));
CREATE TABLE b2b_media(id text PRIMARY KEY, organization_id text NOT NULL REFERENCES b2b_organization(id), created_by text NOT NULL REFERENCES b2b_auth_user(id), kind text NOT NULL CHECK(kind IN ('image','video','model3d')), label text NOT NULL, attribution text NOT NULL DEFAULT '', relative_path text NOT NULL UNIQUE, mime text NOT NULL, bytes bigint NOT NULL CHECK(bytes>0), sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX b2b_media_org_idx ON b2b_media(organization_id);
`;
