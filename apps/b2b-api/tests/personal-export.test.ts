import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EnrollmentSchema,
  OccurrenceSchema,
  PersonalExportSchema,
  RoutineVersionV2Schema,
} from '@klisteniapp/b2b-contracts/product-v2';
import {
  canonicalExercises,
  contentHash,
  projectReviewedRelations,
} from '../src/catalog/reviewed-projection.ts';
import {
  createPersonalExportServices,
  PERSONAL_EXPORT_COVERAGE,
  PERSONAL_EXPORT_HEADERS,
} from '../src/exports/index.ts';
import { contract, errorCode, fixture, NOW, queued, seedHistory } from './wp06/fixture.ts';
import { emptyHealth, measurement } from './fixtures/health.ts';

test('WP06 own export retains legacy originals, every correction, ranges and units without staff/other-member material', async () => {
  await fixture(async (f) => {
    const expected = await seedHistory(f.pool);
    await seedHistory(f.pool, 'unassigned', 'other-');
    await f.pool
      .query(`INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id) VALUES('atlas','coach','staff-private','staff-private-note');
      UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member';
      UPDATE b2b_branch_grant SET active=false WHERE organization_id='atlas' AND user_id='member';
      UPDATE b2b_branch SET status='archived' WHERE id='atlas-principal'`);
    const data = { ...emptyHealth(), measurements: [measurement()] };
    await f.pool.query('INSERT INTO b2b_health(owner_id,revision,data) VALUES($1,1,$2),($3,1,$4)', [
      'member',
      data,
      'unassigned',
      { ...emptyHealth(), profile: { notes: 'other-private' } },
    ]);
    const before = (await f.pool.query('SELECT data::text FROM b2b_execution ORDER BY id')).rows;
    const result = await f.own((c) => f.exports.personalExport(c, {}));
    assert.deepEqual(PersonalExportSchema.parse(JSON.parse(JSON.stringify(result))), result);
    assert.equal(result.ownerId, 'member');
    assert.equal(result.exportedAt, NOW);
    assert.equal(result.serverAcceptedOnly, true);
    assert.deepEqual(result.training[0]!.legacyExecutions[0]!.original, expected.original);
    assert.deepEqual(result.training[0]!.routines[0]!.snapshot, expected.routine);
    assert.deepEqual(result.training[0]!.sessionRevisions, expected.revisions);
    assert.deepEqual(result.training[0]!.sessionRevisions[1]!.content.segments[0]!.dose.sets, {
      kind: 'range',
      min: 3,
      max: 4,
    });
    assert.equal(result.training[0]!.sessionRevisions[1]!.content.sets[0]!.loadKg, 12.5);
    assert.deepEqual(result.health.data, data);
    assert.doesNotMatch(JSON.stringify(result), /other-|staff-private|other-private|@example/);
    assert.deepEqual(
      (await f.pool.query('SELECT data::text FROM b2b_execution ORDER BY id')).rows,
      before,
    );
    assert.ok(PERSONAL_EXPORT_COVERAGE.omitted.some((text) => text.includes('Unsynchronized')));
    assert.match(PERSONAL_EXPORT_HEADERS['Cache-Control'], /no-store/);
  });
});

test('WP06 interchange includes issued v2 lineage, all period/schedule revisions and reviewed target provenance', async () => {
  await fixture(async (f) => {
    const exercises = canonicalExercises();
    const source = exercises.find((exercise) => exercise.id === 'squat')!;
    const relations = projectReviewedRelations(source, exercises);
    const routine = RoutineVersionV2Schema.parse({
      schemaVersion: 2,
      programId: 'v2',
      version: 1,
      scope: { organizationId: 'atlas', branchId: 'atlas-principal' },
      publishedAt: NOW,
      name: 'Range routine',
      description: 'Preserve exact dose',
      steps: [
        { id: 'step', exerciseId: source.id, dose: contract.dose, substitutionPolicy: 'reviewed' },
      ],
      exercises,
      machines: [],
      relations,
    });
    await f.pool.query(
      "INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version,schema_version) VALUES('v2','atlas','atlas-principal','{}',1,2)",
    );
    await f.pool.query(
      "INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot,schema_version) VALUES('atlas','atlas-principal','v2',1,$1,2)",
      [routine],
    );
    const scope = { organizationId: 'atlas', branchId: 'atlas-principal', memberId: 'member' };
    const content = {
      name: 'Issued goal',
      goal: 'Continuity',
      timeZone: 'UTC',
      stages: [
        {
          id: 'stage',
          name: 'Phase',
          startDate: '2026-10-12',
          endDate: '2026-10-18',
          slots: [
            { id: 'slot', weekday: 1, routine: { schemaVersion: 2, programId: 'v2', version: 1 } },
          ],
        },
      ],
    };
    await f.pool.query(
      "INSERT INTO b2b_goal_program(organization_id,branch_id,member_id,id,content,revision,status) VALUES('atlas','atlas-principal','member','goal',$1,1,'active')",
      [content],
    );
    await f.pool.query(
      "INSERT INTO b2b_goal_program_revision(organization_id,branch_id,member_id,goal_program_id,revision,content,actor_id) VALUES('atlas','atlas-principal','member','goal',1,$1,'coach')",
      [content],
    );
    await f.pool.query(
      "INSERT INTO b2b_enrollment(organization_id,branch_id,member_id,id,goal_program_id,issued_goal_revision,revision,status) VALUES('atlas','atlas-principal','member','enrollment','goal',1,2,'active')",
    );
    const enrollments = [1, 2].map((revision) =>
      EnrollmentSchema.parse({
        schemaVersion: 2,
        id: 'enrollment',
        scope,
        goalProgramId: 'goal',
        issuedGoalRevision: 1,
        revision,
        status: 'active',
        content: { ...content, goal: `Period ${revision}` },
        createdAt: NOW,
      }),
    );
    for (const enrollment of enrollments)
      await f.pool.query(
        "INSERT INTO b2b_enrollment_revision(organization_id,branch_id,member_id,enrollment_id,revision,content,actor_id) VALUES('atlas','atlas-principal','member','enrollment',$1,$2,'coach')",
        [enrollment.revision, enrollment],
      );
    await f.pool.query(
      "INSERT INTO b2b_stage_revision(organization_id,branch_id,enrollment_id,enrollment_revision,id,ordinal,start_date,end_date,content) VALUES('atlas','atlas-principal','enrollment',1,'stage',0,'2026-10-12','2026-10-18',$1)",
      [content.stages[0]],
    );
    await f.pool
      .query(`INSERT INTO b2b_occurrence(organization_id,branch_id,member_id,id,enrollment_id,issued_enrollment_revision,stage_id,slot_id,slot_ordinal,program_id,program_version,original_date,original_week_start,time_zone,scheduled_date,current_week_start,revision,eligibility)
      VALUES('atlas','atlas-principal','member','occurrence','enrollment',1,'stage','slot',0,'v2',1,'2026-10-12','2026-10-12','UTC','2026-10-13','2026-10-12',1,'required')`);
    const occurrences = [0, 1].map((revision) =>
      OccurrenceSchema.parse({
        schemaVersion: 2,
        id: 'occurrence',
        scope,
        enrollmentId: 'enrollment',
        stageId: 'stage',
        slotId: 'slot',
        slotOrdinal: 0,
        routine: { schemaVersion: 2, programId: 'v2', version: 1 },
        issuedEnrollmentRevision: 1,
        originalDate: '2026-10-12',
        originalWeek: { startDate: '2026-10-12', timeZone: 'UTC' },
        scheduledDate: revision ? '2026-10-13' : '2026-10-12',
        currentWeek: { startDate: '2026-10-12', timeZone: 'UTC' },
        permittedDateOverride: null,
        revision,
        eligibility: 'required',
        cancellationReason: null,
      }),
    );
    for (const occurrence of occurrences)
      await f.pool.query(
        "INSERT INTO b2b_occurrence_revision(organization_id,branch_id,member_id,occurrence_id,revision,snapshot,actor_id) VALUES('atlas','atlas-principal','member','occurrence',$1,$2,'member')",
        [occurrence.revision, occurrence],
      );
    const result = await f.own((c) => f.exports.personalExport(c, {}));
    assert.deepEqual(result.training[0]!.routines, [{ schemaVersion: 2, snapshot: routine }]);
    assert.deepEqual(result.training[0]!.enrollments, enrollments);
    assert.deepEqual(result.training[0]!.occurrences, occurrences);
    assert.ok(relations.length > 0);
    assert.deepEqual(result.training[0]!.routines[0]!.snapshot, routine);
  });
});

test('WP06 export rejects caller member overrides and stale context; other tenant never supplies training', async () => {
  await fixture(async (f) => {
    await seedHistory(f.pool);
    await assert.rejects(
      f.own((c) => f.exports.personalExport(c, { memberId: 'unassigned' } as never)),
    );
    await f.own(async (c) => {
      await assert.rejects(
        f.exports.personalExport({ ...c, accessRevision: c.accessRevision - 1 }, {}),
        errorCode('CONTEXT_REVOKED'),
      );
      await assert.rejects(
        f.exports.personalExport({ ...c, capabilities: new Set() }, {}),
        errorCode('CONTEXT_REVOKED'),
      );
    });
    await f.pool.query(
      "INSERT INTO b2b_membership(organization_id,user_id,role) VALUES('sur','member','member')",
    );
    const result = await f.own((c) => f.exports.personalExport(c, {}), 'member', 'sur', null);
    assert.deepEqual(result.training, []);
    assert.equal(result.health.ownerId, 'member');
  });
});

test('WP06 separate invitation is optional, validates destination and performs no mutation', async () => {
  await fixture(async (f) => {
    const queries = [
      'SELECT count(*) FROM b2b_auth_user',
      'SELECT count(*) FROM b2b_auth_session',
      'SELECT count(*) FROM b2b_audit',
    ];
    const before = await Promise.all(
      queries.map(async (query) => (await f.pool.query(query)).rows),
    );
    await f.own(async (c) => {
      assert.deepEqual(await f.exports.b2cInvitation(c, {}), {
        separateProduct: true,
        paid: true,
        automaticConversion: false,
        url: null,
      });
      const configured = createPersonalExportServices({
        b2cInvitationUrl: 'https://personal.example.test/start',
      });
      assert.equal(
        (await configured.b2cInvitation(c, {})).url,
        'https://personal.example.test/start',
      );
    }, 'inactive');
    assert.deepEqual(
      await Promise.all(queries.map(async (query) => (await f.pool.query(query)).rows)),
      before,
    );
    for (const url of [
      'http://example.test',
      'javascript:alert(1)',
      'https://a:b@example.test',
      'https://example.test/?owner=member',
      'https://example.test/#token',
    ])
      assert.throws(() => createPersonalExportServices({ b2cInvitationUrl: url }));
  });
});

test('WP06 export fails as a whole when accepted current history is incomplete', async () => {
  await fixture(async (f) => {
    await seedHistory(f.pool);
    // A broken head is possible without inventing a replacement snapshot.
    await f.pool.query(
      "UPDATE b2b_training_session SET revision=3 WHERE organization_id='atlas' AND member_id='member'",
    );
    await assert.rejects(
      f.own((c) => f.exports.personalExport(c, {})),
      errorCode('CONTEXT_REVOKED'),
    );
  });
});

test('WP06 queued export reauthorizes after an atomic inactivity commit', async () => {
  await fixture(async (f) => {
    await seedHistory(f.pool);
    const blocker = await f.pool.connect();
    let download: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query("SELECT id FROM b2b_organization WHERE id='atlas' FOR UPDATE");
      await blocker.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      download = f.own(async (c) => ({
        mode: c.accessMode,
        export: await f.exports.personalExport(c, {}),
      }));
      await queued(f);
      await blocker.query('COMMIT');
      const result = (await download) as { mode: string; export: { ownerId: string } };
      assert.equal(result.mode, 'export-only');
      assert.equal(result.export.ownerId, 'member');
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await download?.catch(() => undefined);
    }
  });
});

test('WP06 legacy supplement export retains original hash and independent ranged target dose', async () => {
  await fixture(async (f) => {
    const original = await seedHistory(f.pool);
    const supplement = RoutineVersionV2Schema.parse({
      schemaVersion: 2,
      programId: 'routine',
      version: 1,
      scope: { organizationId: 'atlas', branchId: 'atlas-principal' },
      publishedAt: NOW,
      name: 'Legacy supplement',
      description: '',
      steps: [
        { id: 'step', exerciseId: 'exercise', dose: contract.dose, substitutionPolicy: 'reviewed' },
      ],
      exercises: [],
      machines: [],
      relations: [],
    });
    const hash = contentHash(original.routine);
    await f.pool.query(
      "INSERT INTO b2b_routine_supplement(organization_id,branch_id,program_id,program_version,source_snapshot_hash,snapshot) VALUES('atlas','atlas-principal','routine',1,$1,$2)",
      [hash, supplement],
    );
    const result = await f.own((c) => f.exports.personalExport(c, {}));
    assert.deepEqual(result.training[0]!.supplements[0]!.supplement, supplement);
    assert.equal(result.training[0]!.supplements[0]!.sourceSnapshotHash, hash);
    assert.deepEqual(result.training[0]!.routines[0]!.snapshot, original.routine);
  });
});
