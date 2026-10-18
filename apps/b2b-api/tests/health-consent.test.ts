import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  HEALTH_RESPONSE_HEADERS,
  ownerHealthExport,
  revokeHealthForInactiveMembership,
} from '../src/health/index.ts';
import {
  emptyHealth,
  errorCode,
  grantInput,
  measurement,
  withHealthFixture,
} from './fixtures/health.ts';

test('private by default for coach/admin/superadmin; consent exposes precisely its category without profile or goals', async () => {
  await withHealthFixture(async (f) => {
    const { weightKg: _weight, ...record } = measurement('meal');
    void _weight;
    await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 0,
        data: {
          ...emptyHealth(),
          profile: { context: 'Owner private profile' },
          measurements: [measurement()],
          nutrition: [{ ...record, meal: 'Private meal' }],
        },
      }),
    );
    for (const actor of ['coach', 'admin', 'superadmin'])
      await assert.rejects(
        f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), actor),
        (e) => errorCode('CONSENT_REQUIRED')(e) || errorCode('CONTEXT_REVOKED')(e),
      );
    const consent = await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const view = await f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach');
    assert.deepEqual(
      view.categories.map((c) => c.category),
      ['measurements'],
    );
    assert.equal(view.consentRevision, consent.revision);
    assert.equal(view.categories[0]!.records[0]!.weightKg, 80);
    assert.equal('profile' in view, false);
    assert.equal('goals' in view, false);
    assert.equal(JSON.stringify(view).includes('Private meal'), false);
    for (const actor of ['admin', 'superadmin'])
      await assert.rejects(
        f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), actor),
        errorCode('CONTEXT_REVOKED'),
      );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'other' }), 'coach'),
      errorCode('CONSENT_REQUIRED'),
    );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'foreign' }), 'coach'),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach', 'sur'),
      errorCode('CONSENT_REQUIRED'),
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(c, { memberId: 'member' }),
        'coach',
        'atlas',
        'atlas-east',
      ),
      errorCode('CONSENT_REQUIRED'),
    );
    assert.match(HEALTH_RESPONSE_HEADERS['Cache-Control'], /no-store/);
    assert.match(HEALTH_RESPONSE_HEADERS['Surrogate-Control'], /no-store/);
  });
});

test('wrong audience/category/scope and owner override are rejected; dynamic audience requires a current branch trainer grant', async () => {
  await withHealthFixture(async (f) => {
    for (const extra of [
      { audience: 'all-admins' },
      { categories: ['diagnosis'] },
      { categories: ['sleep', 'sleep'] },
      { ownerId: 'other' },
      { scope: { organizationId: 'sur', branchId: 'sur-principal' } },
    ])
      await assert.rejects(
        f.as((c) => f.services.grantHealthConsent(c, { ...grantInput(), ...extra } as never)),
        errorCode('INVALID_INPUT'),
      );
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_consent')).rowCount, 0);
    await f.as(
      (c) => f.services.grantHealthConsent(c, grantInput()),
      'member',
      'atlas',
      'atlas-east',
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(c, { memberId: 'member' }),
        'later',
        'atlas',
        'atlas-east',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-east','later','coach')",
    );
    const view = await f.as(
      (c) => f.services.consentedHealth(c, { memberId: 'member' }),
      'later',
      'atlas',
      'atlas-east',
    );
    assert.equal(view.scope.branchId, 'atlas-east');
    await f.pool.query(
      "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND branch_id='atlas-east' AND user_id='later'",
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(c, { memberId: 'member' }),
        'later',
        'atlas',
        'atlas-east',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('consent revisions/CAS/replay are atomic; stale grant retry cannot resurrect revoked sharing', async () => {
  await withHealthFixture(async (f) => {
    const request = grantInput();
    const grant = await f.as((c) => f.services.grantHealthConsent(c, request));
    assert.equal(grant.revision, 1);
    assert.deepEqual(await f.as((c) => f.services.grantHealthConsent(c, request)), grant);
    await assert.rejects(
      f.as((c) => f.services.grantHealthConsent(c, { ...request, categories: ['sleep'] })),
      errorCode('OPERATION_CONFLICT'),
    );
    await assert.rejects(
      f.as((c) => f.services.grantHealthConsent(c, grantInput('parallel'))),
      errorCode('REVISION_CONFLICT'),
    );
    const revoke = { id: grant.id, operationId: randomUUID(), expectedRevision: 1 };
    await assert.rejects(
      f.as((c) => f.services.revokeHealthConsent(c, { ...revoke, expectedRevision: 0 })),
      errorCode('REVISION_CONFLICT'),
    );
    await assert.rejects(
      f.as((c) => f.services.revokeHealthConsent(c, revoke), 'other'),
      errorCode('NOT_FOUND'),
    );
    const revoked = await f.as((c) => f.services.revokeHealthConsent(c, revoke));
    assert.equal(revoked.status, 'revoked');
    assert.equal(revoked.revision, 2);
    assert.deepEqual(await f.as((c) => f.services.revokeHealthConsent(c, revoke)), revoked);
    await assert.rejects(
      f.as((c) => f.services.grantHealthConsent(c, request)),
      errorCode('REVISION_CONFLICT'),
    );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'),
      errorCode('CONSENT_REQUIRED'),
    );
    const again = await f.as((c) =>
      f.services.grantHealthConsent(c, { ...grantInput(), expectedRevision: 2 }),
    );
    assert.equal(again.revision, 3);
    const audit = (
      await f.pool.query("SELECT * FROM b2b_audit WHERE action LIKE 'health.%' ORDER BY id")
    ).rows;
    assert.equal(audit.length, 3);
    assert.deepEqual(
      audit.map((a) => [Number(a.before_revision), Number(a.after_revision)]),
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    );
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_consent_revision')).rowCount, 3);
    assert.equal(JSON.stringify(audit).includes('weightKg'), false);
  });
});

test('settings list is scoped to owner/brand and consent IDs cannot overwrite another owner', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await f.as(
      (c) => f.services.grantHealthConsent(c, grantInput('east')),
      'member',
      'atlas',
      'atlas-east',
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput('sur')), 'member', 'sur');
    assert.equal((await f.as((c) => f.services.healthConsents(c, {}))).length, 2);
    assert.deepEqual(await f.as((c) => f.services.healthConsents(c, {}), 'other'), []);
    assert.equal((await f.as((c) => f.services.healthConsents(c, {}), 'member', 'sur')).length, 1);
    await assert.rejects(
      f.as((c) => f.services.grantHealthConsent(c, grantInput()), 'other'),
      errorCode('NOT_FOUND'),
    );
  });
});

test('stale role, revision, archived branch, inactive member and revoked target grant deny health', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await f.transaction(async (db) => {
      const stale = await f.context(db, 'coach');
      await f.pool.query(
        "UPDATE b2b_membership SET role='member',product_role='member' WHERE organization_id='atlas' AND user_id='coach'",
      );
      await assert.rejects(
        f.services.consentedHealth(stale, { memberId: 'member' }),
        errorCode('CONTEXT_REVOKED'),
      );
    });
    await f.pool.query(
      "UPDATE b2b_membership SET role='coach',product_role='coach' WHERE organization_id='atlas' AND user_id='coach'",
    );
    await f.pool.query(
      "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND user_id='member'",
    );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'),
      errorCode('CONTEXT_REVOKED'),
    );
    await f.pool.query(
      "UPDATE b2b_branch_grant SET active=true WHERE organization_id='atlas' AND user_id='member'",
    );
    await f.pool.query("UPDATE b2b_branch SET status='archived' WHERE id='atlas-principal'");
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('inactivity hook revokes every owner grant in that gym atomically, leaves other gyms intact, and reactivation never restores consent', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await f.as(
      (c) => f.services.grantHealthConsent(c, grantInput('east')),
      'member',
      'atlas',
      'atlas-east',
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput('sur')), 'member', 'sur');
    await assert.rejects(
      f.as((c) => revokeHealthForInactiveMembership(c, 'member', randomUUID()), 'superadmin'),
      errorCode('REVISION_CONFLICT'),
    );
    await assert.rejects(
      f.as(async (c) => {
        await c.db.query(
          "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
        );
        await revokeHealthForInactiveMembership(c, 'member', randomUUID());
        throw new Error('Rollback inactivity');
      }, 'superadmin'),
      /Rollback inactivity/,
    );
    assert.equal(
      (await f.pool.query('SELECT * FROM b2b_health_consent WHERE revoked_at IS NULL')).rowCount,
      3,
    );
    const revoked = await f.as(async (c) => {
      await c.db.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      const result = await revokeHealthForInactiveMembership(c, 'member', randomUUID());
      assert.deepEqual(await revokeHealthForInactiveMembership(c, 'member', randomUUID()), []);
      return result;
    }, 'superadmin');
    assert.equal(revoked.length, 2);
    assert.ok(revoked.every((c) => c.status === 'revoked' && c.revision === 2));
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.as((c) => f.services.ownHealth(c, {})),
      errorCode('CONTEXT_REVOKED'),
    );
    assert.equal((await f.as(ownerHealthExport)).ownerId, 'member');
    assert.equal((await f.as(ownerHealthExport, 'member', 'sur')).ownerId, 'member');
    await f.pool.query(
      "UPDATE b2b_membership SET active=true WHERE organization_id='atlas' AND user_id='member'",
    );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'),
      errorCode('CONSENT_REQUIRED'),
    );
    assert.equal(
      (
        await f.pool.query(
          "SELECT * FROM b2b_health_consent WHERE organization_id='sur' AND revoked_at IS NULL",
        )
      ).rowCount,
      1,
    );
    await f.as((c) => f.services.grantHealthConsent(c, { ...grantInput(), expectedRevision: 2 }));
    assert.equal(
      (await f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'))
        .consentRevision,
      3,
    );
  });
});

test('owner export includes private profile/categories/goals independent of consent; no staff can select an owner', async () => {
  await withHealthFixture(async (f) => {
    const data = {
      ...emptyHealth(),
      profile: { context: 'Private owner context' },
      measurements: [measurement()],
    };
    const own = await f.as((c) =>
      f.services.saveOwnHealth(c, { operationId: randomUUID(), expectedRevision: 0, data }),
    );
    assert.deepEqual(await f.as(ownerHealthExport), own);
    assert.deepEqual(await f.as(ownerHealthExport, 'member', 'sur'), own);
    assert.equal((await f.as(ownerHealthExport, 'coach')).revision, 0);
    await assert.rejects(
      f.as((c) => f.services.ownHealth(c, { ownerId: 'member' } as never), 'coach'),
      errorCode('INVALID_INPUT'),
    );
    await f.pool.query(
      "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
    );
    assert.deepEqual(await f.as(ownerHealthExport), own);
    await assert.rejects(
      f.as((c) =>
        f.services.saveOwnHealth(c, { operationId: randomUUID(), expectedRevision: 1, data }),
      ),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});
