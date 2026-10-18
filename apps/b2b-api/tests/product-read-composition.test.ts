import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { catalogExercises, routinePublications, routineVersion } from '../src/product-reads.ts';
import { HttpError } from '../src/errors.ts';
import { databaseUrl, productFixture } from './support/product-fixture.ts';
import { goalContent } from './wp02/fixture.ts';
import { createApiServer } from '../src/http.ts';
import { StoredRoutineSchema } from '@klisteniapp/b2b-contracts/product-v2';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
);
const missing = (error: unknown) => error instanceof HttpError && error.status === 404;
type Fixture = Parameters<Parameters<typeof productFixture>[0]>[0];
async function assertMemberHttp(f: Fixture, id: string, expected: unknown) {
  const password = 'synthetic-issued-read-password';
  const hash = await (await f.auth.$context).password.hash(password);
  await f.pool.query(
    `INSERT INTO b2b_auth_account(id,"userId","accountId","providerId",password,"createdAt","updatedAt")
    VALUES('read-member-account','member','member','credential',$1,now(),now())`,
    [hash],
  );
  const login = await f.auth.handler(
    new Request(`${f.config.origin}/api/b2b/auth/sign-in/email`, {
      method: 'POST',
      headers: { origin: f.config.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.test', password }),
    }),
  );
  assert.equal(login.status, 200);
  const headers = {
    cookie: login.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; '),
    'x-klisteni-b2b-account': 'member',
    'x-klisteni-b2b-branch': 'atlas-principal',
    'x-klisteni-b2b-role': 'member',
    'x-klisteni-b2b-contract': '2',
  };
  // The existing unified transport supports only this explicitly reduced topology.
  await f.pool.query(
    "DELETE FROM b2b_branch_grant WHERE branch_id IN ('atlas-north','sur-north'); DELETE FROM b2b_branch WHERE id IN ('atlas-north','sur-north')",
  );
  const server = createApiServer(f);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/b2b/orgs/atlas/product/v2`;
  try {
    const response = await fetch(`${base}/routines/${id}/versions/1`, { headers });
    assert.equal(response.status, 200, await response.clone().text());
    assert.deepEqual(StoredRoutineSchema.parse(await response.json()), expected);
    assert.equal((await fetch(`${base}/catalog/exercises`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/routine-publications`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/routines/${id}/versions/2`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/routines/unissued/versions/1`, { headers })).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test(
  'published choices use actual v1/v2 immutable discriminators and current catalog scope',
  { skip: !databaseUrl },
  async () =>
    productFixture(async (f) => {
      const { pool, scoped, service } = f;
      const legacy = {
        ...fixture.legacyRoutine,
        programId: 'legacy',
        steps: fixture.legacyRoutine.steps.map((s: object) => ({ ...s, exerciseId: 'pushup' })),
      };
      await pool.query(
        "INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version) VALUES('legacy','atlas','atlas-principal',$1,1)",
        [{ name: legacy.name, description: legacy.description, steps: legacy.steps }],
      );
      await pool.query(
        "INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot) VALUES('atlas','atlas-principal','legacy',1,$1)",
        [legacy],
      );
      const legacyBefore = (
        await pool.query("SELECT snapshot::text FROM b2b_program_version WHERE program_id='legacy'")
      ).rows;
      const draft = await scoped('coach', 'atlas-principal', false, (c) =>
        service.productProducers.routine!(c, { id: 'legacy' }),
      );
      assert.equal(draft.schemaVersion, 2);
      assert.deepEqual(await scoped('coach', 'atlas-principal', false, routinePublications), [
        { name: legacy.name, reference: { programId: 'legacy', version: 1, schemaVersion: 1 } },
      ]);
      const catalog = await scoped('coach', 'atlas-principal', false, catalogExercises);
      assert.ok(catalog.some((e) => e.id === 'pushup'));
      await assert.rejects(scoped('member', 'atlas-principal', false, catalogExercises));
      await pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise','pushup',false)",
      );
      assert.ok(
        (await scoped('coach', 'atlas-principal', false, catalogExercises)).every(
          (e) => e.id !== 'pushup',
        ),
      );
      assert.deepEqual(await scoped('coach', 'atlas-principal', false, routinePublications), []);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT snapshot::text FROM b2b_program_version WHERE program_id='legacy'",
          )
        ).rows,
        legacyBefore,
      );
      assert.deepEqual(
        await scoped('coach', 'atlas-principal', false, (c) =>
          routineVersion(c, { id: 'legacy', version: 1 }),
        ),
        { schemaVersion: 1, snapshot: legacy },
      );
      await pool.query(
        "INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES('own-legacy','atlas','atlas-principal','member','legacy',1,'coach')",
      );
      await assertMemberHttp(f, 'legacy', { schemaVersion: 1, snapshot: legacy });
    }),
);

test(
  'real enrollment issues immutable own version reads without legacy assignments and preserves denied foreign scope',
  { skip: !databaseUrl },
  async () =>
    productFixture(async (f) => {
      const { pool, scoped, service } = f;
      const p = service.productProducers;
      await scoped('coach', 'atlas-principal', true, (c) =>
        p.saveRoutine!(c, {
          id: 'routine',
          operationId: 'read-routine-save',
          expectedRevision: 0,
          content: {
            name: 'Issued version',
            description: '',
            steps: [
              {
                id: 'step',
                exerciseId: 'pushup',
                dose: fixture.dose,
                substitutionPolicy: 'reviewed',
              },
            ],
          },
        }),
      );
      const published = await scoped('coach', 'atlas-principal', true, (c) =>
        p.publishRoutine!(c, {
          id: 'routine',
          operationId: 'read-routine-publish',
          expectedRevision: 1,
        }),
      );
      const goal = await scoped('coach', 'atlas-principal', true, (c) =>
        p.saveGoal!(c, {
          memberId: 'member',
          id: 'goal',
          operationId: 'read-goal',
          expectedRevision: 0,
          content: goalContent(),
        }),
      );
      await scoped('coach', 'atlas-principal', true, (c) =>
        p.enroll!(c, {
          memberId: 'member',
          id: 'enrollment',
          goalProgramId: goal.id,
          issuedGoalRevision: goal.revision,
          operationId: 'read-enroll',
          expectedRevision: 0,
          content: goalContent(),
        }),
      );
      assert.equal((await pool.query('SELECT 1 FROM b2b_program_assignment')).rowCount, 0);
      assert.equal((await pool.query('SELECT 1 FROM b2b_occurrence')).rowCount, 2);
      assert.deepEqual(await scoped('coach', 'atlas-principal', false, routinePublications), [
        { name: published.name, reference: { programId: 'routine', version: 1, schemaVersion: 2 } },
      ]);
      assert.deepEqual(
        await scoped('member', 'atlas-principal', false, (c) =>
          routineVersion(c, { id: 'routine', version: 1 }),
        ),
        { schemaVersion: 2, snapshot: published },
      );
      await assert.rejects(
        scoped('unassigned', 'atlas-principal', false, (c) =>
          routineVersion(c, { id: 'routine', version: 1 }),
        ),
        missing,
      );
      await assert.rejects(
        scoped('member', 'atlas-principal', false, (c) =>
          routineVersion(c, { id: 'routine', version: 2 }),
        ),
        missing,
      );
      await pool.query(
        "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-north','member','member')",
      );
      await assert.rejects(
        scoped('member', 'atlas-north', false, (c) =>
          routineVersion(c, { id: 'routine', version: 1 }),
        ),
        missing,
      );
      await scoped('coach', 'atlas-principal', true, (c) =>
        p.archiveRoutine!(c, { id: 'routine', expectedRevision: 2, operationId: 'read-archive' }),
      );
      assert.deepEqual(await scoped('coach', 'atlas-principal', false, routinePublications), []);
      assert.deepEqual(
        await scoped('member', 'atlas-principal', false, (c) =>
          routineVersion(c, { id: 'routine', version: 1 }),
        ),
        { schemaVersion: 2, snapshot: published },
      );
      await assertMemberHttp(f, 'routine', { schemaVersion: 2, snapshot: published });
    }),
);
