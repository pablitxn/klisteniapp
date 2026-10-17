import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuthorizedProductContext } from '../src/product-context.ts';
import type { Context, OrgRow } from '../src/organization-context.ts';
import { TrainingModule } from '../src/training/index.ts';
import { TrainingRepository } from '../src/training/repository.ts';
import { databaseUrl, errorCode, fixture, legacy, type Fixture } from './wp02/fixture.ts';

async function seedTraining(f: Fixture) {
  await f.pool.query(
    "INSERT INTO b2b_branch_grant(organization_id,branch_id,user_id,role) VALUES('atlas','atlas-east','member','member'),('sur','sur-east','foreign','member')",
  );
  for (const [organizationId, branchId, memberId] of [
    ['atlas', 'atlas-principal', 'member'],
    ['atlas', 'atlas-east', 'member'],
    ['sur', 'sur-principal', 'foreign'],
    ['sur', 'sur-east', 'foreign'],
  ]) {
    const id = `routine-${branchId}`;
    await f.pool.query(
      'INSERT INTO b2b_program(id,organization_id,branch_id,data,published_version) VALUES($1,$2,$3,$4,1)',
      [
        id,
        organizationId,
        branchId,
        {
          name: legacy.legacyRoutine.name,
          description: legacy.legacyRoutine.description,
          steps: legacy.legacyRoutine.steps,
        },
      ],
    );
    await f.pool.query(
      'INSERT INTO b2b_program_version(organization_id,branch_id,program_id,version,snapshot) VALUES($1,$2,$3,1,$4)',
      [organizationId, branchId, id, { ...legacy.legacyRoutine, programId: id }],
    );
    await f.pool.query(
      'INSERT INTO b2b_program_assignment(id,organization_id,branch_id,member_id,program_id,version,assigned_by) VALUES($1,$2,$3,$4,$5,1,$6)',
      [`assignment-${branchId}`, organizationId, branchId, memberId, id, 'admin'],
    );
    await f.pool.query(
      'INSERT INTO b2b_execution(organization_id,branch_id,id,member_id,assignment_id,data) VALUES($1,$2,$3,$4,$5,$6)',
      [
        organizationId,
        branchId,
        `execution-${branchId}`,
        memberId,
        `assignment-${branchId}`,
        {
          ...legacy.legacyRetry,
          id: `execution-${branchId}`,
          assignmentId: `assignment-${branchId}`,
        },
      ],
    );
  }
}
async function legacyContext(context: AuthorizedProductContext): Promise<Context> {
  const org = (
    await context.db.query<OrgRow>('SELECT * FROM b2b_organization WHERE id=$1', [
      context.organizationId,
    ])
  ).rows[0]!;
  return {
    db: context.db,
    org,
    actorId: context.actorId,
    branchId: context.branchId,
    role: context.role === 'superadmin' ? 'admin' : context.role,
  };
}

test(
  'unassigned trainers read all training in their authorized branch across two tenants/four branches',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await seedTraining(f);
      assert.equal((await f.pool.query('SELECT * FROM b2b_coach_assignment')).rowCount, 0);
      for (const branchId of ['atlas-principal', 'atlas-east']) {
        await f.transaction(
          async (context) => {
            const repository = new TrainingRepository(await legacyContext(context));
            assert.deepEqual(
              (await repository.assignments()).map((row) => row.id),
              [`assignment-${branchId}`],
            );
            assert.deepEqual(
              (await repository.executions()).map((execution) => execution.id),
              [`execution-${branchId}`],
            );
            assert.deepEqual(await repository.assignments('foreign'), []);
            assert.deepEqual(await repository.executions('foreign'), []);
          },
          { branchId },
        );
      }
      await f.transaction(async (context) => {
        const current = await legacyContext(context);
        const branchless = new TrainingRepository({ ...current, branchId: undefined });
        assert.deepEqual(await branchless.assignments(), []);
        assert.deepEqual(await branchless.executions(), []);
        const foreignBranch = new TrainingRepository({ ...current, branchId: 'sur-principal' });
        assert.deepEqual(await foreignBranch.assignments(), []);
        assert.deepEqual(await foreignBranch.executions(), []);
      });
    });
  },
);

test(
  'legacy facade explicitly requests retained history and still requires active planning for assignment',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await seedTraining(f);
      await f.pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      await f.transaction(async (context) => {
        const purposes: string[] = [];
        const training = new TrainingModule({
          catalog: {
            async resolveExercises() {
              throw new Error('Inactive assignment must be denied before catalog lookup.');
            },
            async resolvePublishedMachines() {
              return [];
            },
          },
          equipment: {
            async activeModels() {
              return new Set();
            },
          },
          async memberAccess(_legacy, memberId, purpose = 'planning') {
            purposes.push(purpose);
            await context.authorizeMember(memberId, purpose);
          },
          async members() {
            return [];
          },
        });
        const scoped = await legacyContext(context);
        assert.deepEqual(
          (await training.assignments(scoped, 'member')).map((assignment) => assignment.id),
          ['assignment-atlas-principal'],
        );
        assert.deepEqual(
          (await training.executions(scoped, 'member')).map((execution) => execution.id),
          ['execution-atlas-principal'],
        );
        await assert.rejects(
          training.assignProgram(scoped, {
            memberId: 'member',
            programId: 'routine-atlas-principal',
            version: 1,
          }),
          errorCode('FORBIDDEN'),
        );
        assert.deepEqual(purposes, ['history', 'history', 'planning']);
      });
    });
  },
);

test(
  'member reads preserve self-only tenant scope while staff history flags cannot expose other members',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await seedTraining(f);
      await f.transaction(
        async (context) => {
          const scoped = await legacyContext(context);
          const repository = new TrainingRepository(scoped);
          assert.deepEqual(
            (await repository.executions()).map((execution) => execution.id),
            ['execution-atlas-principal'],
          );
          assert.deepEqual(await repository.executions('foreign'), []);
          const history = new TrainingRepository({ ...scoped, branchId: undefined, history: true });
          assert.deepEqual(
            new Set((await history.executions()).map((execution) => execution.id)),
            new Set(['execution-atlas-principal', 'execution-atlas-east']),
          );
          assert.deepEqual(await history.executions('foreign'), []);
        },
        { actorId: 'member' },
      );
      await f.transaction(async (context) => {
        const repository = new TrainingRepository({
          ...(await legacyContext(context)),
          history: true,
        });
        assert.deepEqual(await repository.executions('member'), []);
      });
    });
  },
);
