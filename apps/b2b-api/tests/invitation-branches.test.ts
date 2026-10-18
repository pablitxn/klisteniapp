import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseUrl, productFixture } from './support/product-fixture.ts';
import { invitationBranches, inviteProductMember } from '../src/auth/product-people.ts';
import { ProductEndpoints } from '@klisteniapp/b2b-contracts/product-v2';

test(
  'invitation branch metadata includes archived same-organization rows only for current administrators',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      await pool.query("UPDATE b2b_branch SET status='archived' WHERE id='atlas-north'");
      const rows = ProductEndpoints.invitationBranches.output.parse(
        await scoped('admin', 'atlas-principal', false, invitationBranches),
      );
      assert.equal(rows.length, 2);
      assert.ok(rows.every((row) => row.organizationId === 'atlas'));
      assert.deepEqual(
        rows.find((row) => row.branchId === 'atlas-north'),
        { organizationId: 'atlas', branchId: 'atlas-north', name: 'North', status: 'archived' },
      );
      assert.ok(rows.every((row) => Object.keys(row).length === 4));
      for (const actor of ['coach', 'member', 'inactive'])
        await assert.rejects(scoped(actor, 'atlas-principal', false, invitationBranches));
      await assert.rejects(
        scoped('admin', 'sur-principal', false, invitationBranches, { organizationId: 'sur' }),
      );
      await pool.query(
        "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','admin','coach')",
      );
      await assert.rejects(
        scoped('admin', 'atlas-principal', false, invitationBranches, { role: 'coach' }),
      );
      assert.ok(
        (
          await scoped('super', 'sur-principal', false, invitationBranches, {
            organizationId: 'sur',
          })
        ).every((row) => row.organizationId === 'sur'),
      );
    });
  },
);

test(
  'archive after metadata read rejects active grants while retaining explicit inactive intent',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      const rows = await scoped('admin', 'atlas-principal', false, invitationBranches);
      assert.equal(rows.find((row) => row.branchId === 'atlas-north')?.status, 'active');
      await pool.query("UPDATE b2b_branch SET status='archived' WHERE id='atlas-north'");
      const input = {
        id: 'archived-choice',
        operationId: 'archived-choice',
        expectedRevision: 0,
        email: 'archived-choice@example.test',
        name: 'Synthetic',
        role: 'member' as const,
        branchGrants: [{ branchId: 'atlas-north', role: 'member' as const, active: true }],
      };
      await assert.rejects(
        scoped('admin', 'atlas-principal', true, (c) =>
          inviteProductMember(c, input, 'http://localhost:4200'),
        ),
        { status: 404 },
      );
      await scoped('admin', 'atlas-principal', true, (c) =>
        inviteProductMember(
          c,
          { ...input, branchGrants: [{ ...input.branchGrants[0], active: false }] },
          'http://localhost:4200',
        ),
      );
      assert.deepEqual(
        (await pool.query("SELECT branch_grants FROM b2b_invitation WHERE id='archived-choice'"))
          .rows[0].branch_grants,
        [{ branchId: 'atlas-north', role: 'member', active: false }],
      );
    });
  },
);

test(
  'queued metadata disclosure rechecks membership after the organization lock',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped, schema }) => {
      const writer = await pool.connect();
      try {
        await writer.query('BEGIN');
        await writer.query("SELECT id FROM b2b_organization WHERE id='atlas' FOR UPDATE");
        const queued = scoped('admin', 'atlas-principal', false, invitationBranches).then(
          () => 'disclosed',
          () => 'denied',
        );
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const blocked = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%SELECT * FROM b2b_organization%'",
            [schema],
          );
          if (blocked.rowCount) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(waiting);
        await writer.query(
          "UPDATE b2b_membership SET active=false, access_revision=access_revision+1 WHERE organization_id='atlas' AND user_id='admin'",
        );
        await writer.query('COMMIT');
        assert.equal(await queued, 'denied');
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
      }
    });
  },
);
