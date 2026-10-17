import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AuthorizedProductContext } from '../src/product-context.ts';
import { revokeHealthForInactiveMembership } from '../src/health/index.ts';
import {
  emptyHealth,
  errorCode,
  grantInput,
  queued,
  withHealthFixture,
} from './fixtures/health.ts';

/** Match WP01's effective-role health capabilities without importing or copying
 * its authorization service into the frozen feature branch. Real grants and
 * revisions are checked by the feature against disposable PostgreSQL. */
function selected(
  context: AuthorizedProductContext,
  role: AuthorizedProductContext['role'],
): AuthorizedProductContext {
  return {
    ...context,
    role,
    capabilities: new Set(
      role === 'member'
        ? ['manage-own-health', 'export-own-records']
        : ['manage-own-health', 'export-own-records', 'read-consented-health'],
    ),
  };
}

test('organization member selecting a live branch coach grant can manage own health and read only consented target health', async () => {
  await withHealthFixture(async (f) => {
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','other','coach')",
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
        'other',
      ),
      errorCode('CONSENT_REQUIRED'),
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const own = await f.as(
      (c) =>
        f.services.saveOwnHealth(selected(c, 'coach'), {
          operationId: randomUUID(),
          expectedRevision: 0,
          data: emptyHealth(),
        }),
      'other',
    );
    assert.equal(own.ownerId, 'other');
    assert.equal(
      (
        await f.as(
          (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
          'other',
        )
      ).ownerId,
      'member',
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
        'other',
        'atlas',
        'atlas-east',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('superadmin selecting a member grant retains owner health but cannot regain trainer disclosure through organization authority', async () => {
  await withHealthFixture(async (f) => {
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','superadmin','member'),('atlas','atlas-principal','superadmin','coach')",
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const own = await f.as(
      (c) =>
        f.services.saveOwnHealth(selected(c, 'member'), {
          operationId: randomUUID(),
          expectedRevision: 0,
          data: emptyHealth(),
        }),
      'superadmin',
    );
    assert.equal(own.ownerId, 'superadmin');
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(selected(c, 'member'), { memberId: 'member' }),
        'superadmin',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
    // Even stale/overbroad capability metadata and a separate live coach grant
    // cannot turn the selected member context into a trainer context.
    await assert.rejects(
      f.as(
        (c) =>
          f.services.consentedHealth(
            { ...selected(c, 'member'), capabilities: c.capabilities },
            { memberId: 'member' },
          ),
        'superadmin',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
    assert.equal(
      (
        await f.as(
          (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
          'superadmin',
        )
      ).ownerId,
      'member',
    );
  });
});

test('administrative contexts match current organization authority with only explicit superadmin to admin downgrade', async () => {
  await withHealthFixture(async (f) => {
    assert.equal(
      (await f.as((c) => f.services.ownHealth(selected(c, 'admin'), {}), 'superadmin')).ownerId,
      'superadmin',
    );
    assert.equal(
      (await f.as((c) => f.services.ownHealth(selected(c, 'superadmin'), {}), 'superadmin'))
        .ownerId,
      'superadmin',
    );
    assert.equal(
      (await f.as((c) => f.services.ownHealth(selected(c, 'admin'), {}), 'admin')).ownerId,
      'admin',
    );
    for (const [actor, role] of [
      ['admin', 'superadmin'],
      ['other', 'admin'],
      ['other', 'superadmin'],
    ] as const)
      await assert.rejects(
        f.as((c) => f.services.ownHealth(selected(c, role), {}), actor),
        errorCode('CONTEXT_REVOKED'),
      );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(selected(c, 'admin'), { memberId: 'member' }),
        'superadmin',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.as((c) => f.services.ownHealth(selected(c, 'member'), {}), 'superadmin'),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('revoked selected coach or member grant fails even if organization authority, another grant and access revision remain unchanged', async () => {
  await withHealthFixture(async (f) => {
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','other','coach'),('atlas','atlas-principal','superadmin','member')",
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    for (const [actor, role] of [
      ['other', 'coach'],
      ['superadmin', 'member'],
    ] as const) {
      await f.transaction(async (db) => {
        const captured = selected(await f.context(db, actor), role);
        await f.pool.query(
          "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND branch_id='atlas-principal' AND user_id=$1 AND role=$2",
          [actor, role],
        );
        assert.equal(
          Number(
            (
              await db.query(
                "SELECT access_revision FROM b2b_membership WHERE organization_id='atlas' AND user_id=$1",
                [actor],
              )
            ).rows[0].access_revision,
          ),
          captured.accessRevision,
        );
        await assert.rejects(f.services.ownHealth(captured, {}), errorCode('CONTEXT_REVOKED'));
        await assert.rejects(
          f.services.consentedHealth(captured, { memberId: 'member' }),
          errorCode('CONTEXT_REVOKED'),
        );
      });
    }
  });
});

test('organization downgrade invalidates captured context revision; fresh selected coach still needs the retained current coach grant', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await f.transaction(async (db) => {
      const captured = selected(await f.context(db, 'coach'), 'coach');
      await f.pool.query(
        "UPDATE b2b_membership SET role='member',product_role='member' WHERE organization_id='atlas' AND user_id='coach'",
      );
      await assert.rejects(
        f.services.consentedHealth(captured, { memberId: 'member' }),
        errorCode('CONTEXT_REVOKED'),
      );
    });
    assert.equal(
      (
        await f.as(
          (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
          'coach',
        )
      ).ownerId,
      'member',
    );
    await f.pool.query(
      "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND branch_id='atlas-principal' AND user_id='coach' AND role='coach'",
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
        'coach',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('selected coach requires current capability and active membership despite its live grant', async () => {
  await withHealthFixture(async (f) => {
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','other','coach')",
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await assert.rejects(
      f.as(
        (c) =>
          f.services.consentedHealth(
            { ...selected(c, 'coach'), capabilities: new Set(['manage-own-health']) },
            { memberId: 'member' },
          ),
        'other',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
    await f.pool.query(
      "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='other'",
    );
    await assert.rejects(
      f.as((c) => f.services.ownHealth(selected(c, 'coach'), {}), 'other'),
      errorCode('CONTEXT_REVOKED'),
    );
    await assert.rejects(
      f.as(
        (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
        'other',
      ),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('queued effective coach disclosure observes live selected-grant revocation before returning health', async () => {
  await withHealthFixture(async (f) => {
    await f.pool.query(
      "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-principal','other','coach')",
    );
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    const blocker = await f.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND branch_id='atlas-principal' AND user_id='other' AND role='coach'",
      );
      pending = f.as(
        (c) => f.services.consentedHealth(selected(c, 'coach'), { memberId: 'member' }),
        'other',
      );
      const denied = assert.rejects(pending, errorCode('CONTEXT_REVOKED'));
      await queued(f);
      await blocker.query('COMMIT');
      await denied;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending?.catch(() => undefined);
    }
  });
});

test('one inactivity hook call records each branch revocation once in the membership transaction and retries add no audit', async () => {
  await withHealthFixture(async (f) => {
    await f.as((c) => f.services.grantHealthConsent(c, grantInput()));
    await f.as(
      (c) => f.services.grantHealthConsent(c, grantInput('east')),
      'member',
      'atlas',
      'atlas-east',
    );
    const operationId = randomUUID();
    await f.as(async (c) => {
      await c.db.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      assert.equal((await revokeHealthForInactiveMembership(c, 'member', operationId)).length, 2);
      assert.deepEqual(await revokeHealthForInactiveMembership(c, 'member', operationId), []);
    }, 'superadmin');
    const audit = (
      await f.pool.query(
        "SELECT actor_id,operation_id,branch_id,before_revision,after_revision,changed_fields FROM b2b_audit WHERE action='health.consent.membership-inactive' ORDER BY branch_id",
      )
    ).rows;
    assert.equal(audit.length, 2);
    assert.deepEqual(
      audit.map((row) => row.branch_id),
      ['atlas-east', 'atlas-principal'],
    );
    for (const row of audit) {
      assert.equal(row.actor_id, 'superadmin');
      assert.equal(row.operation_id, operationId);
      assert.equal(Number(row.before_revision), 1);
      assert.equal(Number(row.after_revision), 2);
      assert.deepEqual(row.changed_fields, [
        'status',
        'categories',
        'audience',
        'disclosureVersion',
      ]);
    }
    assert.equal(
      (await f.pool.query('SELECT * FROM b2b_health_consent WHERE revoked_at IS NULL')).rowCount,
      0,
    );
    assert.equal((await f.pool.query('SELECT * FROM b2b_health_consent_revision')).rowCount, 4);
  });
});
