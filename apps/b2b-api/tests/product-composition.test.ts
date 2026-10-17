import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPlanningResources } from '../src/planning/resources.ts';
import { resolveReviewedPublicationRelations } from '../src/product-composition.ts';
import { assertProductMigrations } from '../src/product-readiness.ts';
import {
  canonicalExercises,
  contentHash,
  REVIEWED_CATALOG_REVISION,
} from '../src/catalog/reviewed-projection.ts';
import { migrate } from '../src/migrate.ts';
import { createAuth } from '../src/auth.ts';
import { HttpError } from '../src/errors.ts';
import { productFixture, databaseUrl } from './support/product-fixture.ts';
import type { AssignableRoutine } from '@klisteniapp/b2b-contracts/product-v2';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/b2b-contracts/tests/fixtures/product-v2.json', import.meta.url),
    'utf8',
  ),
);
const content = (): AssignableRoutine => ({
  name: 'Composed reviewed routine',
  description: '',
  steps: [
    {
      id: 'squat-step',
      exerciseId: 'squat',
      dose: {
        ...fixture.dose,
        load: { mode: 'external', kilograms: { kind: 'fixed', value: 40 } },
      },
      substitutionPolicy: 'reviewed',
    },
  ],
});
const options = { skip: !databaseUrl };

test(
  'registered migration 007 populates fresh canonical review and repeats without rewriting stored rows',
  options,
  async () => {
    await productFixture(async ({ pool, auth, config, scoped }) => {
      const before = (await pool.query('SELECT * FROM b2b_reviewed_relation ORDER BY id')).rows;
      assert.equal(before.length, 42);
      assert.ok(before.every((row) => row.catalog_revision === REVIEWED_CATALOG_REVISION));
      const catalog = (await pool.query('SELECT id,data::text FROM b2b_exercise ORDER BY id')).rows;
      await migrate(pool, auth);
      await migrate(pool, createAuth(pool, config, { migrating: true }));
      assert.deepEqual(
        (await pool.query('SELECT * FROM b2b_reviewed_relation ORDER BY id')).rows,
        before,
      );
      assert.deepEqual(
        (await pool.query('SELECT id,data::text FROM b2b_exercise ORDER BY id')).rows,
        catalog,
      );
      assert.equal((await pool.query('SELECT id FROM b2b_migration')).rowCount, 10);
      await scoped('coach', 'atlas-principal', false, (context) =>
        assertProductMigrations(context.db),
      );
    });
  },
);

test(
  'installed 006 state enriches unchanged rows only and preserves unrelated historical snapshot bytes',
  options,
  async () => {
    await productFixture(async ({ pool, auth }) => {
      // Reconstruct the exact pre-007 data state in this disposable schema; 007 has no DDL.
      await pool.query(
        "DELETE FROM b2b_reviewed_relation; DELETE FROM b2b_migration WHERE id='007-reviewed-catalog-v1'",
      );
      await pool.query(
        "UPDATE b2b_exercise SET data=jsonb_set(data,'{name}','\"Locally edited squat\"') WHERE id='squat'",
      );
      await pool.query(
        "INSERT INTO b2b_program(id,organization_id,data,published_version) VALUES('old','atlas','{}',1)",
      );
      await pool.query(
        "INSERT INTO b2b_program_version(organization_id,program_id,version,snapshot) VALUES('atlas','old',1,$1)",
        [fixture.legacyRoutine],
      );
      const before = (await pool.query('SELECT snapshot::text FROM b2b_program_version')).rows;
      const catalogBefore = (await pool.query('SELECT id,data::text FROM b2b_exercise ORDER BY id'))
        .rows;
      await migrate(pool, auth);
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM b2b_reviewed_relation WHERE source_exercise_id='squat' OR target_exercise_id='squat'",
          )
        ).rowCount,
        0,
      );
      assert.ok((await pool.query('SELECT 1 FROM b2b_reviewed_relation')).rowCount! > 0);
      await migrate(pool, auth);
      assert.deepEqual(
        (await pool.query('SELECT snapshot::text FROM b2b_program_version')).rows,
        before,
      );
      assert.deepEqual(
        (await pool.query('SELECT id,data::text FROM b2b_exercise ORDER BY id')).rows,
        catalogBefore,
      );
    });
  },
);

test(
  'planning publication freezes actual reviewed targets and own doses with current branch exclusions',
  options,
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      const resources = createPlanningResources(resolveReviewedPublicationRelations);
      const input = content(),
        original = contentHash(input);
      const published = await scoped('coach', 'atlas-principal', false, (context) =>
        resources.publicationResources(context, input),
      );
      assert.equal(published.relations.length, 3);
      assert.equal(published.exercises.length, 4);
      assert.ok(
        published.relations.every((relation) => relation.targetDose.load.mode === 'bodyweight'),
      );
      assert.equal(contentHash(input), original);
      for (const relation of published.relations)
        assert.deepEqual(
          published.exercises.find((exercise) => exercise.id === relation.targetExerciseId),
          relation.target,
        );
      const hidden = published.relations[0].targetExerciseId;
      await pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise',$1,false)",
        [hidden],
      );
      const next = await scoped('coach', 'atlas-principal', false, (context) =>
        resources.publicationResources(context, input),
      );
      assert.equal(next.relations.length, 2);
      assert.ok(!next.relations.some((relation) => relation.targetExerciseId === hidden));
      assert.equal(published.relations.length, 3);
      input.steps[0].substitutionPolicy = 'blocked';
      const blocked = await scoped('coach', 'atlas-principal', false, (context) =>
        resources.publicationResources(context, input),
      );
      assert.deepEqual(blocked.relations, []);
      const canonical = canonicalExercises().find((exercise) => exercise.id === 'squat')!;
      const local = { ...canonical, id: 'local-squat', scope: 'organization' as const };
      const adapted = content();
      adapted.steps[0].exerciseId = local.id;
      assert.deepEqual(
        await scoped('coach', 'atlas-principal', false, (context) =>
          resolveReviewedPublicationRelations(context, adapted, [local]),
        ),
        [],
      );
    });
  },
);

test(
  'product authorization and publication fail closed when catalog migration receipt is missing',
  options,
  async () => {
    await productFixture(async ({ pool, scoped }) => {
      await pool.query("DELETE FROM b2b_migration WHERE id='007-reviewed-catalog-v1'");
      await assert.rejects(
        scoped('coach', 'atlas-principal', false, async () => 'must not execute'),
        (error: unknown) => error instanceof HttpError && error.code === 'PRODUCT_NOT_ACTIVE',
      );
    });
  },
);
