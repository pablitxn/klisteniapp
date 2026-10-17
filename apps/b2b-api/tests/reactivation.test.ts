import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { updateProductMember } from '../src/auth/product-people.ts';
import { createHealthServices } from '../src/health/index.ts';
import { authorizeProductMember } from '../src/auth/product-policy.ts';
import { revokeHealthForInactiveMembership } from '../src/health/consent.ts';
import { grantInput } from './fixtures/health.ts';
import { errorCode, fixture, seedHistory } from './wp06/fixture.ts';

test('WP06 atomic inactivity revokes each branch consent once; gym historical training and other tenant consent survive', async () => {
  await fixture(async (f) => {
    await seedHistory(f.pool);
    const health = createHealthServices();
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-north','member','member'); INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('sur','member','member')",
    );
    // Same consent ID in two branches exercises migration008's audit identity.
    await f.scoped('member', 'atlas-principal', true, (c) =>
      health.grantHealthConsent(c, grantInput('same-consent')),
    );
    await f.scoped('member', 'atlas-north', true, (c) =>
      health.grantHealthConsent(c, grantInput('same-consent')),
    );
    await f.scoped(
      'member',
      'sur-principal',
      true,
      (c) => health.grantHealthConsent(c, grantInput('same-consent')),
      { organizationId: 'sur' },
    );
    const original = await f.own((c) => f.exports.personalExport(c, {}));
    const revision = Number(
      (
        await f.pool.query(
          "SELECT access_revision FROM b2b_membership WHERE organization_id='atlas' AND user_id='member'",
        )
      ).rows[0].access_revision,
    );
    const request = {
      memberId: 'member',
      active: false,
      expectedRevision: revision,
      operationId: randomUUID(),
    };
    const deactivated = await f.scoped('super', 'atlas-principal', true, (c) =>
      updateProductMember(c, request),
    );
    assert.equal(deactivated.active, false);
    assert.deepEqual(
      await f.scoped('super', 'atlas-principal', true, (c) => updateProductMember(c, request)),
      deactivated,
    );
    const consents = (
      await f.pool.query(
        "SELECT organization_id,branch_id,revision,revoked_at FROM b2b_health_consent WHERE owner_id='member' ORDER BY organization_id,branch_id",
      )
    ).rows;
    assert.equal(
      consents.filter(
        (row) => row.organization_id === 'atlas' && row.revoked_at && row.revision === 2,
      ).length,
      2,
    );
    assert.equal(
      consents.filter(
        (row) => row.organization_id === 'sur' && !row.revoked_at && row.revision === 1,
      ).length,
      1,
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT count(*)::int AS count FROM b2b_audit WHERE action='health.consent.membership-inactive' AND resource_id='same-consent'",
        )
      ).rows[0].count,
      2,
    );
    await f.service.transaction((db) =>
      revokeHealthForInactiveMembership(
        { db, organizationId: 'atlas', actorId: 'super' },
        'member',
        request.operationId,
      ),
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT count(*)::int AS count FROM b2b_audit WHERE action='health.consent.membership-inactive'",
        )
      ).rows[0].count,
      2,
    );
    await f.scoped('coach', 'atlas-principal', false, (c) =>
      authorizeProductMember(c.db, 'atlas', c.branchId, c.actorId, c.role, 'member', 'history'),
    );
    await assert.rejects(
      f.scoped('coach', 'atlas-principal', false, (c) =>
        authorizeProductMember(c.db, 'atlas', c.branchId, c.actorId, c.role, 'member', 'planning'),
      ),
      errorCode('NOT_FOUND'),
    );
    await assert.rejects(
      f.scoped('coach', 'atlas-principal', false, (c) =>
        health.consentedHealth(c, { memberId: 'member' }),
      ),
      errorCode('CONTEXT_REVOKED'),
    );
    const inactive = await f.own((c) => f.exports.personalExport(c, {}));
    assert.deepEqual(inactive.training, original.training);
    assert.deepEqual(inactive.health, original.health);
  });
});

test('WP06 reactivation restores retained records/current grants without reviving revoked branch or health consent', async () => {
  await fixture(async (f) => {
    await seedHistory(f.pool);
    const health = createHealthServices();
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role,active) VALUES('atlas','atlas-north','member','member',false)",
    );
    await f.scoped('member', 'atlas-principal', true, (c) =>
      health.grantHealthConsent(c, grantInput()),
    );
    const prior = await f.own(async (c) => ({ ...c }));
    const before = await f.own((c) => f.exports.personalExport(c, {}));
    const inactive = await f.scoped('super', 'atlas-principal', true, (c) =>
      updateProductMember(c, {
        memberId: 'member',
        active: false,
        expectedRevision: prior.accessRevision,
        operationId: randomUUID(),
      }),
    );
    await assert.rejects(
      f.service.transaction((db) => f.exports.personalExport({ ...prior, db }, {})),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.scoped('member', 'atlas-principal', true, async () => 'queued operation'),
      errorCode('MEMBERSHIP_REQUIRED'),
    );
    const restored = await f.scoped('super', 'atlas-principal', true, (c) =>
      updateProductMember(c, {
        memberId: 'member',
        active: true,
        expectedRevision: inactive.revision,
        operationId: randomUUID(),
      }),
    );
    assert.equal(restored.active, true);
    assert.ok(restored.revision > inactive.revision);
    await f.scoped('member', 'atlas-principal', false, async (c) =>
      assert.equal(c.accessMode, 'active'),
    );
    await assert.rejects(
      f.scoped('member', 'atlas-north', false, async () => null),
      errorCode('BRANCH_FORBIDDEN'),
    );
    await assert.rejects(
      f.scoped('coach', 'atlas-principal', false, (c) =>
        health.consentedHealth(c, { memberId: 'member' }),
      ),
      errorCode('CONSENT_REQUIRED'),
    );
    assert.deepEqual(
      (await f.own((c) => f.exports.personalExport(c, {}))).training,
      before.training,
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT revoked_at IS NOT NULL AS revoked FROM b2b_health_consent WHERE organization_id='atlas' AND owner_id='member'",
        )
      ).rows[0].revoked,
      true,
    );
    // Reactivation changes neither this identity's foreign membership nor auth.
    assert.equal(
      (
        await f.pool.query(
          "SELECT count(*)::int AS count FROM b2b_membership WHERE organization_id='sur' AND user_id='member'",
        )
      ).rows[0].count,
      0,
    );
  });
});

test('WP06 failed deactivation rolls back membership, consent revisions and audit together', async () => {
  await fixture(async (f) => {
    const health = createHealthServices();
    await f.scoped('member', 'atlas-principal', true, (c) =>
      health.grantHealthConsent(c, grantInput()),
    );
    const revision = Number(
      (
        await f.pool.query(
          "SELECT access_revision FROM b2b_membership WHERE organization_id='atlas' AND user_id='member'",
        )
      ).rows[0].access_revision,
    );
    await assert.rejects(
      f.scoped('super', 'atlas-principal', true, async (c) => {
        await updateProductMember(c, {
          memberId: 'member',
          active: false,
          expectedRevision: revision,
          operationId: randomUUID(),
        });
        throw new Error('Synthetic rollback');
      }),
      /Synthetic rollback/,
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT active FROM b2b_membership WHERE organization_id='atlas' AND user_id='member'",
        )
      ).rows[0].active,
      true,
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT revision,revoked_at FROM b2b_health_consent WHERE organization_id='atlas' AND owner_id='member'",
        )
      ).rows[0].revision,
      1,
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT count(*)::int AS count FROM b2b_audit WHERE action='health.consent.membership-inactive'",
        )
      ).rows[0].count,
      0,
    );
  });
});
