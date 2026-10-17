import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  healthDisclosureGeneration,
  ownerHealthExport,
  revalidateHealthDisclosure,
  revokeHealthForInactiveMembership,
} from '../src/health/index.ts';
import {
  emptyHealth,
  errorCode,
  grantInput,
  importFile,
  measurement,
  NOW,
  queued,
  withHealthFixture,
} from './fixtures/health.ts';

test('queued trainer read cannot disclose after a preceding revocation commits', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const blocker = await f.pool.connect();
    let read: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      const context = await f.context(blocker);
      await f.services.revokeHealthConsent(context, {
        id: 'consent',
        operationId: randomUUID(),
        expectedRevision: 1,
      });
      read = f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach');
      // Attach rejection handling before intentionally releasing the barrier.
      const denied = assert.rejects(read, errorCode('CONSENT_REQUIRED'));
      await queued(f);
      await blocker.query('COMMIT');
      await denied;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await read?.catch(() => undefined);
    }
  });
});

test('captured in-flight projection is discarded after revoke or replacement; final dispatch refreshes owner edits', async () => {
  await withHealthFixture(async (f) => {
    const own = await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 0,
        data: { ...emptyHealth(), measurements: [measurement()] },
      }),
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const prepared = await f.as(
      (c) => f.services.consentedHealth(c, { memberId: 'member' }),
      'coach',
    );
    await f.as((c) =>
      f.services.saveOwnHealth(c, {
        operationId: randomUUID(),
        expectedRevision: 1,
        data: { ...own.data, measurements: [{ ...measurement(), weightKg: 81 }] },
      }),
    );
    const refreshed = await f.as((c) => revalidateHealthDisclosure(c, prepared, NOW), 'coach');
    assert.equal(refreshed.categories[0]!.records[0]!.weightKg, 81);
    assert.equal(healthDisclosureGeneration(refreshed), healthDisclosureGeneration(prepared));
    await f.as((c) =>
      f.services.revokeHealthConsent(c, {
        id: 'consent',
        operationId: randomUUID(),
        expectedRevision: 1,
      }),
    );
    await assert.rejects(
      f.as((c) => revalidateHealthDisclosure(c, prepared, NOW), 'coach'),
      errorCode('CONSENT_REQUIRED'),
    );
    await f.as((c) =>
      f.services.grantHealthConsent(c, {
        ...grantInput(),
        expectedRevision: 2,
        categories: ['sleep'],
      }),
    );
    await assert.rejects(
      f.as((c) => revalidateHealthDisclosure(c, prepared, NOW), 'coach'),
      errorCode('CONSENT_REQUIRED'),
    );
    await assert.rejects(
      f.as((c) => revalidateHealthDisclosure(c, prepared, NOW), 'coach', 'sur'),
      errorCode('CONSENT_REQUIRED'),
    );
    await assert.rejects(
      f.as((c) => revalidateHealthDisclosure(c, prepared, NOW), 'coach', 'atlas', 'atlas-east'),
      errorCode('CONSENT_REQUIRED'),
    );
  });
});

test('role/grant changes while a read is queued are rechecked rather than trusting captured capabilities', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    for (const sql of [
      "UPDATE b2b_membership SET role='member',product_role='member' WHERE organization_id='atlas' AND user_id='coach'",
      "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND user_id='coach' AND role='coach'",
    ]) {
      const blocker = await f.pool.connect();
      let read: Promise<unknown> | undefined;
      try {
        await blocker.query('BEGIN');
        await blocker.query(sql);
        read = f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach');
        const denied = assert.rejects(read, errorCode('CONTEXT_REVOKED'));
        await queued(f);
        await blocker.query('COMMIT');
        await denied;
      } finally {
        await blocker.query('ROLLBACK');
        blocker.release();
        await read?.catch(() => undefined);
      }
      await f.pool.query(
        "UPDATE b2b_membership SET role='coach',product_role='coach' WHERE organization_id='atlas' AND user_id='coach'",
      );
    }
  });
});

test('queued import and captured owner export context lose operational authority after inactivity; fresh export remains available', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const request = {
      operationId: randomUUID(),
      expectedRevision: 0,
      format: 'klisteniapp.health' as const,
      version: 1 as const,
      raw: importFile(),
    };
    const preview = await f.as((c) => f.services.previewHealthImport(c, request));
    const blocker = await f.pool.connect();
    const pending: Promise<unknown>[] = [];
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      await revokeHealthForInactiveMembership(
        await f.context(blocker, 'superadmin'),
        'member',
        randomUUID(),
      );
      pending.push(
        f.as((c) =>
          f.services.applyHealthImport(c, { ...request, previewHash: preview.previewHash }),
        ),
        f.as(ownerHealthExport),
      );
      const denied = pending.map((p) => assert.rejects(p, errorCode('CONTEXT_REVOKED')));
      await queued(f);
      await blocker.query('COMMIT');
      await Promise.all(denied);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await Promise.allSettled(pending);
    }
    assert.equal((await f.pool.query('SELECT * FROM b2b_health')).rowCount, 0);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_operation')).rowCount, 1); // Explicit consent only.
    assert.equal((await f.as(ownerHealthExport)).ownerId, 'member');
  });
});

test('revoke serializes before queued consent update and prevents stale grant response replay', async () => {
  await withHealthFixture(async (f) => {
    const request = grantInput();
    await f.as((c) => f.services.grantHealthConsent(c, request));
    const blocker = await f.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await f.services.revokeHealthConsent(await f.context(blocker), {
        id: 'consent',
        operationId: randomUUID(),
        expectedRevision: 1,
      });
      pending = f.as((c) =>
        f.services.grantHealthConsent(c, {
          ...grantInput(),
          expectedRevision: 1,
          categories: ['sleep'],
        }),
      );
      const denied = assert.rejects(pending, errorCode('REVISION_CONFLICT'));
      await queued(f);
      await blocker.query('COMMIT');
      await denied;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending?.catch(() => undefined);
    }
    await assert.rejects(
      f.as((c) => f.services.grantHealthConsent(c, request)),
      errorCode('REVISION_CONFLICT'),
    );
    assert.equal((await f.as((c) => f.services.healthConsents(c, {})))[0]!.status, 'revoked');
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_consent_revision')).rowCount, 2);
  });
});

test('queued trainer disclosure and final guard fail after target membership deactivation even with a retained stale consent', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const prepared = await f.as(
      (c) => f.services.consentedHealth(c, { memberId: 'member' }),
      'coach',
    );
    // Defense in depth if an external membership caller forgets the WP06 hook.
    await f.pool.query(
      "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
    );
    await assert.rejects(
      f.as((c) => f.services.consentedHealth(c, { memberId: 'member' }), 'coach'),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.as((c) => revalidateHealthDisclosure(c, prepared), 'coach'),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('two owners racing on an absent consent ID cannot overwrite or share the other owner health', async () => {
  await withHealthFixture(async (f) => {
    const blocker = await f.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await f.services.grantHealthConsent(await f.context(blocker), grantInput());
      // The other transaction cannot see this uncommitted row at its initial
      // lookup. Its INSERT must resolve the unique conflict without updating it.
      pending = f.as(
        (c) => f.services.grantHealthConsent(c, { ...grantInput(), categories: ['sleep'] }),
        'other',
      );
      const denied = assert.rejects(pending, errorCode('REVISION_CONFLICT'));
      await queued(f);
      await blocker.query('COMMIT');
      await denied;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending?.catch(() => undefined);
    }
    const stored = (
      await f.pool.query('SELECT owner_id,revision,categories FROM b2b_health_consent')
    ).rows;
    assert.deepEqual(stored, [{ owner_id: 'member', revision: 1, categories: ['measurements'] }]);
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_consent_revision')).rowCount, 1);
    assert.equal(
      (await f.pool.query("SELECT * FROM b2b_health_operation WHERE owner_id='other'")).rowCount,
      0,
    );
    assert.deepEqual(await f.as((c) => f.services.healthConsents(c, {}), 'other'), []);
  });
});
