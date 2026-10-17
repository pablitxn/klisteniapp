import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReviewedRelationSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { createRecordsServices } from '../src/schedule/index.ts';
import { content, databaseUrl, legacy, now, routine, withLedger } from './fixtures/wp03-ledger.ts';
const records = createRecordsServices(now);
test(
  'WP04 current branch equipment gates new target segments while retained history survives equipment archival',
  { skip: !databaseUrl },
  async () => {
    const relation = ReviewedRelationSchema.parse({
      id: 'equipment-target',
      sourceExerciseId: 'exercise',
      targetExerciseId: 'target',
      type: 'alternative',
      conditions: ['target-requirements-confirmed', 'use-target-dose'],
      rationale: 'Synthetic target equipment fixture',
      catalogRevision: 'a'.repeat(64),
      sourceContentHash: 'b'.repeat(64),
      targetContentHash: 'c'.repeat(64),
      requirements: ['Active target machine'],
      target: {
        id: 'target',
        scope: 'base',
        status: 'published',
        version: 1,
        revision: 0,
        name: 'Synthetic target',
        description: '',
        instructions: ['Synthetic'],
        equipment: 'machine',
        machineId: 'target-machine',
        compatibleMachineIds: [],
        pattern: '',
        muscles: [],
        animationId: null,
        assets: [],
        baseExerciseId: null,
      },
      targetDose: legacy.dose,
    });
    await withLedger(
      async (ledger) => {
        const [occurrence] = await ledger.run((ctx) =>
          records.occurrences(ctx, {
            memberId: 'member',
            weekStart: '2026-10-19',
            timeZone: 'America/New_York',
          }),
        );
        const input = {
          id: 'equipment-session',
          operationId: 'source',
          expectedRevision: 0,
          origin: {
            kind: 'occurrence' as const,
            occurrenceId: occurrence!.id,
            routine: occurrence!.routine,
          },
          content: content('partial'),
        };
        await ledger.run((ctx) => records.saveSession(ctx, input));
        const target = structuredClone(input.content);
        target.segments.push({
          segmentId: 'target',
          originalStepId: 'step',
          exerciseId: 'target',
          dose: relation.targetDose,
          relation,
          confirmedConditions: relation.conditions,
          createdAt: target.performedAt,
        });
        target.selectedSegments = [{ originalStepId: 'step', segmentId: 'target' }];
        await assert.rejects(
          ledger.run((ctx) =>
            records.saveSession(ctx, {
              ...input,
              operationId: 'unavailable',
              expectedRevision: 1,
              content: target,
            }),
          ),
          { code: 'INVALID_INPUT', message: 'TARGET_EQUIPMENT_UNAVAILABLE' },
        );
        await ledger.pool.query(
          "INSERT INTO b2b_machine(id,organization_id,data) VALUES('target-machine','atlas','{}'); INSERT INTO b2b_unit(id,organization_id,branch_id,machine_id,label) VALUES('target-unit','atlas','atlas-principal','target-machine','Synthetic')",
        );
        await ledger.run((ctx) =>
          records.saveSession(ctx, {
            ...input,
            operationId: 'select-target',
            expectedRevision: 1,
            content: target,
          }),
        );
        await ledger.pool.query("UPDATE b2b_unit SET archived=true WHERE id='target-unit'");
        target.notes = 'Retained after equipment loss';
        await ledger.run((ctx) =>
          records.saveSession(ctx, {
            ...input,
            operationId: 'retained',
            expectedRevision: 2,
            content: target,
          }),
        );
        const extra = structuredClone(target);
        extra.segments.push({ ...extra.segments[1]!, segmentId: 'another-target' });
        await assert.rejects(
          ledger.run((ctx) =>
            records.saveSession(ctx, {
              ...input,
              operationId: 'new-after-archive',
              expectedRevision: 3,
              content: extra,
            }),
          ),
          { message: 'TARGET_EQUIPMENT_UNAVAILABLE' },
        );
      },
      { ...routine, relations: [relation] },
    );
  },
);
test(
  'empty unselected draft remains empty after WP04 validation and cannot complete work',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const [occurrence] = await ledger.run((ctx) =>
        records.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      const draft = content('draft');
      draft.segments = [];
      draft.selectedSegments = [];
      const saved = await ledger.run((ctx) =>
        records.saveSession(ctx, {
          id: 'empty-draft',
          operationId: 'empty-draft',
          expectedRevision: 0,
          origin: {
            kind: 'occurrence',
            occurrenceId: occurrence!.id,
            routine: occurrence!.routine,
          },
          content: draft,
        }),
      );
      assert.deepEqual(saved.session.content, draft);
      assert.equal(
        (
          await ledger.run((ctx) =>
            records.week(ctx, {
              memberId: 'member',
              weekStart: '2026-10-19',
              timeZone: 'America/New_York',
            }),
          )
        ).completed,
        0,
      );
    });
  },
);
