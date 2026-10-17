import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Pool } from 'pg';
import { exercises } from '@klisteniapp/catalog-base';
import { ProgramVersionSchema } from '@klisteniapp/b2b-contracts/training';
import { RoutineVersionV2Schema, type SessionContent } from '@klisteniapp/b2b-contracts/product-v2';
import {
  canonicalExercises,
  contentHash,
  projectReviewedRelations,
  isUnchangedCanonical,
  enrichReviewedCatalog,
  freezeReviewedRelations,
  legacySupplement,
  saveLegacySupplement,
} from '../src/catalog/reviewed-projection.ts';
import {
  alternatives,
  assertNewReviewedCatalogEligibility,
} from '../src/catalog/reviewed-alternatives.ts';
import { seedBaseCatalog } from '../src/catalog/seed.ts';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import type { AuthorizedProductContext } from '../src/product-context.ts';
const catalog = canonicalExercises();
const source = catalog.find((exercise) => exercise.id === 'squat')!;
const relations = projectReviewedRelations(source, catalog);
const dose = {
  mode: 'repetitions',
  sets: { kind: 'fixed', value: 3 },
  repetitions: { kind: 'fixed', value: 8 },
  durationSeconds: null,
  load: { mode: 'bodyweight' },
  restSeconds: { kind: 'fixed', value: 60 },
  laterality: 'bilateral',
  targetRpe: null,
  notes: '',
};
const at = '2026-10-17T12:00:00Z';
const scope = { organizationId: 'atlas', branchId: 'atlas-principal' };
const routine = RoutineVersionV2Schema.parse({
  schemaVersion: 2,
  programId: 'routine',
  version: 1,
  scope,
  publishedAt: at,
  name: 'Routine',
  description: '',
  steps: [{ id: 'step', exerciseId: source.id, dose, substitutionPolicy: 'reviewed' }],
  exercises: catalog,
  machines: [],
  relations,
});
const legacy = ProgramVersionSchema.parse({
  programId: routine.programId,
  version: 1,
  name: routine.name,
  description: '',
  publishedAt: at,
  steps: [
    {
      id: 'step',
      exerciseId: source.id,
      sets: 3,
      reps: 8,
      loadKg: null,
      durationSeconds: null,
      restSeconds: 60,
      targetRpe: null,
      notes: '',
      alternatives: ['unreviewed-manual'],
    },
  ],
  exercises: catalog,
  machines: [],
});

const rawFixtures = ['repetitions', 'duration'].map((mode) => {
  const bytes = readFileSync(
    new URL(
      `./fixtures/reviewed-alternatives/legacy-${mode}-omitted-defaults.json`,
      import.meta.url,
    ),
  );
  return { mode, bytes, raw: JSON.parse(bytes.toString('utf8')) };
});
function confirmedFixture(raw: unknown) {
  const original = ProgramVersionSchema.parse(raw);
  const step = original.steps[0];
  return RoutineVersionV2Schema.parse({
    ...routine,
    machines: original.machines,
    steps: [
      {
        ...routine.steps[0],
        dose: {
          ...routine.steps[0].dose,
          mode: step.reps === null ? 'duration' : 'repetitions',
          repetitions: step.reps === null ? null : { kind: 'fixed', value: step.reps },
          durationSeconds:
            step.durationSeconds === null ? null : { kind: 'fixed', value: step.durationSeconds },
        },
      },
    ],
  });
}
test('raw legacy fixtures omit defaulted fields without changing their adoption identity or bytes', () => {
  for (const { raw, bytes } of rawFixtures) {
    assert.equal('targetRpe' in raw.steps[0], false);
    for (const field of ['derivedFromId', 'derivedFromVersion', 'revision', 'status'])
      assert.equal(field in raw.machines[0], false);
    const rawBefore = JSON.stringify(raw);
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    const normalized = ProgramVersionSchema.parse(raw);
    assert.notEqual(contentHash(normalized), contentHash(raw));
    const supplement = legacySupplement(raw, confirmedFixture(raw), 'member');
    assert.equal(supplement.sourceSnapshotHash, contentHash(raw));
    assert.equal(JSON.stringify(raw), rawBefore);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), fileHash);
    assert.throws(() =>
      legacySupplement({ ...raw, name: 'Tampered' }, confirmedFixture(raw), 'member'),
    );
  }
});

test('canonical projection retains exactly 37 exercises, 42 directed links, every kind and nine honest empty lists', () => {
  assert.equal(catalog.length, 37);
  const all = catalog.flatMap((item) => projectReviewedRelations(item, catalog));
  assert.equal(all.length, 42);
  assert.deepEqual(
    ['alternative', 'progression', 'regression'].map(
      (kind) => all.filter((r) => r.type === kind).length,
    ),
    [8, 17, 17],
  );
  assert.equal(
    catalog.filter((item) => projectReviewedRelations(item, catalog).length === 0).length,
    9,
  );
  assert.ok(
    !projectReviewedRelations(catalog.find((e) => e.id === 'quarter-squat')!, catalog).some(
      (r) => r.targetExerciseId === 'paused-squat',
    ),
  );
  assert.ok(
    !projectReviewedRelations(catalog.find((e) => e.id === 'full-pushup')!, catalog).some(
      (r) => r.targetExerciseId === 'squat',
    ),
  );
  for (const exercise of exercises)
    for (const link of exercise.planning.relations) {
      const projected = all.find(
        (r) => r.sourceExerciseId === exercise.id && r.targetExerciseId === link.targetId,
      )!;
      assert.deepEqual(projected.conditions, link.conditions);
      assert.equal(projected.rationale, link.rationale);
    }
});
test('proven canonical content requires base scope, exact ID/version/revision/content; adaptation IDs and animation matches never suffice', () => {
  assert.equal(isUnchangedCanonical(source), true);
  for (const modified of [
    { ...source, id: 'local', scope: 'organization' as const, baseExerciseId: source.id },
    { ...source, instructions: ['Edited'] },
    { ...source, revision: 1 },
    { ...source, version: 2 },
    { ...source, branchId: 'foreign' },
  ]) {
    assert.equal(isUnchangedCanonical(modified), false);
    assert.deepEqual(projectReviewedRelations(modified, catalog), []);
  }
  const altered = catalog.map((e) =>
    e.id === relations[0].targetExerciseId ? { ...e, equipment: 'edited' } : e,
  );
  assert.equal(projectReviewedRelations(source, altered).length, relations.length - 1);
});
test('each target uses its own sets/reps/rest/bodyweight/laterality and confirmed requirements', () => {
  const calf = projectReviewedRelations(catalog.find((e) => e.id === 'calf-raise')!, catalog)[0];
  assert.equal(calf.targetDose.laterality, 'per-side');
  assert.deepEqual(calf.targetDose.load, { mode: 'bodyweight' });
  assert.ok(calf.requirements.some((r) => r === 'count:per-side'));
  const paused = relations.find((r) => r.targetExerciseId === 'paused-squat')!;
  assert.deepEqual(paused.targetDose.repetitions, { kind: 'range', min: 5, max: 8 });
  assert.equal(freezeReviewedRelations(routine, catalog).length, 3);
  assert.equal(
    freezeReviewedRelations(
      { ...routine, steps: [{ ...routine.steps[0], substitutionPolicy: 'blocked' }] },
      catalog,
    ).length,
    0,
  );
});
test('publication snapshots survive later catalog edits and do not mutate source snapshots/manual legacy permissions', () => {
  const before = contentHash(legacy);
  const frozen = freezeReviewedRelations(routine, catalog);
  const prior = contentHash(frozen);
  const changed = structuredClone(catalog);
  changed.find((e) => e.id === frozen[0].targetExerciseId)!.instructions = ['Later catalog edit'];
  assert.equal(contentHash(frozen), prior);
  assert.equal(projectReviewedRelations(source, changed).length, 2);
  const supplement = legacySupplement(legacy, routine, 'member');
  assert.equal(supplement.sourceSnapshotHash, before);
  assert.deepEqual(legacy.steps[0].alternatives, ['unreviewed-manual']);
  assert.equal(contentHash(legacy), before);
  assert.throws(() =>
    legacySupplement(
      legacy,
      {
        ...routine,
        steps: [
          {
            ...routine.steps[0],
            dose: { ...routine.steps[0].dose, sets: { kind: 'fixed', value: 4 } },
          },
        ],
      },
      'member',
    ),
  );
  assert.throws(() =>
    legacySupplement(
      {
        ...legacy,
        exercises: catalog.map((e) => (e.id === source.id ? { ...e, name: 'Adapted' } : e)),
      },
      routine,
      'member',
    ),
  );
  assert.throws(() =>
    legacySupplement(
      legacy,
      { ...routine, relations: [{ ...relations[0], rationale: 'Forged review' }] },
      'member',
    ),
  );
});

test(
  'synthetic PostgreSQL: fresh/repeated/installed enrichment, unchanged historical JSON, supplement replay, scoped reads and immutable adoption',
  { skip: !process.env.B2B_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.B2B_TEST_DATABASE_URL!);
    assert.match(url.hostname, /^(127\.0\.0\.1|localhost)$/);
    assert.match(url.pathname, /b2b.*test/);
    const owner = new Pool({ connectionString: url.href });
    const schema = `wp04_${randomUUID().replaceAll('-', '')}`;
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: url.href });
    try {
      const config = {
        databaseUrl: url.href,
        secret: 'wp04-synthetic-secret-12345678901234567890',
        origin: 'http://localhost:4200',
        host: '127.0.0.1',
        port: 0,
        production: false,
        demoMode: false,
      };
      await migrate(pool, createAuth(pool, config, { migrating: true }));
      const db = await pool.connect();
      try {
        assert.equal(await enrichReviewedCatalog(db), 42);
        assert.equal(await enrichReviewedCatalog(db), 0);
        await db.query('DELETE FROM b2b_reviewed_relation');
        const rowsBefore = (await db.query('SELECT id,data::text FROM b2b_exercise ORDER BY id'))
          .rows;
        await seedBaseCatalog(db);
        assert.equal(await enrichReviewedCatalog(db), 42);
        assert.deepEqual(
          (await db.query('SELECT id,data::text FROM b2b_exercise ORDER BY id')).rows,
          rowsBefore,
        );
        await db.query(`INSERT INTO b2b_auth_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES ('coach','Coach','coach@example.test',true,now(),now()),('member','Member','member@example.test',true,now(),now()),('foreign','Foreign','foreign@example.test',true,now(),now());
        INSERT INTO b2b_organization(id,slug,brand) VALUES ('atlas','atlas','{"name":"Atlas"}'),('sur','sur','{"name":"Sur"}');
        INSERT INTO b2b_membership(organization_id,user_id,role) VALUES ('atlas','coach','coach'),('atlas','member','member'),('sur','foreign','member');`);
        await db.query('INSERT INTO b2b_program(id,organization_id,data) VALUES($1,$2,$3)', [
          'routine',
          'atlas',
          { name: 'Routine', description: '', steps: legacy.steps },
        ]);
        await db.query(
          'INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES($1,$2,1,$3)',
          ['atlas', 'routine', legacy],
        );
        await db.query(
          "INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES('assigned','atlas','member','routine',1,'coach')",
        );
        const blocked = {
          ...routine,
          version: 2,
          steps: [{ ...routine.steps[0], substitutionPolicy: 'blocked' }],
        };
        await db.query(
          'INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot,schema_version) VALUES($1,$2,2,$3,2)',
          ['atlas', 'routine', blocked],
        );
        for (const [index, fixture] of rawFixtures.entries()) {
          const version = index + 3;
          await db.query(
            'INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES($1,$2,$3,$4)',
            ['atlas', 'routine', version, { ...fixture.raw, version }],
          );
        }
        const before = (await db.query('SELECT snapshot::text FROM b2b_program_version')).rows;
        const context: AuthorizedProductContext = {
          db,
          actorId: 'coach',
          organizationId: 'atlas',
          branchId: 'atlas-principal',
          role: 'coach',
          accessMode: 'active',
          accessRevision: 0,
          capabilities: new Set(['edit-planning', 'read-training-history']),
          authorizeMember: async (member) => {
            if (member !== 'member') throw new Error('FOREIGN_MEMBER');
          },
        };
        for (const [index, fixture] of rawFixtures.entries()) {
          const version = index + 3;
          const raw = { ...fixture.raw, version };
          const frozen = { ...confirmedFixture(fixture.raw), version };
          const supplement = legacySupplement(raw, frozen, 'member');
          const bytesBefore = (
            await db.query('SELECT snapshot::text FROM b2b_program_version WHERE version=$1', [
              version,
            ])
          ).rows[0].snapshot;
          const storedBeforeHash = createHash('sha256').update(bytesBefore).digest('hex');
          await saveLegacySupplement(context, supplement, `adopt-raw-${version}`);
          await saveLegacySupplement(context, supplement, `adopt-raw-${version}`);
          assert.equal(
            (await alternatives(context, { id: 'routine', version, stepId: 'step' })).length,
            3,
          );
          await assert.rejects(
            saveLegacySupplement(
              context,
              { ...supplement, sourceSnapshotHash: contentHash(ProgramVersionSchema.parse(raw)) },
              `normalized-${version}`,
            ),
          );
          await assert.rejects(
            saveLegacySupplement(
              context,
              {
                ...supplement,
                sourceSnapshotHash: contentHash({ ...raw, steps: [{ ...raw.steps[0], reps: 99 }] }),
              },
              `tamper-${version}`,
            ),
          );
          const bytesAfter = (
            await db.query('SELECT snapshot::text FROM b2b_program_version WHERE version=$1', [
              version,
            ])
          ).rows[0].snapshot;
          assert.equal(bytesAfter, bytesBefore);
          assert.equal(createHash('sha256').update(bytesAfter).digest('hex'), storedBeforeHash);
          const saved = (
            await db.query(
              'SELECT source_snapshot_hash FROM b2b_routine_supplement WHERE program_version=$1',
              [version],
            )
          ).rows[0];
          assert.equal(saved.source_snapshot_hash, contentHash(raw));
        }
        const supplement = legacySupplement(legacy, routine, 'member');
        const input = { id: 'routine', version: 1, stepId: 'step' };
        assert.deepEqual(await alternatives(context, input), []);
        assert.deepEqual(await alternatives(context, { ...input, version: 2 }), []);
        await assert.rejects(alternatives(context, { ...input, stepId: 'missing' }));
        const other = await pool.connect();
        try {
          await Promise.all([
            saveLegacySupplement(context, supplement, 'adopt'),
            saveLegacySupplement({ ...context, db: other }, supplement, 'adopt'),
          ]);
        } finally {
          other.release();
        }
        await saveLegacySupplement(context, supplement, 'adopt');
        assert.equal((await db.query('SELECT * FROM b2b_routine_supplement')).rowCount, 3);
        assert.equal(
          (await db.query("SELECT * FROM b2b_audit WHERE action='routine.supplement'")).rowCount,
          3,
        );
        assert.equal((await alternatives(context, input)).length, 3);
        const member = {
          ...context,
          actorId: 'member',
          role: 'member' as const,
          capabilities: new Set<never>(),
        };
        assert.equal((await alternatives(member, input)).length, 3);
        await assert.rejects(
          alternatives(
            { ...member, actorId: 'unassigned', authorizeMember: async () => {} },
            input,
          ),
        );
        await assert.rejects(alternatives({ ...context, branchId: 'sur-principal' }, input));
        await assert.rejects(alternatives({ ...context, organizationId: 'sur' }, input));
        await assert.rejects(alternatives({ ...context, accessMode: 'export-only' }, input));
        await assert.rejects(
          saveLegacySupplement({ ...context, branchId: 'sur-principal' }, supplement, 'adopt'),
        );
        await assert.rejects(
          saveLegacySupplement(
            context,
            {
              ...supplement,
              supplement: { ...routine, description: 'Changed after adoption' },
            },
            'changed',
          ),
        );
        const segment: SessionContent['segments'][number] = {
          segmentId: 'chosen',
          originalStepId: 'step',
          exerciseId: relations[0].targetExerciseId,
          dose: relations[0].targetDose,
          relation: relations[0],
          confirmedConditions: relations[0].conditions,
          createdAt: at,
        };
        const selected = {
          segments: [segment],
          selectedSegments: [{ originalStepId: 'step', segmentId: 'chosen' }],
        };
        const none = { segments: [], selectedSegments: [] };
        await assertNewReviewedCatalogEligibility(context, selected, none);
        await db.query(
          "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise',$1,false)",
          [relations[0].targetExerciseId],
        );
        assert.equal((await alternatives(context, input)).length, 2);
        await assert.rejects(assertNewReviewedCatalogEligibility(context, selected, none), {
          code: 'REVIEWED_TARGET_UNAVAILABLE',
        });
        await assertNewReviewedCatalogEligibility(context, selected, selected);
        await assert.rejects(
          assertNewReviewedCatalogEligibility(context, selected, {
            ...selected,
            selectedSegments: [],
          }),
          { code: 'REVIEWED_TARGET_UNAVAILABLE' },
        );

        await db.query(
          "UPDATE b2b_exercise SET data=jsonb_set(data,'{name}','\"Changed current catalog\"') WHERE id=$1",
          [relations[0].targetExerciseId],
        );
        assert.equal((await alternatives(context, input)).length, 2);
        assert.deepEqual(
          (await db.query('SELECT snapshot::text FROM b2b_program_version')).rows,
          before,
        );
        await assert.rejects(
          db.query("UPDATE b2b_routine_supplement SET snapshot='{}'"),
          /immutable|append.only/i,
        );
        await db.query('DELETE FROM b2b_branch_catalog WHERE resource_id=$1', [segment.exerciseId]);
        await assert.rejects(assertNewReviewedCatalogEligibility(context, selected, none), {
          code: 'REVIEWED_TARGET_UNAVAILABLE',
        });
        await assertNewReviewedCatalogEligibility(context, selected, selected);
        await db.query('DELETE FROM b2b_reviewed_relation');
        assert.equal(
          await enrichReviewedCatalog(db),
          42 -
            catalog
              .flatMap((e) => projectReviewedRelations(e, catalog))
              .filter(
                (r) =>
                  r.sourceExerciseId === relations[0].targetExerciseId ||
                  r.targetExerciseId === relations[0].targetExerciseId,
              ).length,
        );
      } finally {
        db.release();
      }
    } finally {
      await pool.end();
      await owner.query(`DROP SCHEMA ${schema} CASCADE`);
      await owner.end();
    }
  },
);
