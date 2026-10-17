import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionRevisionSchema, type Enrollment } from '@klisteniapp/b2b-contracts/product-v2';
import { PlanningModule } from '../src/planning/index.ts';
import { createPlanningResources } from '../src/planning/resources.ts';
import {
  databaseUrl,
  enroll,
  errorCode,
  fixture,
  goalContent,
  legacy,
  occurrenceRows,
  publish,
  syntheticSchedule,
  type Fixture,
} from './wp02/fixture.ts';

async function seedLegacy(f: Fixture) {
  await f.pool.query(
    'INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version) VALUES($1,$2,$3,$4,1)',
    [
      'legacy-routine',
      'atlas',
      'atlas-principal',
      {
        name: legacy.legacyRoutine.name,
        description: legacy.legacyRoutine.description,
        steps: legacy.legacyRoutine.steps,
      },
    ],
  );
  await f.pool.query(
    'INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot) VALUES($1,$2,$3,1,$4)',
    [
      'atlas',
      'atlas-principal',
      'legacy-routine',
      { ...legacy.legacyRoutine, programId: 'legacy-routine' },
    ],
  );
  await f.pool.query(
    "INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES('legacy-assignment','atlas','atlas-principal','member','legacy-routine',1,'coach')",
  );
  await f.pool.query(
    'INSERT INTO b2b_execution(organization_id,branch_id,id,member_id,assignment_id,data) VALUES($1,$2,$3,$4,$5,$6)',
    [
      'atlas',
      'atlas-principal',
      'legacy-execution',
      'member',
      'legacy-assignment',
      { ...legacy.legacyRetry, id: 'legacy-execution', assignmentId: 'legacy-assignment' },
    ],
  );
}
async function originalHistory(f: Fixture) {
  return Promise.all(
    [
      'SELECT organization_id,branch_id,program_id,version,snapshot::text FROM b2b_program_version ORDER BY program_id,version',
      'SELECT * FROM b2b_program_assignment ORDER BY id',
      'SELECT organization_id,branch_id,id,member_id,assignment_id,data::text,created_at FROM b2b_execution ORDER BY id',
      'SELECT * FROM b2b_training_session ORDER BY id',
      'SELECT organization_id,branch_id,session_id,revision,snapshot::text FROM b2b_session_revision ORDER BY session_id,revision',
      'SELECT organization_id,branch_id,goal_program_id,revision,content::text FROM b2b_goal_program_revision ORDER BY goal_program_id,revision',
    ].map(async (query) => (await f.pool.query(query)).rows),
  );
}
async function seedSession(f: Fixture, status: 'partial' | 'completed' = 'completed') {
  const occurrence = (await occurrenceRows(f))[0]!;
  const session = SessionRevisionSchema.parse({
    schemaVersion: 2,
    id: 'actual',
    scope: occurrence.scope,
    origin: { kind: 'occurrence', occurrenceId: occurrence.id, routine: occurrence.routine },
    revision: 1,
    operationId: 'actual-operation',
    actorId: 'member',
    acceptedAt: '2026-10-06T12:00:00Z',
    content: {
      status,
      explicitCompletion: status === 'completed',
      performedAt: '2026-10-05T12:00:00Z',
      notes: 'Keep actual work unchanged',
      segments: [
        {
          segmentId: 'segment',
          originalStepId: 'step',
          exerciseId: 'exercise',
          dose: legacy.dose,
          relation: null,
          confirmedConditions: [],
          createdAt: '2026-10-05T12:00:00Z',
        },
      ],
      selectedSegments: [{ originalStepId: 'step', segmentId: 'segment' }],
      sets: [1, 2, 3].map((ordinal) => ({
        performedSetId: `actual-set-${ordinal}`,
        segmentId: 'segment',
        ordinal,
        side: 'both',
        repetitions: 7,
        durationSeconds: null,
        loadKg: null,
        rpe: null,
        notes: '',
      })),
      correctionReason: '',
    },
  });
  await f.pool.query(
    'INSERT INTO b2b_training_session(organization_id,branch_id,member_id,id,occurrence_id,program_id,program_version,revision) VALUES($1,$2,$3,$4,$5,$6,$7,1)',
    [
      'atlas',
      'atlas-principal',
      'member',
      session.id,
      occurrence.id,
      occurrence.routine.programId,
      occurrence.routine.version,
    ],
  );
  await f.pool.query(
    'INSERT INTO b2b_session_revision(organization_id,branch_id,member_id,session_id,revision,schema_version,snapshot,actor_id) VALUES($1,$2,$3,$4,1,2,$5,$3)',
    ['atlas', 'atlas-principal', 'member', session.id, session],
  );
  return session;
}
function moved(enrollment: Enrollment) {
  const proposed = structuredClone(enrollment.content);
  proposed.stages[0]!.startDate = '2026-10-19';
  proposed.stages[0]!.endDate = '2026-11-01';
  return proposed;
}

test(
  'legacy draft projection requires explicit load/laterality confirmation and never rewrites issued versions or actuals',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await seedLegacy(f);
      const before = await originalHistory(f);
      const projected = await f.transaction((context) =>
        f.module.routine(context, { id: 'legacy-routine' }),
      );
      assert.deepEqual(projected.steps[0]!.dose.load, { mode: 'unspecified' });
      assert.equal(projected.steps[0]!.dose.laterality, null);
      assert.equal(
        (await f.pool.query("SELECT schema_version FROM b2b_program WHERE id='legacy-routine'"))
          .rows[0].schema_version,
        1,
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.publishRoutine(context, {
            id: 'legacy-routine',
            expectedRevision: 0,
            operationId: 'unconfirmed',
          }),
        ),
        errorCode('INCOMPLETE_PRESCRIPTION'),
      );
      projected.steps[0]!.dose.load = { mode: 'bodyweight' };
      projected.steps[0]!.dose.laterality = 'bilateral';
      await f.transaction((context) =>
        f.module.saveRoutine(context, {
          id: projected.id,
          expectedRevision: projected.revision,
          operationId: 'confirm',
          content: {
            name: projected.name,
            description: projected.description,
            steps: projected.steps,
          },
        }),
      );
      const published = await f.transaction((context) =>
        f.module.publishRoutine(context, {
          id: projected.id,
          expectedRevision: 1,
          operationId: 'new-version',
        }),
      );
      assert.equal(published.version, 2);
      const after = await originalHistory(f);
      assert.deepEqual(
        after[0]!.filter((row) => row.version === 1),
        before[0],
      );
      assert.deepEqual(after.slice(1), before.slice(1));
    });
  },
);

test(
  'competing period applies accept one revision and deny foreign branch, member writes and inactive replay',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      const proposed = moved(issued);
      const first = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      const second = await f.transaction(
        (context) =>
          f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
        { actorId: 'other-coach' },
      );
      await assert.rejects(
        f.transaction(
          (context) =>
            f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
          { branchId: 'atlas-east' },
        ),
        errorCode('NOT_FOUND'),
      );
      await assert.rejects(
        f.transaction(
          (context) =>
            f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
          { actorId: 'member' },
        ),
        errorCode('FORBIDDEN'),
      );
      const base = { enrollmentId: issued.id, expectedRevision: 1, proposed };
      const outcomes = await Promise.allSettled([
        f.transaction((context) =>
          f.module.applyPeriod(context, {
            ...base,
            previewHash: first.previewHash,
            operationId: 'apply-first',
          }),
        ),
        f.transaction(
          (context) =>
            f.module.applyPeriod(context, {
              ...base,
              previewHash: second.previewHash,
              operationId: 'apply-second',
            }),
          { actorId: 'other-coach' },
        ),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assert.equal(
        outcomes.filter(
          (outcome) =>
            outcome.status === 'rejected' && errorCode('REVISION_CONFLICT')(outcome.reason),
        ).length,
        1,
      );
      const winner =
        outcomes[0]!.status === 'fulfilled'
          ? { actorId: 'coach', previewHash: first.previewHash, operationId: 'apply-first' }
          : {
              actorId: 'other-coach',
              previewHash: second.previewHash,
              operationId: 'apply-second',
            };
      await f.pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      await assert.rejects(
        f.transaction(
          (context) =>
            f.module.applyPeriod(context, {
              ...base,
              previewHash: winner.previewHash,
              operationId: winner.operationId,
            }),
          { actorId: winner.actorId },
        ),
        errorCode('FORBIDDEN'),
      );
      const continuity = await f.transaction((context) =>
        f.module.continuity(context, { memberId: 'member' }),
      );
      assert.equal(continuity.future[0]!.revision, 2);
      assert.equal(
        (await f.pool.query("SELECT * FROM b2b_audit WHERE action='enrollment.period'")).rowCount,
        1,
      );
    });
  },
);

test(
  'period preview/apply before and after logged work preserves original versions, assignment IDs and actual bytes',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      await seedLegacy(f);
      const issued = await enroll(f);
      const firstOccurrences = await occurrenceRows(f);
      const proposed = moved(issued);
      const earlyPreview = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      assert.ok(earlyPreview.impacts.every((impact) => impact.linkedSessionIds.length === 0));
      const actual = await seedSession(f);
      await assert.rejects(
        f.transaction((context) =>
          f.module.applyPeriod(context, {
            enrollmentId: issued.id,
            expectedRevision: 1,
            proposed,
            previewHash: earlyPreview.previewHash,
            operationId: 'stale-before-log',
          }),
        ),
        errorCode('STALE_PERIOD_PREVIEW'),
      );
      const original = await originalHistory(f);
      const preview = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      assert.equal(preview.impacts.length, 2);
      const loggedImpact = preview.impacts.find((impact) =>
        impact.linkedSessionIds.includes(actual.id),
      )!;
      assert.deepEqual(loggedImpact.linkedSessionIds, [actual.id]);
      assert.equal(loggedImpact.beforeDate, '2026-10-05');
      assert.equal(loggedImpact.afterDate, '2026-10-19');
      assert.notEqual(preview.previewHash, earlyPreview.previewHash);
      const request = {
        enrollmentId: issued.id,
        expectedRevision: 1,
        proposed,
        previewHash: preview.previewHash,
        operationId: 'apply-period',
      };
      const applied = await f.transaction((context) => f.module.applyPeriod(context, request));
      assert.equal(applied.revision, 2);
      assert.equal(applied.issuedGoalRevision, issued.issuedGoalRevision);
      assert.deepEqual(await originalHistory(f), original);
      const occurrences = await occurrenceRows(f);
      for (const occurrence of occurrences) {
        const original = firstOccurrences.find((item) => item.id === occurrence.id)!;
        assert.equal(occurrence.originalDate, original.originalDate);
        assert.deepEqual(occurrence.originalWeek, original.originalWeek);
        assert.deepEqual(occurrence.routine, original.routine);
        assert.equal(occurrence.issuedEnrollmentRevision, original.issuedEnrollmentRevision);
        assert.equal(occurrence.revision, 2);
      }
      const enrollmentRevisions = (
        await f.pool.query('SELECT content FROM b2b_enrollment_revision ORDER BY revision')
      ).rows;
      assert.deepEqual(
        enrollmentRevisions.map((row) => row.content),
        [issued, applied],
      );
      assert.deepEqual(
        await f.transaction((context) => f.module.applyPeriod(context, request)),
        applied,
      );
      const audit = (await f.pool.query("SELECT * FROM b2b_audit WHERE action='enrollment.period'"))
        .rows;
      assert.equal(audit.length, 1);
      assert.equal(audit[0].actor_id, 'coach');
      assert.deepEqual(audit[0].changed_fields, ['revision', 'content']);
      assert.equal(audit[0].operation_id, request.operationId);
      assert.equal((await f.pool.query('SELECT * FROM b2b_stage_revision')).rowCount, 2);
    });
  },
);

test(
  'removing a period slot previews exclusion, keeps linked actual work and ends enrollment without deletion',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      await seedSession(f, 'partial');
      const proposed = structuredClone(issued.content);
      proposed.stages[0]!.slots[0]!.id = 'new-slot';
      const before = await originalHistory(f);
      const preview = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      assert.ok(
        preview.impacts.every(
          (impact) => impact.afterEligibility === 'cancelled' && impact.afterDate === null,
        ),
      );
      assert.ok(preview.impacts.some((impact) => impact.linkedSessionIds.includes('actual')));
      await f.transaction((context) =>
        f.module.applyPeriod(context, {
          enrollmentId: issued.id,
          expectedRevision: 1,
          proposed,
          previewHash: preview.previewHash,
          operationId: 'remove-slot',
        }),
      );
      assert.deepEqual(await originalHistory(f), before);
      assert.ok(
        (await occurrenceRows(f)).every(
          (occurrence) => occurrence.eligibility === 'cancelled' && occurrence.cancellationReason,
        ),
      );
      const ended = await f.transaction((context) =>
        f.module.endEnrollment(context, { id: issued.id, expectedRevision: 2, operationId: 'end' }),
      );
      assert.equal(ended.status, 'ended');
      assert.equal(ended.revision, 3);
      assert.deepEqual(await originalHistory(f), before);
      assert.deepEqual(
        (await f.transaction((context) => f.module.continuity(context, { memberId: 'member' })))
          .past,
        [ended],
      );
    });
  },
);

test(
  'preview binds actor, proposed content, occurrence revision, accepted date override and server expiry',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      const proposed = moved(issued);
      const preview = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      const base = {
        enrollmentId: issued.id,
        expectedRevision: 1,
        proposed,
        previewHash: preview.previewHash,
      };
      await assert.rejects(
        f.transaction(
          (context) => f.module.applyPeriod(context, { ...base, operationId: 'other-actor' }),
          { actorId: 'other-coach' },
        ),
        errorCode('STALE_PERIOD_PREVIEW'),
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.applyPeriod(context, {
            ...base,
            proposed: { ...proposed, name: 'Other proposal' },
            operationId: 'other-proposal',
          }),
        ),
        errorCode('STALE_PERIOD_PREVIEW'),
      );
      const occurrence = (await occurrenceRows(f))[0]!;
      const movedOccurrence = {
        ...occurrence,
        scheduledDate: '2026-10-07',
        permittedDateOverride: '2026-10-07',
        revision: 2,
      };
      await f.pool.query(
        'UPDATE b2b_occurrence SET scheduled_date=$2,permitted_date_override=$2,revision=2 WHERE id=$1',
        [occurrence.id, movedOccurrence.scheduledDate],
      );
      await f.pool.query(
        "INSERT INTO b2b_occurrence_revision(organization_id,branch_id,member_id,occurrence_id,revision,snapshot,actor_id) VALUES('atlas','atlas-principal','member',$1,2,$2,'member')",
        [occurrence.id, movedOccurrence],
      );
      await assert.rejects(
        f.transaction((context) =>
          f.module.applyPeriod(context, { ...base, operationId: 'moved-schedule' }),
        ),
        errorCode('STALE_PERIOD_PREVIEW'),
      );
      const refreshed = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      assert.equal(
        refreshed.impacts.find((impact) => impact.occurrenceId === occurrence.id)!.beforeDate,
        '2026-10-07',
      );
      f.time.now = Date.parse(refreshed.expiresAt);
      await assert.rejects(
        f.transaction((context) =>
          f.module.applyPeriod(context, {
            ...base,
            previewHash: refreshed.previewHash,
            operationId: 'expired',
          }),
        ),
        errorCode('STALE_PERIOD_PREVIEW'),
      );
      assert.equal((await f.pool.query('SELECT revision FROM b2b_enrollment')).rows[0].revision, 1);
    });
  },
);

test(
  'actual correction after preview invalidates apply even when enrollment and schedule revisions match',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      const session = await seedSession(f);
      const proposed = moved(issued);
      const preview = await f.transaction((context) =>
        f.module.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      const corrected = SessionRevisionSchema.parse({
        ...session,
        revision: 2,
        operationId: 'correction',
        content: {
          ...session.content,
          notes: 'Corrected actual',
          correctionReason: 'Owner correction',
        },
      });
      await f.pool.query(
        "INSERT INTO b2b_session_revision(organization_id,branch_id,member_id,session_id,revision,schema_version,snapshot,actor_id) VALUES('atlas','atlas-principal','member','actual',2,2,$1,'member')",
        [corrected],
      );
      await f.pool.query("UPDATE b2b_training_session SET revision=2 WHERE id='actual'");
      await assert.rejects(
        f.transaction((context) =>
          f.module.applyPeriod(context, {
            enrollmentId: issued.id,
            expectedRevision: 1,
            proposed,
            previewHash: preview.previewHash,
            operationId: 'apply',
          }),
        ),
        errorCode('STALE_PERIOD_PREVIEW'),
      );
    });
  },
);

test(
  'schedule failure rolls back enrollment/stage revisions, receipts and audit in the authorized transaction',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      const failing = new PlanningModule({
        ...createPlanningResources(async () => []),
        schedule: {
          ...syntheticSchedule,
          async apply() {
            throw new Error('Synthetic schedule failure');
          },
        },
        now: () => f.time.now,
      });
      const proposed = moved(issued);
      const preview = await f.transaction((context) =>
        failing.periodPreview(context, { id: issued.id, expectedRevision: 1, proposed }),
      );
      await assert.rejects(
        f.transaction((context) =>
          failing.applyPeriod(context, {
            enrollmentId: issued.id,
            expectedRevision: 1,
            proposed,
            previewHash: preview.previewHash,
            operationId: 'rollback',
          }),
        ),
        /Synthetic schedule failure/,
      );
      assert.equal((await f.pool.query('SELECT * FROM b2b_enrollment_revision')).rowCount, 1);
      assert.equal(
        (await f.pool.query("SELECT * FROM b2b_operation_receipt WHERE operation_id='rollback'"))
          .rowCount,
        0,
      );
      assert.equal(
        (await f.pool.query("SELECT * FROM b2b_audit WHERE action='enrollment.period'")).rowCount,
        0,
      );
    });
  },
);

test(
  'continuity projects simultaneous current/past/future enrollments in their local timezone and leaves legacy work unscheduled',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      await seedLegacy(f);
      const current = await enroll(f);
      const another = await enroll(f, goalContent(), 'simultaneous');
      const past = goalContent();
      past.stages[0]!.startDate = '2026-09-01';
      past.stages[0]!.endDate = '2026-09-30';
      const future = goalContent();
      future.stages[0]!.startDate = '2026-11-01';
      future.stages[0]!.endDate = '2026-11-30';
      await enroll(f, past, 'past');
      await enroll(f, future, 'future');
      const projection = await f.transaction(
        (context) => f.module.continuity(context, { memberId: 'member' }),
        { actorId: 'member' },
      );
      assert.deepEqual(projection.current, [current, another]);
      assert.deepEqual(
        projection.past.map((item) => item.id),
        ['past'],
      );
      assert.deepEqual(
        projection.future.map((item) => item.id),
        ['future'],
      );
      assert.deepEqual(projection.unscheduledLegacyAssignmentIds, ['legacy-assignment']);
      f.time.now = Date.parse('2026-10-19T01:00:00Z'); // Still Sunday in New York.
      assert.equal(
        (await f.transaction((context) => f.module.continuity(context, { memberId: 'member' })))
          .current.length,
        2,
      );
      f.time.now = Date.parse('2026-10-19T05:00:00Z');
      assert.equal(
        (await f.transaction((context) => f.module.continuity(context, { memberId: 'member' })))
          .current.length,
        0,
      );
    });
  },
);
