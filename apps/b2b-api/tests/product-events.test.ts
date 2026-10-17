import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ProductEventHub } from '../src/product-events.ts';
import { productFixture, databaseUrl } from './support/product-fixture.ts';

test(
  'committed invalidations reach independent API listeners; rollback, foreign scope and unrelated updates do not',
  { skip: !databaseUrl },
  async () =>
    productFixture(async (f) => {
      const first = new ProductEventHub(f.pool),
        second = new ProductEventHub(f.pool);
      const scope = {
        actorId: 'member',
        organizationId: 'atlas',
        branchId: 'atlas-principal',
        sessionId: 'session-member',
      };
      let a = 0,
        b = 0;
      const offA = await first.subscribe(scope, () => a++),
        offB = await second.subscribe(scope, () => b++);
      const writer = await f.pool.connect();
      try {
        await writer.query('BEGIN');
        await writer.query(
          "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
        );
        await writer.query('ROLLBACK');
        await delay(40);
        assert.equal(a, 0);
        assert.equal(b, 0);
        await writer.query(
          "UPDATE b2b_membership SET active=false WHERE organization_id='sur' AND user_id='foreign'",
        );
        await writer.query(
          `UPDATE b2b_auth_session SET "updatedAt"=clock_timestamp() WHERE id='session-member'`,
        );
        await delay(40);
        assert.equal(a, 0);
        assert.equal(b, 0);
        await writer.query('BEGIN');
        await writer.query(
          "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
        );
        await delay(40);
        assert.equal(a, 0);
        assert.equal(b, 0);
        await writer.query('COMMIT');
        for (let i = 0; i < 100 && (a === 0 || b === 0); i++) await delay(5);
        assert.ok(a > 0);
        assert.ok(b > 0);
      } finally {
        writer.release();
        offA();
        offB();
        first.close();
        second.close();
      }
    }),
);
test(
  'listener failure invalidates dependent views and new subscriptions establish a fresh LISTEN baseline',
  { skip: !databaseUrl },
  async () =>
    productFixture(async (f) => {
      const hub = new ProductEventHub(f.pool);
      let invalidations = 0;
      const scope = {
        actorId: 'member',
        organizationId: 'atlas',
        branchId: 'atlas-principal',
        sessionId: 'session-member',
      };
      try {
        const off = await hub.subscribe(scope, () => invalidations++);
        await f.pool.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name=$1 AND query='LISTEN klisteni_b2b_invalidation'",
          [f.schema],
        );
        for (let i = 0; i < 100 && !invalidations; i++) await delay(5);
        assert.equal(invalidations, 1);
        off();
        const again = await hub.subscribe(scope, () => invalidations++);
        await f.pool.query(
          "UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND branch_id='atlas-principal' AND user_id='member'",
        );
        for (let i = 0; i < 100 && invalidations === 1; i++) await delay(5);
        assert.ok(invalidations > 1);
        again();
      } finally {
        hub.close();
      }
    }),
);
