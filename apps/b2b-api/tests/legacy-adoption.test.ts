import assert from 'node:assert/strict';
import test from 'node:test';
import { ProgramVersionSchema } from '@klisteniapp/b2b-contracts/training';
import {
  AdoptLegacySupplementSchema,
  SessionContentSchema,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import { productFixture, databaseUrl } from './support/product-fixture.ts';
import { canonicalExercises } from '../src/catalog/reviewed-projection.ts';
import { legacySupplementPreview, adoptLegacySupplement } from '../src/catalog/legacy-adoption.ts';
import { sessionBinding } from '../src/sessions/binding.ts';
import { createSessionServices } from '../src/sessions/index.ts';
import type { Pool } from 'pg';
const records = createSessionServices(() => new Date('2026-11-10T12:00:00Z'));
const original = ProgramVersionSchema.parse({
  programId: 'routine',
  branchId: 'atlas-principal',
  branchName: 'Principal',
  version: 1,
  name: 'Original',
  description: '',
  publishedAt: '2026-10-01T10:00:00Z',
  steps: [
    {
      id: 'step',
      exerciseId: 'squat',
      sets: 3,
      reps: 8,
      loadKg: null,
      durationSeconds: null,
      restSeconds: 60,
      notes: '',
      alternatives: ['manual-unreviewed'],
    },
  ],
  exercises: [canonicalExercises().find((e) => e.id === 'squat')!],
  machines: [],
});
async function seed(pool: Pool) {
  await pool.query(
    "INSERT INTO b2b_program(id,organization_id,data) VALUES('routine','atlas',$1)",
    [{ name: original.name, description: '', steps: original.steps }],
  );
  await pool.query(
    "INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES('atlas','routine',1,$1)",
    [original],
  );
  await pool.query(
    "INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES('assignment','atlas','member','routine',1,'coach')",
  );
  await pool.query(
    "INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data) VALUES('atlas','execution','member','assignment',$1)",
    [
      {
        id: 'execution',
        assignmentId: 'assignment',
        status: 'partial',
        sets: [
          {
            stepId: 'step',
            set: 1,
            exerciseId: 'squat',
            reps: 6,
            durationSeconds: null,
            rpe: null,
            loadKg: null,
            reason: '',
          },
        ],
        notes: 'Original actuals',
        completedAt: '2026-10-02T10:00:00Z',
      },
    ],
  );
}
function adopt(preview: ProductOutput<'legacySupplementPreview'>, blocked = false) {
  return AdoptLegacySupplementSchema.parse({
    id: 'assignment',
    operationId: 'adoption',
    expectedRevision: 0,
    sourceSnapshotHash: preview.sourceSnapshotHash,
    sourceDosesConfirmed: true,
    sharedVersionConfirmed: true,
    sourceSteps: preview.draft.steps.map((s) => ({
      ...s,
      substitutionPolicy: blocked ? 'blocked' : 'reviewed',
      dose: { ...s.dose, load: { mode: 'bodyweight' }, laterality: 'per-side' },
    })),
    targetConfirmations: blocked
      ? []
      : preview.proposals.map((p) => ({ relationId: p.relation.id, relationHash: p.hash })),
  });
}
function saveInput(id: string, correction = false) {
  return {
    id,
    operationId: `save-${id}`,
    expectedRevision: 0,
    origin: {
      kind: 'legacy' as const,
      assignmentId: 'assignment',
      executionId: correction ? id : null,
      routine: { programId: 'routine', version: 1, schemaVersion: 1 as const },
    },
    content: SessionContentSchema.parse({
      status: 'partial',
      explicitCompletion: false,
      performedAt: '2026-10-02T10:00:00Z',
      notes: '',
      correctionReason: correction ? 'Correct original notes' : '',
      segments: [
        {
          segmentId: 'source',
          originalStepId: 'step',
          exerciseId: 'squat',
          relation: null,
          confirmedConditions: [],
          createdAt: '2026-10-02T10:00:00Z',
          dose: {
            mode: 'repetitions',
            sets: { kind: 'fixed', value: 3 },
            repetitions: { kind: 'fixed', value: 8 },
            durationSeconds: null,
            load: { mode: 'unspecified' },
            restSeconds: { kind: 'fixed', value: 60 },
            laterality: 'bilateral',
            targetRpe: null,
            notes: '',
          },
        },
      ],
      selectedSegments: [{ originalStepId: 'step', segmentId: 'source' }],
      sets: [],
    }),
  };
}
test(
  'public adoption requires exact confirmations, preserves original bytes and replays atomically after catalog changes',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped, service }) => {
      await seed(pool);
      assert.equal(typeof service.productProducers.adoptLegacySupplement, 'function');
      assert.equal(typeof service.productProducers.sessionBinding, 'function');
      const before = (await pool.query('SELECT snapshot::text FROM b2b_program_version')).rows;
      const read = () =>
        scoped('coach', 'atlas-principal', false, (c) =>
          legacySupplementPreview(c, { id: 'assignment' }),
        );
      const preview = await read();
      assert.equal(preview.proposals.length, 3);
      assert.equal(preview.draft.steps[0]!.dose.laterality, null);
      assert.deepEqual(preview.draft.steps[0]!.dose.load, { mode: 'unspecified' });
      const input = adopt(preview);
      const send = (value = input) =>
        scoped('coach', 'atlas-principal', true, (c) => adoptLegacySupplement(c, value));
      await assert.rejects(send({ ...input, targetConfirmations: [] }), { status: 409 });
      await assert.rejects(send({ ...input, sourceSnapshotHash: '0'.repeat(64) }), { status: 409 });
      await assert.rejects(
        send({
          ...input,
          sourceSteps: [
            {
              ...input.sourceSteps[0]!,
              dose: { ...input.sourceSteps[0]!.dose, sets: { kind: 'fixed', value: 4 } },
            },
          ],
        }),
        { status: 409 },
      );
      assert.equal((await pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 0);
      const accepted = await send();
      assert.deepEqual(
        accepted.supplement.relations.map((r) => r.targetDose),
        preview.proposals.map((p) => p.relation.targetDose),
      );
      await pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise',$1,false)",
        [preview.proposals[0]!.relation.targetExerciseId],
      );
      assert.deepEqual(await send(), accepted);
      await assert.rejects(send({ ...input, sharedVersionConfirmed: false } as never));
      await assert.rejects(
        send({
          ...input,
          sourceSteps: input.sourceSteps.map((s) => ({ ...s, substitutionPolicy: 'blocked' })),
        }),
        { code: 'OPERATION_CONFLICT' },
      );
      assert.deepEqual(
        (await pool.query('SELECT snapshot::text FROM b2b_program_version')).rows,
        before,
      );
      assert.equal(
        (await pool.query("SELECT * FROM b2b_audit WHERE action='routine.supplement'")).rowCount,
        1,
      );
      assert.equal((await pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 1);
      await pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='coach'",
      );
      await assert.rejects(send(), { status: 403 });
    });
  },
);
test(
  'adoption denies member and foreign branch access and detects catalog changes before new acceptance',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      await seed(pool);
      await assert.rejects(
        scoped('member', 'atlas-principal', false, (c) =>
          legacySupplementPreview(c, { id: 'assignment' }),
        ),
        { status: 403 },
      );
      await assert.rejects(
        scoped('super', 'atlas-north', false, (c) =>
          legacySupplementPreview(c, { id: 'assignment' }),
        ),
        { status: 404 },
      );
      const preview = await scoped('coach', 'atlas-principal', false, (c) =>
        legacySupplementPreview(c, { id: 'assignment' }),
      );
      await pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise',$1,false)",
        [preview.proposals[0]!.relation.targetExerciseId],
      );
      await assert.rejects(
        scoped('coach', 'atlas-principal', true, (c) => adoptLegacySupplement(c, adopt(preview))),
        { status: 409 },
      );
      const accepted = await scoped('coach', 'atlas-principal', true, (c) =>
        adoptLegacySupplement(c, adopt(preview, true)),
      );
      assert.equal(accepted.supplement.relations.length, 0);
    });
  },
);
test(
  'supplement adoption cannot alter retained session doses or prior bytes; new sessions require adopted doses',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      await seed(pool);
      const own = <T>(run: Parameters<typeof scoped<T>>[3]) =>
        scoped('member', 'atlas-principal', true, run);
      const input = saveInput('before-adoption');
      const accepted = await own((c) => records.saveSession(c, input));
      const bytes = (
        await pool.query('SELECT snapshot::text FROM b2b_session_revision ORDER BY revision')
      ).rows;
      const preview = await scoped('coach', 'atlas-principal', false, (c) =>
        legacySupplementPreview(c, { id: 'assignment' }),
      );
      await scoped('coach', 'atlas-principal', true, (c) =>
        adoptLegacySupplement(c, adopt(preview)),
      );
      const binding = await own((c) => sessionBinding(c, { id: input.id }));
      assert.equal(binding.prescription.kind, 'legacy-compatibility');
      const corrected = await own((c) =>
        records.saveSession(c, {
          ...input,
          operationId: 'correction',
          expectedRevision: 1,
          content: {
            ...input.content,
            notes: 'Corrected notes',
            correctionReason: 'Correct notes',
          },
        }),
      );
      assert.equal(corrected.session.revision, 2);
      assert.deepEqual(
        (await pool.query('SELECT snapshot::text FROM b2b_session_revision WHERE revision=1')).rows,
        bytes,
      );
      assert.deepEqual(await own((c) => records.saveSession(c, input)), accepted);
      await assert.rejects(
        own((c) => records.saveSession(c, saveInput('new-invalid'))),
        { status: 400 },
      );
      const next = saveInput('new-adopted');
      next.content.segments[0]!.dose = adopt(preview).sourceSteps[0]!.dose;
      await own((c) => records.saveSession(c, next));
      assert.equal(
        (await own((c) => sessionBinding(c, { id: next.id }))).prescription.kind,
        'reviewed',
      );
      await assert.rejects(
        scoped('other-coach', 'atlas-principal', false, (c) => sessionBinding(c, { id: next.id })),
        { status: 403 },
      );
    });
  },
);
test(
  'first legacy correction binding keeps accepted null, requires reason and preserves original revision zero after retirement',
  { skip: !databaseUrl },
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      await seed(pool);
      const own = <T>(run: Parameters<typeof scoped<T>>[3]) =>
        scoped('member', 'atlas-principal', true, run);
      const before = await own((c) => sessionBinding(c, { id: 'execution' }));
      assert.equal(before.accepted, null);
      assert.equal(before.original!.revision, 0);
      const raw = (await pool.query('SELECT data::text FROM b2b_execution')).rows;
      const input = saveInput('execution', true);
      await assert.rejects(
        own((c) =>
          records.saveSession(c, { ...input, content: { ...input.content, correctionReason: '' } }),
        ),
        { status: 400 },
      );
      await pool.query("UPDATE b2b_program_assignment SET active=false WHERE id='assignment'");
      const accepted = await own((c) => records.saveSession(c, input));
      const after = await own((c) => sessionBinding(c, { id: 'execution' }));
      assert.deepEqual(after.original, before.original);
      assert.deepEqual(after.accepted, accepted.session);
      assert.deepEqual((await pool.query('SELECT data::text FROM b2b_execution')).rows, raw);
      assert.deepEqual(
        (await own((c) => records.sessionRevisions(c, { id: 'execution' }))).map((r) => r.revision),
        [0, 1],
      );
    });
  },
);
