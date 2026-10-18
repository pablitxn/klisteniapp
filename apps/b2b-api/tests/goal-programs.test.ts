import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExerciseInputSchema, MachineInputSchema } from '@klisteniapp/b2b-contracts';
import { RoutineDraftContentSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { TrainingRepository } from '../src/training/repository.ts';
import { HttpError } from '../src/errors.ts';
import type { Context } from '../src/organization-context.ts';
import {
  content,
  databaseUrl,
  enroll,
  errorCode,
  fixture,
  goalContent,
  occurrenceRows,
  publish,
} from './wp02/fixture.ts';

test(
  'unspecified load differs from bodyweight and zero external load; explicit rest default is retained',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const draft = content();
      draft.steps[0]!.dose.load = { mode: 'unspecified' };
      await f.transaction((context) =>
        f.module.saveRoutine(context, {
          id: 'routine',
          operationId: 'save',
          expectedRevision: 0,
          content: draft,
        }),
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: 'routine',
            operationId: 'publish',
            expectedRevision: 1,
          }),
        ),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          assert.ok(
            error.issues?.some(
              (issue) => issue.stepId === 'step' && issue.path.join('.') === 'steps.0.dose.load',
            ),
          );
          return true;
        },
      );
      draft.steps[0]!.dose.load = { mode: 'external', kilograms: { kind: 'fixed', value: 0 } };
      await f.transaction((context) =>
        f.module.saveRoutine(context, {
          id: 'routine',
          operationId: 'zero-load',
          expectedRevision: 1,
          content: draft,
        }),
      );
      const published = await f.transaction((context) =>
        f.module.publishRoutine(context, {
          id: 'routine',
          operationId: 'publish-zero',
          expectedRevision: 2,
        }),
      );
      assert.deepEqual(published.steps[0]!.dose.load, draft.steps[0]!.dose.load);
      assert.deepEqual(published.steps[0]!.dose.restSeconds, { kind: 'fixed', value: 60 });
    });
  },
);

test(
  'drafts can reference unpublished exercises; publication and assignment recheck current branch equipment',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const model = MachineInputSchema.parse({ name: 'Model', type: 'resistance' });
      const exercise = ExerciseInputSchema.parse({
        name: 'Machine exercise',
        instructions: ['Use the configured dose.'],
        machineId: 'model',
      });
      await f.pool.query(
        "INSERT INTO b2b_machine(id,organization_id,branch_id,data,status) VALUES('model','atlas','atlas-principal',$1,'published')",
        [model],
      );
      await f.pool.query("UPDATE b2b_exercise SET data=$1,status='draft' WHERE id='exercise'", [
        exercise,
      ]);
      await f.transaction((context) =>
        f.module.saveRoutine(context, {
          id: 'routine',
          operationId: 'save',
          expectedRevision: 0,
          content: content(),
        }),
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: 'routine',
            operationId: 'unpublished',
            expectedRevision: 1,
          }),
        ),
        errorCode('INVALID_INPUT'),
      );
      await f.pool.query("UPDATE b2b_exercise SET status='published' WHERE id='exercise'");
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: 'routine',
            operationId: 'no-equipment',
            expectedRevision: 1,
          }),
        ),
        errorCode('INCOMPLETE_PRESCRIPTION'),
      );
      await f.pool.query(
        "INSERT INTO b2b_unit(id,organization_id,branch_id,machine_id,label) VALUES('unit','atlas','atlas-principal','model','Unit')",
      );
      await f.transaction((context) =>
        f.module.publishRoutine(context, {
          id: 'routine',
          operationId: 'publish',
          expectedRevision: 1,
        }),
      );
      await f.pool.query("UPDATE b2b_unit SET archived=true WHERE id='unit'");
      await assert.rejects(enroll(f), errorCode('INCOMPLETE_PRESCRIPTION'));
      assert.equal((await f.pool.query('SELECT * FROM b2b_enrollment')).rowCount, 0);
      assert.equal((await f.pool.query('SELECT * FROM b2b_program_version')).rowCount, 1);
    });
  },
);

test(
  'draft stage dates and identities remain consistent without requiring unfinished fields',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const request = {
        id: 'goal',
        memberId: 'member',
        operationId: 'save',
        expectedRevision: 0,
        content: {
          name: '',
          goal: '',
          timeZone: null,
          stages: [
            {
              id: 'stage',
              name: '',
              startDate: null as string | null,
              endDate: null as string | null,
              slots: [
                { id: 'slot', weekday: null, routine: null },
                { id: 'slot', weekday: null, routine: null },
              ],
            },
          ],
        },
      };
      await assert.rejects(
        f.transaction((context) => f.module.saveGoal(context, request)),
        errorCode('INVALID_INPUT'),
      );
      request.content.stages[0]!.slots.pop();
      request.content.stages[0]!.startDate = '2026-10-10';
      request.content.stages[0]!.endDate = '2026-10-01';
      await assert.rejects(
        f.transaction((context) => f.module.saveGoal(context, request)),
        errorCode('INVALID_INPUT'),
      );
      request.content.stages[0]!.endDate = null;
      assert.equal(
        (await f.transaction((context) => f.module.saveGoal(context, request))).revision,
        1,
      );
    });
  },
);

test(
  'planning persists empty and partially configured drafts; publication reports exact missing fields',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const request = {
        id: 'empty',
        operationId: 'save-empty',
        expectedRevision: 0,
        content: { name: '', description: '', steps: [] },
      };
      const saved = await f.transaction((context) => f.module.saveRoutine(context, request));
      assert.equal(saved.revision, 1);
      assert.deepEqual(
        await f.transaction((context) => f.module.routine(context, { id: saved.id })),
        saved,
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: saved.id,
            expectedRevision: 1,
            operationId: 'publish-empty',
          }),
        ),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          assert.equal(error.code, 'INCOMPLETE_PRESCRIPTION');
          assert.deepEqual(
            error.issues?.map((issue) => issue.path),
            [['name'], ['steps']],
          );
          return true;
        },
      );
      const incomplete = content();
      incomplete.steps[0]!.exerciseId = null;
      incomplete.steps[0]!.dose.sets = null;
      incomplete.steps[0]!.dose.load = { mode: 'unspecified' };
      const draft = await f.transaction((context) =>
        f.module.saveRoutine(context, {
          ...request,
          content: incomplete,
          operationId: 'save-incomplete',
          expectedRevision: 1,
        }),
      );
      assert.deepEqual(draft.steps, incomplete.steps);
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: saved.id,
            expectedRevision: 2,
            operationId: 'publish-incomplete',
          }),
        ),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          for (const path of [
            ['steps', 0, 'exerciseId'],
            ['steps', 0, 'dose', 'sets'],
          ])
            assert.ok(
              error.issues?.some(
                (issue) =>
                  issue.stepId === 'step' && JSON.stringify(issue.path) === JSON.stringify(path),
              ),
            );
          return true;
        },
      );
      assert.equal((await f.pool.query('SELECT * FROM b2b_program_version')).rowCount, 0);
    });
  },
);

test(
  'fixed/range publication freezes immutable versions; legacy readers reject v2 before strict parsing',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const original = await publish(f);
      const revised = content();
      revised.name = 'Second version';
      revised.steps[0]!.dose.mode = 'duration';
      revised.steps[0]!.dose.repetitions = null;
      revised.steps[0]!.dose.durationSeconds = { kind: 'fixed', value: 45 };
      revised.steps[0]!.dose.load = {
        mode: 'external',
        kilograms: { kind: 'range', min: 0, max: 5 },
      };
      const draft = await f.transaction((context) =>
        f.module.saveRoutine(context, {
          id: 'routine',
          operationId: 'edit-routine',
          expectedRevision: 2,
          content: revised,
        }),
      );
      const second = await f.transaction((context) =>
        f.module.publishRoutine(context, {
          id: 'routine',
          operationId: 'second-publish',
          expectedRevision: draft.revision,
        }),
      );
      assert.equal(second.version, 2);
      assert.equal(second.steps[0]!.dose.durationSeconds?.kind, 'fixed');
      const versions = (
        await f.pool.query(
          'SELECT schema_version,snapshot FROM b2b_program_version ORDER BY version',
        )
      ).rows;
      assert.deepEqual(
        versions.map((row) => row.schema_version),
        [2, 2],
      );
      assert.deepEqual(versions[0].snapshot, original);
      assert.deepEqual(versions[1].snapshot, second);
      await assert.rejects(
        f.transaction(async (context) => {
          const legacy = {
            db: context.db,
            actorId: context.actorId,
            role: 'coach',
            org: { id: 'atlas' },
            branchId: 'atlas-principal',
          } as Context;
          await new TrainingRepository(legacy).programVersion('routine', 1);
        }),
        errorCode('UPGRADE_REQUIRED'),
      );
      const audit = (
        await f.pool.query(
          "SELECT * FROM b2b_audit WHERE action='routine.publish' ORDER BY before_revision",
        )
      ).rows;
      assert.deepEqual(
        audit.map((row) => [
          Number(row.before_revision),
          Number(row.after_revision),
          row.actor_id,
          row.branch_id,
        ]),
        [
          [1, 2, 'coach', 'atlas-principal'],
          [3, 4, 'coach', 'atlas-principal'],
        ],
      );
    });
  },
);

test(
  'exact replay returns its original response after successors; payload reuse and stale trainer edits conflict',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const request = {
        id: 'routine',
        operationId: 'save',
        expectedRevision: 0,
        content: content(),
      };
      const first = await f.transaction((context) => f.module.saveRoutine(context, request));
      await f.transaction((context) =>
        f.module.saveRoutine(context, {
          ...request,
          expectedRevision: 1,
          operationId: 'successor',
          content: { ...content(), name: 'Changed' },
        }),
      );
      assert.deepEqual(
        await f.transaction((context) => f.module.saveRoutine(context, request)),
        first,
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.saveRoutine(context, {
            ...request,
            content: { ...content(), name: 'Different' },
          }),
        ),
        errorCode('OPERATION_CONFLICT'),
      );
      await assert.rejects(
        f.transaction((context) => f.module.saveRoutine(context, { ...request, id: 'another' })),
        errorCode('OPERATION_CONFLICT'),
      );
      await assert.rejects(
        f.transaction(
          (context) =>
            f.module.saveRoutine(context, {
              ...request,
              operationId: 'stale-trainer',
              expectedRevision: 1,
            }),
          { actorId: 'other-coach' },
        ),
        errorCode('REVISION_CONFLICT'),
      );
      assert.equal(
        (await f.pool.query("SELECT * FROM b2b_audit WHERE action='routine.save'")).rowCount,
        2,
      );
      assert.equal((await f.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 2);
    });
  },
);

test(
  'goal drafts retain unfinished dates and references; activation binds the exact saved complete revision',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const draft = await f.transaction((context) =>
        f.module.saveGoal(context, {
          id: 'goal',
          memberId: 'member',
          operationId: 'draft-goal',
          expectedRevision: 0,
          content: {
            name: '',
            goal: '',
            timeZone: null,
            stages: [
              {
                id: 'stage',
                name: '',
                startDate: null,
                endDate: null,
                slots: [{ id: 'slot', weekday: null, routine: null }],
              },
            ],
          },
        }),
      );
      assert.deepEqual(
        (await f.transaction((context) => f.module.goals(context, { memberId: 'member' })))[0],
        draft,
      );
      await publish(f);
      await assert.rejects(
        f.transaction((context) =>
          f.module.enroll(context, {
            id: 'enrollment',
            memberId: 'member',
            goalProgramId: 'goal',
            issuedGoalRevision: 1,
            operationId: 'enroll-incomplete',
            expectedRevision: 0,
            content: goalContent(),
          }),
        ),
        errorCode('INCOMPLETE_PRESCRIPTION'),
      );
      const complete = await f.transaction((context) =>
        f.module.saveGoal(context, {
          id: 'goal',
          memberId: 'member',
          operationId: 'complete-goal',
          expectedRevision: 1,
          content: goalContent(),
        }),
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.enroll(context, {
            id: 'enrollment',
            memberId: 'member',
            goalProgramId: 'goal',
            issuedGoalRevision: complete.revision,
            operationId: 'enroll-forged',
            expectedRevision: 0,
            content: { ...goalContent(), goal: 'Different issued objective' },
          }),
        ),
        errorCode('REVISION_CONFLICT'),
      );
      assert.equal((await f.pool.query('SELECT * FROM b2b_enrollment')).rowCount, 0);
    });
  },
);

test(
  'two same-day slots and two stages reuse one immutable routine; gaps are explicit and overlaps fail',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const content = goalContent();
      content.stages[0]!.endDate = '2026-10-05';
      content.stages[0]!.slots.push({ ...content.stages[0]!.slots[0]!, id: 'second-slot' });
      content.stages.push({
        ...structuredClone(content.stages[0]!),
        id: 'second-stage',
        startDate: '2026-10-19',
        endDate: '2026-10-19',
      });
      const enrollment = await enroll(f, content);
      const occurrences = await occurrenceRows(f);
      assert.equal(occurrences.length, 4);
      assert.equal(new Set(occurrences.map((item) => item.id)).size, 4);
      assert.deepEqual(
        occurrences.map((item) => item.originalDate),
        ['2026-10-05', '2026-10-05', '2026-10-19', '2026-10-19'],
      );
      assert.ok(
        occurrences.every(
          (item) => item.routine.programId === 'routine' && item.routine.version === 1,
        ),
      );
      assert.equal((await f.pool.query('SELECT * FROM b2b_program_version')).rowCount, 1);
      const overlap = structuredClone(content);
      overlap.stages[1]!.startDate = '2026-10-05';
      await assert.rejects(
        f.transaction((context) =>
          f.module.periodPreview(context, {
            id: enrollment.id,
            expectedRevision: 1,
            proposed: overlap,
          }),
        ),
        errorCode('INVALID_INPUT'),
      );
      const reversed = structuredClone(content);
      reversed.stages[0]!.endDate = '2026-10-04';
      await assert.rejects(
        f.transaction((context) =>
          f.module.periodPreview(context, {
            id: enrollment.id,
            expectedRevision: 1,
            proposed: reversed,
          }),
        ),
        errorCode('INVALID_INPUT'),
      );
    });
  },
);

test(
  'archive blocks new reuse and retains issued versions, enrollments, revision references and active continuity',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const version = await publish(f);
      const enrollment = await enroll(f);
      await f.transaction((context) =>
        f.module.archiveRoutine(context, {
          id: 'routine',
          operationId: 'archive',
          expectedRevision: 2,
        }),
      );
      assert.deepEqual(await publish(f), version);
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: 'routine',
            operationId: 'new-archived-publish',
            expectedRevision: 3,
          }),
        ),
        errorCode('REVISION_CONFLICT'),
      );
      await assert.rejects(enroll(f, goalContent(), 'another'), errorCode('INVALID_INPUT'));
      assert.deepEqual(
        (await f.pool.query('SELECT snapshot FROM b2b_program_version')).rows[0].snapshot,
        version,
      );
      const continuity = await f.transaction((context) =>
        f.module.continuity(context, { memberId: 'member' }),
      );
      assert.deepEqual(continuity.current, [enrollment]);
      assert.equal(Object.hasOwn(continuity, 'substitutionCount'), false);
      const goals = await f.transaction((context) =>
        f.module.goals(context, { memberId: 'member' }),
      );
      const archived = await f.transaction((context) =>
        f.module.archiveGoal(context, {
          id: goals[0]!.id,
          operationId: 'archive-goal',
          expectedRevision: goals[0]!.revision,
        }),
      );
      assert.equal(archived.status, 'archived');
      assert.equal((await f.pool.query('SELECT * FROM b2b_enrollment_revision')).rowCount, 1);
    });
  },
);

test(
  'tenant/branch/member boundaries, unavailable resources and inactive replay fail before writes',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const request = {
        id: 'routine',
        operationId: 'routine-save',
        expectedRevision: 0,
        content: content(),
      };
      await f.transaction((context) => f.module.saveRoutine(context, request));
      assert.deepEqual(
        await f.transaction((context) => f.module.routines(context, {}), {
          branchId: 'atlas-east',
        }),
        [],
      );
      await assert.rejects(
        f.transaction((context) => f.module.routine(context, { id: 'routine' }), {
          branchId: 'atlas-east',
        }),
        errorCode('NOT_FOUND'),
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.saveGoal(context, {
            id: 'foreign-goal',
            memberId: 'foreign',
            operationId: 'foreign-goal',
            expectedRevision: 0,
            content: goalContent(),
          }),
        ),
        errorCode('FORBIDDEN'),
      );
      const foreign = content();
      foreign.steps[0]!.exerciseId = 'foreign-exercise';
      await assert.rejects(
        f.transaction((context) =>
          f.module.saveRoutine(context, {
            ...request,
            id: 'foreign',
            operationId: 'foreign-resource',
            content: foreign,
          }),
        ),
        errorCode('INVALID_INPUT'),
      );
      await assert.rejects(
        f.transaction((context) => f.module.saveRoutine(context, request), { actorId: 'member' }),
        errorCode('FORBIDDEN'),
      );
      await f.pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='coach'",
      );
      await assert.rejects(
        f.transaction((context) => f.module.saveRoutine(context, request)),
        errorCode('FORBIDDEN'),
      );
      assert.equal((await f.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 1);
      assert.equal(
        RoutineDraftContentSchema.safeParse({ ...content(), organizationId: 'sur' }).success,
        false,
      );
    });
  },
);

test(
  'planning CAS serializes two trainers and exact concurrent retries append once',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const request = {
        id: 'routine',
        operationId: 'save',
        expectedRevision: 0,
        content: content(),
      };
      const [first, replay] = await Promise.all([
        f.transaction((context) => f.module.saveRoutine(context, request)),
        f.transaction((context) => f.module.saveRoutine(context, request)),
      ]);
      assert.deepEqual(first, replay);
      const results = await Promise.allSettled([
        f.transaction((context) =>
          f.module.saveRoutine(context, {
            ...request,
            expectedRevision: 1,
            operationId: 'trainer-a',
          }),
        ),
        f.transaction(
          (context) =>
            f.module.saveRoutine(context, {
              ...request,
              expectedRevision: 1,
              operationId: 'trainer-b',
            }),
          { actorId: 'other-coach' },
        ),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const rejected = results.find(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult;
      assert.ok(errorCode('REVISION_CONFLICT')(rejected.reason));
      assert.equal(
        (await f.pool.query("SELECT * FROM b2b_audit WHERE action='routine.save'")).rowCount,
        2,
      );
    });
  },
);
