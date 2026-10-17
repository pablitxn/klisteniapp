import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { SCHEMA, LIFECYCLE_SCHEMA, CONTENT_SCHEMA } from '../src/database.ts';
import { WHITE_LABEL_SCHEMA, WHITE_LABEL_PROFILE_SCHEMA } from '../src/white-label-schema.ts';
import { B2BService } from '../src/service.ts';
import { migrate } from '../src/migrate.ts';
import { TrainingRepository } from '../src/training/repository.ts';
import { HttpError } from '../src/errors.ts';
import { assertLegacyProductAccess, assertProductCapability } from '../src/product-context.ts';
const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
const legacy = JSON.parse(
  readFileSync(
    new URL('../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function fixture(
  run: (pool: Pool, auth: ReturnType<typeof createAuth>, config: Config) => Promise<void>,
  legacyData = true,
) {
  const owner = new Pool({ connectionString: databaseUrl });
  const schema = `b2b_product_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool | undefined;
  try {
    const url = new URL(databaseUrl!);
    assert.match(url.pathname, /b2b.*test|test.*b2b/i);
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href, max: 10 });
    const config: Config = {
      databaseUrl: url.href,
      secret: 'product-synthetic-secret-12345678901234567890',
      origin: 'http://localhost:4200',
      host: '127.0.0.1',
      port: 0,
      production: false,
      demoMode: false,
    };
    const auth = createAuth(pool, config, { migrating: true });
    if (legacyData) {
      await (await getMigrations(auth.options)).runMigrations();
      await pool.query(
        SCHEMA +
          LIFECYCLE_SCHEMA +
          CONTENT_SCHEMA +
          WHITE_LABEL_SCHEMA +
          WHITE_LABEL_PROFILE_SCHEMA,
      );
      await pool.query(`CREATE TABLE b2b_migration(id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
        INSERT INTO b2b_migration(id) VALUES ('001-initial'),('002-catalog-lifecycle'),('003-content-media'),('004-white-label'),('005-branch-publication-profile');
        INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES
        ('admin','Admin','admin@example.test',true,now(),now()),('second','Second','second@example.test',true,now(),now()),('coach','Trainer','coach@example.test',true,now(),now()),('member','Member','member@example.test',true,now(),now()),('foreign','Foreign','foreign@example.test',true,now(),now());
        INSERT INTO b2b_organization(id,slug,brand) VALUES ('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}');
        INSERT INTO b2b_branch(id,organization_id,slug,name) VALUES ('atlas-east','atlas','east','East'),('sur-east','sur','east','East');
        INSERT INTO b2b_membership(organization_id,user_id,role) VALUES ('atlas','admin','admin'),('atlas','coach','coach'),('atlas','member','member'),('sur','admin','admin'),('sur','foreign','member');
        INSERT INTO b2b_invitation(id,organization_id,email,name,role,token_hash,expires_at,created_by) VALUES ('invite','atlas','invite@example.test','Invite','admin','synthetic-hash',now()+interval '1 day','admin');
        INSERT INTO b2b_media(id,organization_id,created_by,kind,label,relative_path,mime,bytes,sha256) VALUES ('media','atlas','admin','image','Fixture','atlas/fixture','image/png',1,'synthetic');
        INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id) VALUES ('atlas','coach','legacy.action','routine');`);
      await pool.query('INSERT INTO b2b_program(id,organization_id,data) VALUES($1,$2,$3)', [
        'routine',
        'atlas',
        {
          name: 'Original routine',
          description: 'Immutable prescription',
          steps: legacy.legacyRoutine.steps,
        },
      ]);
      await pool.query(
        'INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES($1,$2,1,$3)',
        ['atlas', 'routine', legacy.legacyRoutine],
      );
      await pool.query(
        "INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES('assignment','atlas','member','routine',1,'coach')",
      );
      await pool.query(
        'INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data) VALUES($1,$2,$3,$4,$5)',
        ['atlas', 'execution', 'member', 'assignment', legacy.legacyRetry],
      );
    }
    await run(pool, auth, config);
  } finally {
    await pool?.end();
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.end();
  }
}
async function originals(pool: Pool) {
  const queries = [
    'SELECT id,organization_id,branch_id,data::text,published_version,revision FROM b2b_program ORDER BY id',
    'SELECT organization_id,branch_id,program_id,version,snapshot::text,published_at FROM b2b_program_version ORDER BY program_id',
    'SELECT * FROM b2b_program_assignment ORDER BY id',
    'SELECT organization_id,branch_id,id,member_id,assignment_id,data::text,created_at FROM b2b_execution ORDER BY id',
    'SELECT * FROM b2b_media ORDER BY id',
    'SELECT * FROM b2b_branch_grant ORDER BY organization_id,branch_id,user_id,role',
    "SELECT id,organization_id,actor_id,action,resource_id,created_at FROM b2b_audit WHERE action='legacy.action' ORDER BY id",
  ];
  return Promise.all(queries.map(async (sql) => (await pool.query(sql)).rows));
}

test(
  'product migration installs into an empty database and repeats without rewriting rows',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth) => {
      await migrate(pool, auth);
      const before = (await pool.query('SELECT * FROM b2b_migration ORDER BY id')).rows;
      await migrate(pool, auth);
      assert.equal(before.length, 6);
      assert.deepEqual((await pool.query('SELECT * FROM b2b_migration ORDER BY id')).rows, before);
      assert.equal((await pool.query('SELECT * FROM b2b_occurrence')).rowCount, 0);
    }, false);
  },
);
test(
  '001-005 upgrade preserves historical JSON hashes, IDs, assignments, grants, audit and media across two brands/four branches',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth) => {
      const before = await originals(pool),
        beforeHash = hash(before);
      await migrate(pool, auth);
      await migrate(pool, auth);
      assert.deepEqual(await originals(pool), before);
      assert.equal(hash(await originals(pool)), beforeHash);
      assert.equal((await pool.query('SELECT id FROM b2b_branch')).rowCount, 4);
      assert.equal((await pool.query('SELECT * FROM b2b_platform_admin')).rowCount, 0);
      assert.equal((await pool.query('SELECT * FROM b2b_occurrence')).rowCount, 0);
      assert.equal(
        (await pool.query('SELECT * FROM b2b_organization WHERE product_active')).rowCount,
        0,
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT DISTINCT role,product_role FROM b2b_membership WHERE role='admin'",
          )
        ).rows,
        [{ role: 'admin', product_role: 'superadmin' }],
      );
      assert.equal(
        (await pool.query("SELECT product_role FROM b2b_invitation WHERE id='invite'")).rows[0]
          .product_role,
        'superadmin',
      );
      assert.equal(
        (await pool.query("SELECT * FROM b2b_audit WHERE action='product.role-migration'"))
          .rowCount,
        2,
      );
    });
  },
);
test(
  'new role mappings preserve legacy writes, constrain mappings and prevent the last superadmin loss',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth) => {
      await migrate(pool, auth);
      await assert.rejects(
        pool.query(
          "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='admin'",
        ),
        { code: '23514' },
      );
      await assert.rejects(
        pool.query("DELETE FROM b2b_membership WHERE organization_id='sur' AND user_id='admin'"),
        { code: '23514' },
      );
      await pool.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role,product_role) VALUES('atlas','second','admin','admin')",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT product_role FROM b2b_membership WHERE organization_id='atlas' AND user_id='second'",
          )
        ).rows[0].product_role,
        'admin',
      );
      await pool.query(
        "UPDATE b2b_membership SET role='coach' WHERE organization_id='atlas' AND user_id='second'",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT product_role FROM b2b_membership WHERE organization_id='atlas' AND user_id='second'",
          )
        ).rows[0].product_role,
        'coach',
      );
      await assert.rejects(
        pool.query(
          "UPDATE b2b_membership SET product_role='member' WHERE organization_id='atlas' AND user_id='second'",
        ),
        { code: '23514' },
      );
    });
  },
);
test(
  'competing superadmin deactivations serialize and retain one active administrator',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth) => {
      await migrate(pool, auth);
      await pool.query(
        "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('atlas','second','admin')",
      );
      const first = await pool.connect(),
        second = await pool.connect();
      try {
        await first.query('BEGIN');
        await second.query('BEGIN');
        await first.query(
          "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='admin'",
        );
        const competing = second
          .query(
            "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='second'",
          )
          .then(
            () => 'accepted',
            (error: { code: string }) => error.code,
          );
        await first.query('COMMIT');
        assert.equal(await competing, '23514');
        await second.query('ROLLBACK');
        assert.equal(
          (
            await pool.query(
              "SELECT * FROM b2b_membership WHERE organization_id='atlas' AND product_role='superadmin' AND active",
            )
          ).rowCount,
          1,
        );
      } finally {
        await first.query('ROLLBACK');
        await second.query('ROLLBACK');
        first.release();
        second.release();
      }
    });
  },
);
async function productFixture(pool: Pool) {
  await pool.query(`
    INSERT INTO b2b_goal_program(organization_id,branch_id,member_id,id,content) VALUES('atlas','atlas-principal','member','goal','{}');
    INSERT INTO b2b_goal_program_revision(organization_id,branch_id,member_id,goal_program_id,revision,content,actor_id) VALUES('atlas','atlas-principal','member','goal',0,'{}','coach');
    INSERT INTO b2b_enrollment(organization_id,branch_id,member_id,id,goal_program_id,issued_goal_revision,status) VALUES('atlas','atlas-principal','member','enrollment','goal',0,'active');
    INSERT INTO b2b_enrollment_revision(organization_id,branch_id,member_id,enrollment_id,revision,content,actor_id) VALUES('atlas','atlas-principal','member','enrollment',0,'{}','coach');
    INSERT INTO b2b_stage_revision(organization_id,branch_id,enrollment_id,enrollment_revision,id,ordinal,start_date,end_date,content) VALUES('atlas','atlas-principal','enrollment',0,'stage',0,'2026-10-19','2026-10-25','{}');
    INSERT INTO b2b_occurrence(organization_id,branch_id,member_id,id,enrollment_id,issued_enrollment_revision,stage_id,slot_id,slot_ordinal,program_id,program_version,original_date,original_week_start,time_zone,scheduled_date,current_week_start,eligibility)
      VALUES('atlas','atlas-principal','member','occurrence','enrollment',0,'stage','slot',0,'routine',1,'2026-10-19','2026-10-19','Europe/Madrid','2026-10-19','2026-10-19','required');
    INSERT INTO b2b_training_session(organization_id,branch_id,member_id,id,occurrence_id,program_id,program_version) VALUES('atlas','atlas-principal','member','session','occurrence','routine',1);
    INSERT INTO b2b_session_revision(organization_id,branch_id,member_id,session_id,revision,schema_version,operation_id,snapshot,actor_id) VALUES('atlas','atlas-principal','member','session',1,2,'operation','{}','member');
  `);
}
test(
  'tenant/member/branch FKs reject foreign linkage and historical identities and revisions cannot be overwritten',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth) => {
      await migrate(pool, auth);
      await productFixture(pool);
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_goal_program(organization_id,branch_id,member_id,id,content) VALUES('sur','atlas-east','foreign','bad','{}')",
        ),
        { code: '23503' },
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO b2b_training_session(organization_id,branch_id,member_id,id,occurrence_id,program_id,program_version) VALUES('atlas','atlas-principal','coach','bad','occurrence','routine',1)",
        ),
        { code: '23503' },
      );
      await assert.rejects(
        pool.query("UPDATE b2b_occurrence SET slot_ordinal=1 WHERE id='occurrence'"),
        { code: '23514' },
      );
      await assert.rejects(pool.query("DELETE FROM b2b_occurrence WHERE id='occurrence'"), {
        code: '23514',
      });
      await assert.rejects(
        pool.query(
          "UPDATE b2b_session_revision SET snapshot='{\"changed\":true}' WHERE session_id='session'",
        ),
        { code: '23514' },
      );
      await assert.rejects(
        pool.query(
          "UPDATE b2b_training_session SET occurrence_id=NULL,legacy_assignment_id='assignment' WHERE id='session'",
        ),
        { code: '23514' },
      );
      await pool.query(
        "UPDATE b2b_occurrence SET scheduled_date='2026-10-23',permitted_date_override='2026-10-23',revision=1 WHERE id='occurrence'",
      );
      assert.equal(
        (await pool.query("SELECT original_date::text FROM b2b_occurrence WHERE id='occurrence'"))
          .rows[0].original_date,
        '2026-10-19',
      );
    });
  },
);
test(
  'v2 rows are fenced before legacy decoding or update and old clients get explicit version errors',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth) => {
      await migrate(pool, auth);
      await pool.query(
        "UPDATE b2b_program SET schema_version=2,data='{\"schemaVersion\":2}' WHERE id='routine'",
      );
      const client = await pool.connect();
      try {
        const repository = new TrainingRepository({
          db: client,
          actorId: 'admin',
          role: 'admin',
          branchId: 'atlas-principal',
          org: {
            id: 'atlas',
            slug: 'atlas',
            brand: {
              name: 'Atlas',
              address: '',
              contact: '',
              description: '',
              color: '#123456',
              logoUrl: '',
            },
            service_enabled: true,
            service_ends_at: null,
          },
        });
        await assert.rejects(
          repository.program('routine'),
          (error) =>
            error instanceof HttpError && error.code === 'UPGRADE_REQUIRED' && error.status === 426,
        );
        await assert.rejects(
          repository.programs(),
          (error) => error instanceof HttpError && error.code === 'UPGRADE_REQUIRED',
        );
        assert.equal(
          await repository.updateProgram(
            'routine',
            { name: 'Legacy overwrite', description: '', steps: [] },
            0,
          ),
          undefined,
        );
        assert.deepEqual(
          (await pool.query("SELECT data FROM b2b_program WHERE id='routine'")).rows[0].data,
          { schemaVersion: 2 },
        );
        await pool.query(
          "INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot,schema_version) VALUES('atlas','routine',2,'{\"schemaVersion\":2}',2)",
        );
        await assert.rejects(
          repository.programVersion('routine', 2),
          (error) => error instanceof HttpError && error.code === 'UPGRADE_REQUIRED',
        );
        await pool.query(
          "INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES('assignment-v2','atlas','member','routine',2,'coach')",
        );
        await assert.rejects(
          repository.assignments(),
          (error) => error instanceof HttpError && error.code === 'UPGRADE_REQUIRED',
        );
        await pool.query(
          "INSERT INTO b2b_training_session(organization_id,branch_id,member_id,id,legacy_assignment_id,legacy_execution_id,program_id,program_version,revision) VALUES('atlas','atlas-principal','member','legacy-session','assignment','execution','routine',1,1)",
        );
        await assert.rejects(
          repository.executions(),
          (error) => error instanceof HttpError && error.code === 'UPGRADE_REQUIRED',
        );
        assert.deepEqual((await repository.priorExecution('execution'))?.data, legacy.legacyRetry);
      } finally {
        client.release();
      }
    });
  },
);
test('activation and old-tab guards fail closed with explicit recoverable codes', () => {
  assert.doesNotThrow(() => assertLegacyProductAccess(false));
  assert.throws(() => assertLegacyProductAccess(true), { code: 'UPGRADE_REQUIRED' });
  assert.throws(() => assertProductCapability(undefined, true), { code: 'UPGRADE_REQUIRED' });
  assert.throws(() => assertProductCapability('2', false), { code: 'PRODUCT_NOT_ACTIVE' });
  assert.doesNotThrow(() => assertProductCapability('2', true));
});
test(
  'activated organizations reject every legacy callback after current authorization checks',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (pool, auth, config) => {
      await migrate(pool, auth);
      await pool.query(
        'INSERT INTO b2b_auth_session(id,"userId",token,"expiresAt","createdAt","updatedAt") VALUES(\'session\',\'admin\',\'synthetic-token\',now()+interval \'1 hour\',now(),now())',
      );
      const service = new B2BService(pool, auth, config);
      assert.equal(
        await service.organization('admin', 'atlas', 'session', false, async () => 'legacy'),
        'legacy',
      );
      await pool.query("UPDATE b2b_organization SET product_active=true WHERE id='atlas'");
      let executed = false;
      await assert.rejects(
        service.organization('admin', 'atlas', 'session', true, async () => {
          executed = true;
        }),
        { code: 'UPGRADE_REQUIRED' },
      );
      assert.equal(executed, false);
      await pool.query("DELETE FROM b2b_auth_session WHERE id='session'");
      await assert.rejects(
        service.organization('admin', 'atlas', 'session', true, async () => {
          executed = true;
        }),
        { code: 'UNAUTHENTICATED' },
      );
      assert.equal(executed, false);
    });
  },
);
