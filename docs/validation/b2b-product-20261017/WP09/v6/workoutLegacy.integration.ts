import {
  ProductAccessSchema,
  RoutineStepSchema,
} from "@klisteniapp/b2b-contracts/product-v2";
import assert from "node:assert/strict";
import test from "node:test";
import { ProgramVersionSchema } from "@klisteniapp/b2b-contracts/training";
import { productFixture } from "/workspace/wp09-correction-efbed/apps/b2b-api/tests/support/product-fixture.ts";
import { sessionBinding } from "/workspace/wp09-correction-efbed/apps/b2b-api/src/sessions/binding.ts";
import { createSessionServices } from "/workspace/wp09-correction-efbed/apps/b2b-api/src/sessions/index.ts";
import {
  legacySupplementPreview,
  adoptLegacySupplement,
} from "/workspace/wp09-correction-efbed/apps/b2b-api/src/catalog/legacy-adoption.ts";
import { canonicalExercises } from "/workspace/wp09-correction-efbed/apps/b2b-api/src/catalog/reviewed-projection.ts";
import {
  createBoundWorkoutDocument,
  loadSessionWorkout,
} from "/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/sync/sessionWorkoutBinding.ts";
import {
  queueWorkout,
  WorkoutSync,
  resolveWorkoutConflict,
} from "/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/sync/workoutSync.ts";
import {
  MemoryWorkoutStore,
  now,
} from "/workspace/wp09-correction-efbed/apps/b2b-web/tests/fixtures/workout.ts";
import {
  originalRoutine,
  legacyBinding,
  ids,
} from "/workspace/wp09-correction-efbed/apps/b2b-web/tests/fixtures/legacyWorkout.ts";
import type { WorkoutScope } from "/workspace/wp09-correction-efbed/apps/b2b-web/src/features/training/storage/workoutStore.ts";
const records = createSessionServices(() => new Date(now));
const selection = {
  id: "original-execution",
  scope: {
    origin: "http://wp09-integration.test",
    accountId: "member",
    actorId: "member",
    organizationId: "atlas",
    branchId: "atlas-principal",
    realm: { mode: "unified", key: "synthetic-realm" },
  } satisfies WorkoutScope,
  origin: {
    kind: "legacy" as const,
    assignmentId: "assignment",
    executionId: "original-execution",
    routine: { schemaVersion: 1 as const, programId: "routine", version: 1 },
  },
};
async function seed(
  pool: Parameters<Parameters<typeof productFixture>[0]>[0]["pool"],
) {
  const routine = ProgramVersionSchema.parse({
    ...originalRoutine,
    branchId: "atlas-principal",
    steps: originalRoutine.steps.map((s) => ({ ...s, exerciseId: "squat" })),
    exercises: [canonicalExercises().find((e) => e.id === "squat")!],
  });
  const execution = structuredClone(legacyBinding().original!.original);
  execution.sets[0].exerciseId = "squat";
  await pool.query(
    "INSERT INTO b2b_program(id,organization_id,data) VALUES('routine','atlas',$1)",
    [{ name: routine.name, description: "", steps: routine.steps }],
  );
  await pool.query(
    "INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES('atlas','routine',1,$1)",
    [routine],
  );
  await pool.query(
    "INSERT INTO b2b_program_assignment(id,organization_id,member_id,program_id,version,assigned_by) VALUES('assignment','atlas','member','routine',1,'coach')",
  );
  await pool.query(
    "INSERT INTO b2b_execution(organization_id,id,member_id,assignment_id,data) VALUES('atlas','original-execution','member','assignment',$1)",
    [execution],
  );
  return (await pool.query("SELECT data::text FROM b2b_execution")).rows;
}
test("WP09 real PostgreSQL first correction retries one receipt, retains original and keeps compatibility after later reviewed adoption", async () => {
  await productFixture(async ({ pool, scoped }) => {
    const raw = await seed(pool);
    const own = <T>(run: Parameters<typeof scoped<T>>[3]) =>
      scoped("member", "atlas-principal", true, run);
    const binding = await own((c) => sessionBinding(c, { id: selection.id }));
    const d = createBoundWorkoutDocument(selection, binding, ids(), now),
      store = new MemoryWorkoutStore();
    assert.equal(d.accepted, null);
    await assert.rejects(queueWorkout(d, 1, "first-correction", now), /motivo/);
    assert.equal(
      Number(
        (await pool.query("SELECT count(*) FROM b2b_operation_receipt")).rows[0]
          .count,
      ),
      0,
    );
    d.content.correctionReason = "Correct original repetitions";
    const revision = await own(async (c) => c.accessRevision);
    const queued = await queueWorkout(d, revision, "first-correction", now);
    await store.compareAndSet(queued, null);
    let attempts = 0;
    const transport = {
      access: () =>
        own(async (c) =>
          ProductAccessSchema.parse({
            schemaVersion: 2 as const,
            userId: c.actorId,
            organizationId: c.organizationId,
            role: c.role,
            accessMode: c.accessMode,
            accessRevision: c.accessRevision,
            branches: [{ branchId: c.branchId, role: c.role }],
            capabilities: [...c.capabilities],
          }),
        ),
      save: async (input: (typeof queued.operations)[number]["payload"]) => {
        const response = await own((c) => records.saveSession(c, input));
        if (++attempts === 1)
          throw new Error("Synthetic response lost after commit");
        return response;
      },
    };
    await assert.rejects(
      new WorkoutSync(store, selection.scope, transport, true).replay(
        queued.key,
      ),
      /response lost/,
    );
    await new WorkoutSync(store, selection.scope, transport, true).replay(
      queued.key,
    );
    const accepted = (await store.read(queued.key))!;
    assert.equal(accepted.accepted!.revision, 1);
    assert.equal(
      Number(
        (
          await pool.query(
            "SELECT count(*) FROM b2b_operation_receipt WHERE operation_id='first-correction'",
          )
        ).rows[0].count,
      ),
      1,
    );
    assert.equal(
      Number(
        (
          await pool.query(
            "SELECT count(*) FROM b2b_audit WHERE operation_id='first-correction'",
          )
        ).rows[0].count,
      ),
      1,
    );
    const preview = await scoped("coach", "atlas-principal", false, (c) =>
      legacySupplementPreview(c, { id: "assignment" }),
    );
    await scoped("coach", "atlas-principal", true, (c) =>
      adoptLegacySupplement(c, {
        id: "assignment",
        operationId: "adopt-later",
        expectedRevision: 0,
        sourceSnapshotHash: preview.sourceSnapshotHash,
        sourceSteps: preview.draft.steps.map((s) =>
          RoutineStepSchema.parse({
            ...s,
            dose: {
              ...s.dose,
              load: { mode: "bodyweight" },
              laterality: "bilateral",
            },
          }),
        ),
        sourceDosesConfirmed: true,
        sharedVersionConfirmed: true,
        targetConfirmations: preview.proposals.map((p) => ({
          relationId: p.relation.id,
          relationHash: p.hash,
        })),
      }),
    );
    await pool.query(
      "UPDATE b2b_program_assignment SET active=false WHERE id='assignment'",
    );
    const loaded = await loadSessionWorkout({
      ...selection,
      store,
      readBinding: (id) => own((c) => sessionBinding(c, { id })),
      signal: new AbortController().signal,
      createId: ids(),
      now,
    });
    assert.equal(loaded.prescription.kind, "legacy-compatibility");
    assert.deepEqual(loaded.initial.content.segments[0].dose.load, {
      mode: "unspecified",
    });
    const next = await queueWorkout(
      {
        ...loaded.initial,
        content: {
          ...loaded.initial.content,
          notes: "Correction after later adoption",
          correctionReason: "Clarify retained actuals",
        },
      },
      revision,
      "next-correction",
      now,
    );
    await store.compareAndSet(
      { ...next, generation: loaded.initial.generation + 1 },
      loaded.initial.generation,
    );
    await new WorkoutSync(store, selection.scope, transport, true).replay(
      next.key,
    );
    assert.equal((await store.read(next.key))!.accepted!.revision, 2);
    assert.deepEqual(
      (await pool.query("SELECT data::text FROM b2b_execution")).rows,
      raw,
    );
    assert.deepEqual(
      (await own((c) => records.sessionRevisions(c, { id: selection.id }))).map(
        (r) => r.revision,
      ),
      [0, 1, 2],
    );
    assert.equal(
      (await store.read(next.key))!.content.explicitCompletion,
      false,
    );
  });
});
test("WP09 real PostgreSQL competing correction preserves pending bytes and requires explicit conflict choice", async () => {
  await productFixture(async ({ pool, scoped }) => {
    await seed(pool);
    const own = <T>(run: Parameters<typeof scoped<T>>[3]) =>
      scoped("member", "atlas-principal", true, run);
    const binding = await own((c) => sessionBinding(c, { id: selection.id })),
      store = new MemoryWorkoutStore();
    const d = createBoundWorkoutDocument(selection, binding, ids(), now);
    d.content.correctionReason = "Local correction";
    const revision = await own(async (c) => c.accessRevision),
      q = await queueWorkout(d, revision, "local-first", now);
    await store.compareAndSet(q, null);
    const remote = await own((c) =>
      records.saveSession(c, {
        ...q.operations[0].payload,
        operationId: "other-device",
        content: { ...d.content, notes: "Other device actuals" },
      }),
    );
    const transport = {
      access: () =>
        own(async (c) =>
          ProductAccessSchema.parse({
            schemaVersion: 2 as const,
            userId: c.actorId,
            organizationId: c.organizationId,
            role: c.role,
            accessMode: c.accessMode,
            accessRevision: c.accessRevision,
            branches: [{ branchId: c.branchId, role: c.role }],
            capabilities: [...c.capabilities],
          }),
        ),
      save: (input: (typeof q.operations)[number]["payload"]) =>
        own((c) => records.saveSession(c, input)),
    };
    await new WorkoutSync(store, selection.scope, transport, true).replay(
      q.key,
    );
    assert.equal((await store.read(q.key))!.problem!.kind, "conflict");
    const loaded = await loadSessionWorkout({
      ...selection,
      store,
      readBinding: (id) => own((c) => sessionBinding(c, { id })),
      signal: new AbortController().signal,
      createId: ids(),
      now,
    });
    assert.deepEqual(
      loaded.initial.operations[0].payload,
      q.operations[0].payload,
    );
    const resolved = resolveWorkoutConflict(
      loaded.initial,
      remote.session,
      "local",
    );
    const successor = await queueWorkout(
      resolved,
      revision,
      "explicit-successor",
      now,
    );
    await store.compareAndSet(
      { ...successor, generation: loaded.initial.generation + 1 },
      loaded.initial.generation,
    );
    await new WorkoutSync(store, selection.scope, transport, true).replay(
      q.key,
    );
    assert.equal((await store.read(q.key))!.accepted!.revision, 2);
    assert.equal(
      (await store.read(q.key))!.operations[1].payload.expectedRevision,
      1,
    );
    assert.deepEqual(
      (await store.read(q.key))!.binding!.original,
      binding.original,
    );
    assert.equal(
      Number(
        (
          await pool.query(
            "SELECT count(*) FROM b2b_operation_receipt WHERE operation_id='local-first'",
          )
        ).rows[0].count,
      ),
      0,
    );
  });
});
