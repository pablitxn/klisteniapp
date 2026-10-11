import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { SCHEMA, LIFECYCLE_SCHEMA, CONTENT_SCHEMA } from '../src/database.ts';
import { WHITE_LABEL_SCHEMA, WHITE_LABEL_PROFILE_SCHEMA } from '../src/white-label-schema.ts';

const databaseUrl = process.env.B2B_TEST_DATABASE_URL;

test(
  'WL-1 profile migration freezes existing public metadata without changing historical JSON',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool) => {
      await legacyFixture(pool);
      await pool.query(WHITE_LABEL_SCHEMA);
      const before = (await pool.query('SELECT published,draft FROM b2b_branch ORDER BY id')).rows;
      await pool.query(WHITE_LABEL_PROFILE_SCHEMA);
      assert.deepEqual(
        (await pool.query('SELECT published,draft FROM b2b_branch ORDER BY id')).rows,
        before,
      );
      const profile = (
        await pool.query("SELECT published_profile FROM b2b_branch WHERE id='atlas-principal'")
      ).rows[0].published_profile;
      assert.deepEqual(profile, {
        id: 'atlas-principal',
        slug: 'principal',
        name: 'Principal',
        address: 'Street A',
        contact: 'Phone A',
        timezone: 'UTC',
      });
      await pool.query(
        "UPDATE b2b_branch SET address='Private draft address' WHERE id='atlas-principal'",
      );
      assert.deepEqual(
        (await pool.query("SELECT published_profile FROM b2b_branch WHERE id='atlas-principal'"))
          .rows[0].published_profile,
        profile,
      );
      assert.equal(
        (await pool.query("SELECT published_profile FROM b2b_branch WHERE id='sur-principal'"))
          .rows[0].published_profile,
        null,
      );
    });
  },
);

async function fixture(run: (pool: Pool) => Promise<void>) {
  const admin = new Pool({ connectionString: databaseUrl });
  const schema = `b2b_wl_migration_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href, max: 1 });
    await pool.query(
      'CREATE TABLE b2b_auth_user(id text PRIMARY KEY); CREATE TABLE b2b_auth_session(id text PRIMARY KEY)',
    );
    await pool.query(SCHEMA);
    await pool.query(LIFECYCLE_SCHEMA);
    await pool.query(CONTENT_SCHEMA);
    await run(pool);
  } finally {
    await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}

async function legacyFixture(pool: Pool) {
  await pool.query(`
    INSERT INTO b2b_auth_user(id) VALUES('admin'),('coach'),('member'),('other');
    INSERT INTO b2b_organization(id,slug,brand) VALUES
      ('atlas','atlas','{"name":"Atlas private","address":"Street A","contact":"Phone A"}'),
      ('sur','sur','{"name":"Sur"}');
    INSERT INTO b2b_membership(organization_id,user_id,role) VALUES
      ('atlas','admin','admin'),('atlas','coach','coach'),('atlas','member','member'),('atlas','other','member'),
      ('sur','admin','admin'),('sur','member','member');
    INSERT INTO b2b_coach_assignment(organization_id,coach_id,member_id) VALUES('atlas','coach','member');
    INSERT INTO b2b_website(organization_id,draft,published,published_revision,published_at) VALUES
      ('atlas','{"headline":"Draft"}','{"brand":{"name":"Atlas public"},"content":{"headline":"Published"}}',3,now());
    INSERT INTO b2b_invitation(id,organization_id,email,name,role,token_hash,expires_at,created_by) VALUES
      ('invite-coach','atlas','coach@example.test','Invited coach','coach','coach-secret',now()+interval '1 day','admin'),
      ('invite-admin','atlas','admin@example.test','Invited admin','admin','admin-secret',now()+interval '1 day','admin');
    INSERT INTO b2b_machine(id,organization_id,data) VALUES ('machine','atlas','{"name":"Machine"}'),('base-machine',NULL,'{"name":"Base"}');
    INSERT INTO b2b_exercise(id,organization_id,data,status) VALUES('exercise','atlas','{"name":"Exercise"}','published');
    INSERT INTO b2b_unit(id,organization_id,machine_id,label,location) VALUES('unit','atlas','machine','Unit','Near window');
    INSERT INTO b2b_program(id,organization_id,data) VALUES('program','atlas','{"name":"Legacy program"}');
    INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES('atlas','program',1,'{"name":"Legacy immutable","publicPath":"/g/atlas/units/unit"}');
    INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES('assignment','atlas','member','program',1,'coach');
    INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data) VALUES('atlas','execution','member','assignment','{"notes":"History remains byte-equivalent JSON"}');
    INSERT INTO b2b_unit_batch(organization_id,id,input,result) VALUES('atlas','batch','{"units":[]}','{"units":[{"id":"unit"}]}');
    INSERT INTO b2b_media(id,organization_id,created_by,kind,label,relative_path,mime,bytes,sha256) VALUES('media','atlas','admin','image','Photo','atlas/media','image/png',1,'hash');
  `);
}

test(
  'WL-1 migration preserves legacy IDs, immutable JSON, invitation expiry and Principal-only grants',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool) => {
      await legacyFixture(pool);
      const before = (
        await pool.query(`SELECT
      (SELECT snapshot FROM b2b_program_version) snapshot,
      (SELECT data FROM b2b_execution) execution,
      (SELECT expires_at FROM b2b_invitation WHERE id='invite-coach') expiry,
      (SELECT result FROM b2b_unit_batch) batch`)
      ).rows[0];
      await pool.query(WHITE_LABEL_SCHEMA);
      const after = (
        await pool.query(`SELECT
      (SELECT snapshot FROM b2b_program_version) snapshot,
      (SELECT data FROM b2b_execution) execution,
      (SELECT expires_at FROM b2b_invitation WHERE id='invite-coach') expiry,
      (SELECT result FROM b2b_unit_batch) batch`)
      ).rows[0];
      assert.deepEqual(after, before);
      assert.deepEqual((await pool.query('SELECT id,name FROM b2b_branch ORDER BY id')).rows, [
        { id: 'atlas-principal', name: 'Principal' },
        { id: 'sur-principal', name: 'Principal' },
      ]);
      for (const table of [
        'unit',
        'program',
        'program_version',
        'program_assignment',
        'execution',
        'coach_assignment',
        'unit_batch',
        'exercise',
      ]) {
        assert.equal(
          (await pool.query(`SELECT branch_id FROM b2b_${table} WHERE organization_id='atlas'`))
            .rows[0].branch_id,
          'atlas-principal',
        );
      }
      assert.equal(
        (await pool.query("SELECT branch_id FROM b2b_machine WHERE id='base-machine'")).rows[0]
          .branch_id,
        null,
      );
      assert.equal(
        (await pool.query("SELECT location FROM b2b_unit WHERE id='unit'")).rows[0].location,
        'Near window',
      );
      assert.equal(
        (await pool.query("SELECT branch_id FROM b2b_invitation WHERE id='invite-admin'")).rows[0]
          .branch_id,
        null,
      );
      assert.equal(
        (await pool.query("SELECT branch_id FROM b2b_invitation WHERE id='invite-coach'")).rows[0]
          .branch_id,
        'atlas-principal',
      );
      assert.equal(
        (await pool.query("SELECT branch_id FROM b2b_media WHERE id='media'")).rows[0].branch_id,
        null,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM b2b_branch_grant WHERE user_id='admin'"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT published->'brand'->>'name' name FROM b2b_theme WHERE organization_id='atlas'",
          )
        ).rows[0].name,
        'Atlas public',
      );
      assert.equal(
        (
          await pool.query(
            "SELECT draft->'brand'->>'name' name FROM b2b_theme WHERE organization_id='atlas'",
          )
        ).rows[0].name,
        'Atlas private',
      );
      assert.equal(
        (
          await pool.query(
            "SELECT published->>'headline' headline FROM b2b_branch WHERE id='atlas-principal'",
          )
        ).rows[0].headline,
        'Published',
      );
    });
  },
);

test(
  'WL-1 composite constraints reject cross-brand branches and cross-branch prescriptions and executions',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool) => {
      await legacyFixture(pool);
      await pool.query(WHITE_LABEL_SCHEMA);
      await pool.query(
        "INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES('north','atlas','north','North')",
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_unit(id,organization_id,branch_id,machine_id,label) VALUES('wrong','atlas','sur-principal','machine','Wrong')",
        ),
        /foreign key/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','sur-principal','member','member')",
        ),
        /foreign key/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES('bad','atlas','north','member','program',1,'coach')",
        ),
        /foreign key/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_execution(organization_id,branch_id,id,member_id,assignment_id,data) VALUES('atlas','north','bad','member','assignment','{}')",
        ),
        /foreign key/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data) VALUES('atlas','bad-owner','other','assignment','{}')",
        ),
        /foreign key/,
      );
      await pool.query(
        "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','north','member','coach'),('atlas','north','member','member')",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM b2b_branch_grant WHERE branch_id='north' AND user_id='member'",
          )
        ).rows[0].n,
        2,
      );
      await pool.query(
        "INSERT INTO b2b_unit_batch(organization_id,branch_id,id,input,result) VALUES('atlas','north','batch','{}','{}')",
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM b2b_unit_batch WHERE id='batch'")).rows[0].n,
        2,
      );
    });
  },
);

test(
  'WL-1 empty migration supports legacy writes and explicit scoped membership without privilege expansion',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool) => {
      await pool.query(WHITE_LABEL_SCHEMA);
      await pool.query("INSERT INTO b2b_auth_user(id) VALUES('legacy'),('scoped')");
      await pool.query(
        "INSERT INTO b2b_organization(id,slug,brand) VALUES('new-org','new-org','{\"name\":\"New\"}')",
      );
      await pool.query(
        "INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES('north','new-org','north','North')",
      );
      await pool.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('new-org','legacy','coach')",
      );
      assert.deepEqual(
        (await pool.query("SELECT branch_id,role FROM b2b_branch_grant WHERE user_id='legacy'"))
          .rows,
        [{ branch_id: 'new-org-principal', role: 'coach' }],
      );
      await pool.query('BEGIN');
      await pool.query("SELECT set_config('b2b.explicit_branch_scope','on',true)");
      await pool.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('new-org','scoped','member')",
      );
      await pool.query(
        "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('new-org','north','scoped','member')",
      );
      await pool.query('COMMIT');
      assert.deepEqual(
        (await pool.query("SELECT branch_id,role FROM b2b_branch_grant WHERE user_id='scoped'"))
          .rows,
        [{ branch_id: 'north', role: 'member' }],
      );
      await pool.query(
        "INSERT INTO b2b_machine(id,organization_id,data) VALUES('machine','new-org','{}')",
      );
      await pool.query(
        "INSERT INTO b2b_unit(id,organization_id,machine_id,label) VALUES('unit','new-org','machine','Legacy')",
      );
      assert.equal(
        (await pool.query("SELECT branch_id FROM b2b_unit WHERE id='unit'")).rows[0].branch_id,
        'new-org-principal',
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM b2b_module_configuration WHERE organization_id='new-org'",
          )
        ).rows[0].n,
        5,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_domain(host,organization_id,status,primary_domain) VALUES('new.b2b.test','new-org','active',true)",
        ),
        /check constraint/,
      );
      await pool.query(
        "INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at) VALUES('new.b2b.test','new-org','active',true,now(),now(),now(),now()+interval '1 day')",
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at) VALUES('other.b2b.test','new-org','active',true,now(),now(),now(),now()+interval '1 day')",
        ),
        /unique constraint/,
      );
    });
  },
);

test(
  'WL-1 anomalous execution ownership aborts atomically instead of relabeling history',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool) => {
      await legacyFixture(pool);
      await pool.query("UPDATE b2b_execution SET member_id='other'");
      await pool.query('BEGIN');
      await assert.rejects(pool.query(WHITE_LABEL_SCHEMA), /foreign key/);
      await pool.query('ROLLBACK');
      assert.equal(
        (await pool.query("SELECT to_regclass('b2b_branch') existing")).rows[0].existing,
        null,
      );
      assert.equal(
        (await pool.query("SELECT member_id FROM b2b_execution WHERE id='execution'")).rows[0]
          .member_id,
        'other',
      );
      assert.deepEqual(
        (await pool.query('SELECT snapshot FROM b2b_program_version')).rows[0].snapshot,
        { name: 'Legacy immutable', publicPath: '/g/atlas/units/unit' },
      );
    });
  },
);
