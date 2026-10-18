import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { updateProductMember } from '../src/auth/product-people.ts';
import { migrate } from '../src/migrate.ts';
import { PRODUCT_AUDIT_MIGRATION_ID } from '../src/product-audit-schema.ts';
import { databaseUrl, productFixture } from './support/product-fixture.ts';

// Only this test's disposable schema is rewound to the original 006 index.
async function originalIndex(pool: Pool) {
  await pool.query(`DROP INDEX b2b_product_audit_operation;
    CREATE UNIQUE INDEX b2b_product_audit_operation ON b2b_audit
    (organization_id,actor_id,operation_id,action,resource_id) WHERE operation_id IS NOT NULL`);
  await pool.query('DELETE FROM b2b_migration WHERE id=$1', [PRODUCT_AUDIT_MIGRATION_ID]);
}
const auditBytes = async (pool: Pool) =>
  (await pool.query('SELECT row_to_json(a)::text AS bytes FROM b2b_audit a ORDER BY id')).rows;

test(
  '008 upgrades the old index without changing historical audit rows and repeats safely',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ pool, auth }) => {
      await originalIndex(pool);
      await pool.query(`INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id,operation_id)
      VALUES ('atlas','super','legacy.operation','old-resource','old-operation'),
      ('atlas',NULL,'legacy.unknown','old-resource',NULL),
      ('atlas',NULL,'legacy.unknown','old-resource',NULL)`);
      const before = await auditBytes(pool);
      await migrate(pool, auth);
      await migrate(pool, auth);
      assert.deepEqual(await auditBytes(pool), before);
      assert.equal(
        (await pool.query('SELECT 1 FROM b2b_migration WHERE id=$1', [PRODUCT_AUDIT_MIGRATION_ID]))
          .rowCount,
        1,
      );
      const index = (
        await pool.query(
          "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='b2b_product_audit_operation'",
        )
      ).rows[0].indexdef;
      assert.match(index, /action, branch_id, resource_id/);
      assert.match(index, /NULLS NOT DISTINCT/);
    }),
);

test(
  '008 treats nullable identity keys consistently and retains branch-distinct operations',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ pool }) => {
      const insert = (
        branch: string | null,
        actor: string | null,
        organization: string | null = 'atlas',
      ) =>
        pool.query(
          `INSERT INTO b2b_audit(organization_id,branch_id,actor_id,action,resource_id,operation_id)
        VALUES ($1,$2,$3,'test.identity','same-resource','same-operation')`,
          [organization, branch, actor],
        );
      await insert('atlas-principal', 'super');
      await insert('atlas-north', 'super');
      await assert.rejects(insert('atlas-principal', 'super'), { code: '23505' });
      await insert(null, 'super');
      await assert.rejects(insert(null, 'super'), { code: '23505' });
      await insert(null, null);
      await assert.rejects(insert(null, null), { code: '23505' });
      await insert(null, null, null);
      await assert.rejects(insert(null, null, null), { code: '23505' });
    }),
);

test(
  '008 refuses nullable historical collisions atomically without deleting or rewriting evidence',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ pool, auth }) => {
      await originalIndex(pool);
      await pool.query(`INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id,operation_id)
      VALUES ('atlas',NULL,'legacy.operation','same-resource','same-operation'),
      ('atlas',NULL,'legacy.operation','same-resource','same-operation')`);
      const before = await auditBytes(pool);
      const indexBefore = (
        await pool.query(
          "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='b2b_product_audit_operation'",
        )
      ).rows;
      await assert.rejects(migrate(pool, auth), { code: '23514' });
      assert.deepEqual(await auditBytes(pool), before);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='b2b_product_audit_operation'",
          )
        ).rows,
        indexBefore,
      );
      assert.equal(
        (await pool.query('SELECT 1 FROM b2b_migration WHERE id=$1', [PRODUCT_AUDIT_MIGRATION_ID]))
          .rowCount,
        0,
      );
    }),
);

test(
  'membership deactivation revokes same-ID consents in two branches atomically, retries once and never restores consent',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ pool, scoped }) => {
      await pool.query(`INSERT INTO b2b_health_consent(organization_id,branch_id,owner_id,id,categories,audience,disclosure_version,revision)
      VALUES ('atlas','atlas-principal','member','same-consent','["activity"]','current-authorized-branch-trainers',1,1),
      ('atlas','atlas-north','member','same-consent','["activity"]','current-authorized-branch-trainers',1,1);
      CREATE FUNCTION reject_synthetic_health_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action='health.consent.membership-inactive' AND NEW.branch_id='atlas-north' THEN
          RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE='23514';
        END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_synthetic_health_audit BEFORE INSERT ON b2b_audit
        FOR EACH ROW EXECUTE FUNCTION reject_synthetic_health_audit()`);
      const input = {
        memberId: 'member',
        active: false,
        operationId: 'pause-two-branches',
        expectedRevision: 0,
      };
      const pause = () =>
        scoped('super', 'atlas-principal', true, (c) => updateProductMember(c, input));
      const before = await auditBytes(pool);
      await assert.rejects(pause(), { code: '23514' });
      assert.equal(
        (
          await pool.query(
            "SELECT active FROM b2b_membership WHERE organization_id='atlas' AND user_id='member'",
          )
        ).rows[0].active,
        true,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM b2b_health_consent WHERE owner_id='member' AND revoked_at IS NULL AND revision=1",
          )
        ).rows[0].count,
        2,
      );
      assert.equal((await pool.query('SELECT 1 FROM b2b_health_consent_revision')).rowCount, 0);
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM b2b_operation_receipt WHERE operation_id='pause-two-branches'",
          )
        ).rowCount,
        0,
      );
      assert.deepEqual(await auditBytes(pool), before);
      await pool.query('DROP TRIGGER reject_synthetic_health_audit ON b2b_audit');
      const paused = await pause();
      assert.deepEqual(await pause(), paused);
      const consents = (
        await pool.query(
          "SELECT * FROM b2b_health_consent WHERE owner_id='member' ORDER BY branch_id",
        )
      ).rows;
      assert.ok(consents.every((c) => c.revision === 2 && c.revoked_at));
      assert.equal((await pool.query('SELECT 1 FROM b2b_health_consent_revision')).rowCount, 2);
      const audit = (
        await pool.query(
          "SELECT branch_id,resource_id,before_revision,after_revision,changed_fields FROM b2b_audit WHERE operation_id='pause-two-branches' AND action='health.consent.membership-inactive' ORDER BY branch_id",
        )
      ).rows;
      assert.deepEqual(
        audit,
        ['atlas-north', 'atlas-principal'].map((branch_id) => ({
          branch_id,
          resource_id: 'same-consent',
          before_revision: '1',
          after_revision: '2',
          changed_fields: ['status', 'categories', 'audience', 'disclosureVersion'],
        })),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM b2b_audit WHERE operation_id='pause-two-branches' AND action='membership.update'",
          )
        ).rowCount,
        1,
      );
      await scoped('super', 'atlas-principal', true, (c) =>
        updateProductMember(c, {
          memberId: 'member',
          active: true,
          operationId: 'resume-two-branches',
          expectedRevision: paused.revision,
        }),
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT * FROM b2b_health_consent WHERE owner_id='member' ORDER BY branch_id",
          )
        ).rows,
        consents,
      );
    }),
);
