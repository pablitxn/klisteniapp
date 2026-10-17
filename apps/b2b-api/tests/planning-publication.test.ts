import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExerciseInputSchema, type Exercise } from '@klisteniapp/b2b-contracts';
import {
  AssignableRoutineSchema,
  ReviewedRelationSchema,
} from '@klisteniapp/b2b-contracts/product-v2';
import { createPlanningResources } from '../src/planning/resources.ts';
import { content, databaseUrl, errorCode, fixture, legacy } from './wp02/fixture.ts';

test(
  'publication resolver receives all authorized published target candidates rather than source steps only',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const data = ExerciseInputSchema.parse({
        name: 'Target',
        instructions: ['Use the target dose.'],
      });
      await f.pool.query(
        `INSERT INTO b2b_exercise(id,organization_id,branch_id,data,status) VALUES
      ('base-target',null,null,$1,'published'),('same-branch','atlas','atlas-principal',$1,'published'),
      ('private-branch','atlas','atlas-east',$1,'published'),('shared-branch','atlas','atlas-east',$1,'published'),
      ('hidden-target',null,null,$1,'published'),('draft-target','atlas','atlas-principal',$1,'draft');`,
        [data],
      );
      await f.pool
        .query(`INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES
      ('atlas','atlas-principal','exercise','hidden-target',false),('atlas','atlas-principal','exercise','shared-branch',true);`);
      let candidates: readonly Exercise[] = [];
      const resources = createPlanningResources(async (_context, _routine, available) => {
        candidates = available;
        return [];
      });
      const publication = await f.transaction((context) =>
        resources.publicationResources(context, AssignableRoutineSchema.parse(content())),
      );
      const fixtureIds = new Set([
        'base-target',
        'exercise',
        'same-branch',
        'shared-branch',
        'private-branch',
        'hidden-target',
        'draft-target',
        'foreign-exercise',
      ]);
      assert.deepEqual(
        candidates.map((exercise) => exercise.id).filter((id) => fixtureIds.has(id)),
        ['base-target', 'exercise', 'same-branch', 'shared-branch'],
      );
      assert.ok(candidates.some((exercise) => exercise.id === 'squat'));
      assert.deepEqual(
        publication.exercises.map((exercise) => exercise.id),
        ['exercise'],
      );
      assert.deepEqual(publication.relations, []);
    });
  },
);

test(
  'publication freezes eligible target content and rejects a resolver returning hidden, foreign or changed targets',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      const data = ExerciseInputSchema.parse({
        name: 'Target',
        instructions: ['Use target dose.'],
      });
      await f.pool.query(
        "INSERT INTO b2b_exercise(id,organization_id,branch_id,data,status) VALUES('target',null,null,$1,'published'),('hidden',null,null,$1,'published')",
        [data],
      );
      await f.pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise','hidden',false)",
      );
      const relation = (target: Exercise) =>
        ReviewedRelationSchema.parse({
          id: `reviewed-exercise-${target.id}`,
          sourceExerciseId: 'exercise',
          targetExerciseId: target.id,
          type: 'alternative',
          conditions: ['target-requirements-confirmed', 'use-target-dose'],
          rationale: 'Synthetic callback boundary fixture.',
          catalogRevision: 'a'.repeat(64),
          sourceContentHash: 'b'.repeat(64),
          targetContentHash: 'c'.repeat(64),
          target,
          requirements: ['Use target dose'],
          targetDose: legacy.dose,
        });
      let target: Exercise | undefined;
      const resources = createPlanningResources(async (_context, _routine, available) => {
        target = available.find((exercise) => exercise.id === 'target')!;
        return [relation(target)];
      });
      const routine = AssignableRoutineSchema.parse(content());
      const frozen = await f.transaction((context) =>
        resources.publicationResources(context, routine),
      );
      assert.deepEqual(
        frozen.exercises.map((exercise) => exercise.id),
        ['exercise', 'target'],
      );
      assert.equal(frozen.relations[0]!.targetExerciseId, 'target');
      for (const invalid of [
        { ...target!, id: 'hidden' },
        { ...target!, id: 'foreign-exercise' },
        { ...target!, name: 'Changed target' },
      ]) {
        const invalidResources = createPlanningResources(async () => [relation(invalid)]);
        await assert.rejects(
          f.transaction((context) => invalidResources.publicationResources(context, routine)),
          errorCode('INVALID_INPUT'),
        );
      }
    });
  },
);
