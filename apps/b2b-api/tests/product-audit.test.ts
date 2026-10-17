import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  productOperation,
  productRequestHash,
  readProductAudit,
  writeProductAudit,
} from '../src/audit/product-audit.ts';
import { inviteProductMember, updateProductMember } from '../src/auth/product-people.ts';
import { databaseUrl, productFixture } from './support/product-fixture.ts';

const branch = 'atlas-principal';
test('operation hashing sorts object keys while preserving arrays and actual scalar values', () => {
  assert.equal(
    productRequestHash({ a: 2, b: { c: 3, d: 4 } }),
    productRequestHash({ b: { d: 4, c: 3 }, a: 2 }),
  );
  assert.notEqual(productRequestHash([1, 2]), productRequestHash([2, 1]));
  assert.notEqual(productRequestHash({ a: 0 }), productRequestHash({ a: null }));
});
test(
  'audit records actor/branch/server time and immutable revisions exactly once; failure rolls back audit and receipt',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      const input = { operationId: 'planning-one', expectedRevision: 0 };
      const run = () =>
        scoped('coach', branch, true, (c) =>
          productOperation(c, 'planning.edit', input, 'routine', async () => {
            await writeProductAudit(c, {
              action: 'planning.edit',
              resourceId: 'routine',
              operationId: input.operationId,
              beforeRevision: 0,
              afterRevision: 1,
              changedFields: ['stages', 'objective'],
            });
            return { response: { revision: 1 }, revision: 1 };
          }),
        );
      const before = Date.now();
      assert.deepEqual(await run(), await run());
      const changes = await scoped('coach', branch, false, (c) =>
        readProductAudit(c, { id: 'routine' }),
      );
      assert.equal(changes.length, 1);
      assert.equal(changes[0].actorId, 'coach');
      assert.equal(changes[0].branchId, branch);
      assert.deepEqual(changes[0].changedFields, ['stages', 'objective']);
      assert.equal(changes[0].beforeRevision, 0);
      assert.equal(changes[0].afterRevision, 1);
      assert.ok(Date.parse(changes[0].createdAt) >= before - 1000);
      await assert.rejects(
        scoped('coach', branch, true, (c) =>
          productOperation(
            c,
            'planning.edit',
            { operationId: 'failed', expectedRevision: 1 },
            'routine',
            async () => {
              await writeProductAudit(c, {
                action: 'planning.edit',
                resourceId: 'routine',
                operationId: 'failed',
                beforeRevision: 1,
                afterRevision: 2,
                changedFields: ['stages'],
              });
              throw new Error('Synthetic transaction failure');
            },
          ),
        ),
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_audit WHERE operation_id='failed'")).rowCount,
        0,
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_operation_receipt WHERE operation_id='failed'"))
          .rowCount,
        0,
      );
    }),
);
test(
  'audit projects only current tenant/branch planning scope; legacy absent metadata stays unknown',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      await pool.query(`INSERT INTO b2b_audit(organization_id,branch_id,actor_id,action,resource_id) VALUES
    ('atlas','atlas-principal','other-coach','program.update','shared'),
    ('atlas','atlas-north','other-coach','program.update','shared'),
    ('sur','sur-principal','super','program.update','shared'),
    ('atlas','atlas-principal','super','membership.update','shared'),
    ('atlas',NULL,NULL,'legacy.unknown','shared');`);
      const coach = await scoped('coach', branch, false, (c) =>
        readProductAudit(c, { id: 'shared' }),
      );
      assert.equal(coach.length, 1);
      assert.equal(coach[0].actorId, 'other-coach');
      assert.equal(coach[0].beforeRevision, null);
      assert.equal(coach[0].operationId, null);
      assert.deepEqual(coach[0].changedFields, []);
      const admin = await scoped('super', branch, false, (c) =>
        readProductAudit(c, { id: 'shared' }),
      );
      assert.equal(admin.length, 3);
      assert.ok(
        admin.every((r) => r.organizationId === 'atlas' && (!r.branchId || r.branchId === branch)),
      );
      await assert.rejects(
        scoped('member', branch, false, (c) => readProductAudit(c, { id: 'shared' })),
      );
    }),
);
test(
  'invitation exact retries preserve the private URL and role; accepting narrower admin never creates a superadmin',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, service, pool }) => {
      const input = {
        id: 'new-admin',
        email: 'new-admin@example.test',
        name: 'New Admin',
        role: 'admin' as const,
        branchGrants: [],
        expectedRevision: 0,
        operationId: 'invite-admin',
      };
      const invitation = await scoped('super', branch, true, (c) =>
        inviteProductMember(c, input, 'http://localhost:4200'),
      );
      assert.deepEqual(
        await scoped('super', branch, true, (c) =>
          inviteProductMember(c, input, 'http://localhost:4200'),
        ),
        invitation,
      );
      const token = new URLSearchParams(new URL(invitation.invitationUrl).hash.slice(1)).get(
        'token',
      )!;
      await service.acceptInvitation(token, {
        name: 'New Admin',
        password: 'synthetic-password-for-tests',
      });
      const membership = (
        await pool.query(
          `SELECT m.product_role FROM b2b_membership m JOIN b2b_auth_user u ON u.id=m.user_id WHERE u.email='new-admin@example.test'`,
        )
      ).rows[0];
      assert.equal(membership.product_role, 'admin');
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_audit WHERE operation_id='invite-admin'")).rowCount,
        1,
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_invitation WHERE id='new-admin'")).rowCount,
        1,
      );
    }),
);
test(
  'deactivation atomically appends consent revocation and reactivation never restores it',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool }) => {
      await pool.query(`INSERT INTO b2b_health_consent(organization_id,branch_id,owner_id,id,categories,audience,disclosure_version,revision)
    VALUES('atlas','atlas-principal','member','consent','["activity"]','current-authorized-branch-trainers',1,1)`);
      const paused = await scoped('super', branch, true, (c) =>
        updateProductMember(c, {
          memberId: 'member',
          active: false,
          operationId: 'pause-consent',
          expectedRevision: 0,
        }),
      );
      const consent = (await pool.query("SELECT * FROM b2b_health_consent WHERE id='consent'"))
        .rows[0];
      assert.ok(consent.revoked_at);
      assert.equal(consent.revision, 2);
      const revision = (
        await pool.query("SELECT * FROM b2b_health_consent_revision WHERE consent_id='consent'")
      ).rows[0];
      assert.equal(revision.snapshot.status, 'revoked');
      assert.equal(revision.reason, 'membership-inactive');
      await scoped('super', branch, true, (c) =>
        updateProductMember(c, {
          memberId: 'member',
          active: true,
          operationId: 'resume-consent',
          expectedRevision: paused.revision,
        }),
      );
      assert.deepEqual(
        (await pool.query("SELECT * FROM b2b_health_consent WHERE id='consent'")).rows[0],
        consent,
      );
      const audit = (
        await pool.query(
          "SELECT changed_fields FROM b2b_audit WHERE operation_id='pause-consent' AND action='membership.update'",
        )
      ).rows[0];
      assert.deepEqual(audit.changed_fields, ['active']);
      const consentAudit = (
        await pool.query(
          "SELECT resource_id,before_revision,after_revision,changed_fields FROM b2b_audit WHERE operation_id='pause-consent' AND action='health.consent.membership-inactive'",
        )
      ).rows;
      assert.deepEqual(consentAudit, [
        {
          resource_id: 'consent',
          before_revision: '1',
          after_revision: '2',
          changed_fields: ['status', 'categories', 'audience', 'disclosureVersion'],
        },
      ]);
    }),
);

test(
  'unrepresentable invitation grants fail atomically and revoked issuers cannot grant pending invitations',
  { skip: !databaseUrl },
  async () =>
    productFixture(async ({ scoped, pool, service }) => {
      const base = {
        id: 'scoped-invite',
        email: 'scoped@example.test',
        name: 'Scoped Coach',
        role: 'coach' as const,
        operationId: 'scope-invite',
        expectedRevision: 0,
      };
      await assert.rejects(
        scoped('super', branch, true, (c) =>
          inviteProductMember(
            c,
            {
              ...base,
              branchGrants: [
                { branchId: branch, role: 'coach', active: true },
                { branchId: 'atlas-north', role: 'coach', active: true },
              ],
            },
            'http://localhost:4200',
          ),
        ),
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_invitation WHERE id='scoped-invite'")).rowCount,
        0,
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_operation_receipt WHERE operation_id='scope-invite'"))
          .rowCount,
        0,
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_audit WHERE operation_id='scope-invite'")).rowCount,
        0,
      );
      const invitation = await scoped('admin', branch, true, (c) =>
        inviteProductMember(
          c,
          { ...base, branchGrants: [{ branchId: branch, role: 'coach', active: true }] },
          'http://localhost:4200',
        ),
      );
      await pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='admin'",
      );
      const token = new URLSearchParams(new URL(invitation.invitationUrl).hash.slice(1)).get(
        'token',
      )!;
      await assert.rejects(
        service.acceptInvitation(token, {
          name: 'Scoped Coach',
          password: 'synthetic-invitation-password',
        }),
      );
      assert.equal(
        (await pool.query("SELECT 1 FROM b2b_auth_user WHERE email='scoped@example.test'"))
          .rowCount,
        0,
      );
      assert.equal(
        (await pool.query("SELECT used_at FROM b2b_invitation WHERE id='scoped-invite'")).rows[0]
          .used_at,
        null,
      );
    }),
);
