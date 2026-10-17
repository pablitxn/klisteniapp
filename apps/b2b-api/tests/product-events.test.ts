import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import type { Pool } from 'pg';
import { ProductEventHub, serveProductEvents } from '../src/product-events.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { productFixture, databaseUrl } from './support/product-fixture.ts';

function fakePool(listen = async () => {}) {
  const client = Object.assign(new EventEmitter(), {
    async query(sql: string) {
      if (sql.startsWith('LISTEN')) await listen();
      return { rows: [{ schema: 'synthetic' }] };
    },
    release() {},
  });
  return { connect: async () => client } as unknown as Pool;
}
const syntheticScope = { actorId: 'owner', organizationId: 'gym', sessionId: 'session' };
test('concurrent subscriptions cannot pass the unfinished LISTEN initialization barrier', async () => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const hub = new ProductEventHub(fakePool(() => barrier));
  let ready = 0;
  const first = hub.subscribe(syntheticScope, () => {}).then(() => ready++);
  await delay(0);
  const second = hub.subscribe(syntheticScope, () => {}).then(() => ready++);
  await delay(0);
  assert.equal(ready, 0);
  release();
  await Promise.all([first, second]);
  assert.equal(ready, 2);
  hub.close();
});
test('one actor cannot exhaust the global stream budget by changing sessions', async () => {
  const hub = new ProductEventHub(fakePool());
  try {
    const off = [];
    for (let i = 0; i < 8; i++)
      off.push(await hub.subscribe({ ...syntheticScope, sessionId: `session-${i}` }, () => {}));
    await assert.rejects(
      hub.subscribe({ ...syntheticScope, sessionId: 'new-session' }, () => {}),
      { status: 429 },
    );
    await hub.subscribe({ ...syntheticScope, actorId: 'another-owner' }, () => {});
    off[0]();
    await hub.subscribe(syntheticScope, () => {});
  } finally {
    hub.close();
  }
});
test('healthy streams survive ninety seconds and hub shutdown terminates the response', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const hub = new ProductEventHub(fakePool());
  let ended = false;
  const frames: string[] = [];
  const response = Object.assign(new EventEmitter(), {
    destroyed: false,
    writeHead() {},
    write(frame: string) {
      frames.push(frame);
      return true;
    },
    end(frame: string) {
      ended = true;
      frames.push(frame);
    },
    destroy() {
      this.destroyed = true;
    },
  });
  let authorizations = 0;
  await serveProductEvents(
    hub,
    new EventEmitter() as IncomingMessage,
    response as unknown as ServerResponse,
    syntheticScope,
    async () => {
      authorizations++;
    },
  );
  for (let i = 0; i < 18; i++) {
    t.mock.timers.tick(5000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
  assert.equal(ended, false);
  assert.equal(authorizations, 19);
  assert.equal(frames.filter((f) => f.includes('heartbeat')).length, 18);
  hub.close();
  assert.equal(ended, true);
  assert.match(frames.at(-1)!, /invalidate/);
});
test('startup timeout ends a response even while subscription is still opening', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const hub = new ProductEventHub(fakePool(() => barrier));
  const response = Object.assign(new EventEmitter(), {
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
  });
  const pending = serveProductEvents(
    hub,
    new EventEmitter() as IncomingMessage,
    response as unknown as ServerResponse,
    syntheticScope,
    async () => {
      assert.fail('Expired request must not authorize');
    },
  );
  t.mock.timers.tick(10_000);
  assert.equal(response.destroyed, true);
  release();
  await pending;
  hub.close();
});

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
