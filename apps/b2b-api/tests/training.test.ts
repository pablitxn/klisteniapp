import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
  BrandInputSchema,
  ExerciseInputSchema,
  ExecutionInputSchema,
  ProgramInputSchema,
  type Assignment,
  type Execution,
  type ExecutionInput,
  type Exercise,
  type Member,
  type ProgramVersion,
  type Role,
} from '@klisteniapp/b2b-contracts';
import { programAvailability } from '../src/catalog/compatibility.ts';
import { HttpError } from '../src/errors.ts';
import type { Context } from '../src/organization-context.ts';
import { TrainingModule } from '../src/training/index.ts';
import {
  programExerciseIds,
  requireAssignableEquipment,
  requireExecutionEquipment,
  trainingReport,
  validateAlternatives,
  validateExecution,
} from '../src/training/rules.ts';

const now = Date.parse('2026-10-10T12:00:00Z');

function exercise(id: string, input: Partial<Exercise> = {}): Exercise {
  return {
    ...ExerciseInputSchema.parse({ name: id, instructions: ['Contenido del ejercicio.'] }),
    id,
    scope: 'base',
    status: 'published',
    version: 1,
    revision: 0,
    ...input,
  };
}

function program(input: Partial<ProgramVersion> = {}): ProgramVersion {
  return {
    ...ProgramInputSchema.parse({
      name: 'Entrenamiento',
      steps: [
        { id: 'press-step', exerciseId: 'press', alternatives: ['pushup'], sets: 2, reps: 10 },
        { id: 'squat-step', exerciseId: 'squat', sets: 1, reps: 10 },
      ],
    }),
    programId: 'program',
    version: 1,
    publishedAt: new Date(now).toISOString(),
    exercises: [
      exercise('press', { machineId: 'press-machine' }),
      exercise('pushup'),
      exercise('squat'),
    ],
    machines: [],
    ...input,
  };
}

function execution(input: Partial<ExecutionInput> = {}): ExecutionInput {
  return ExecutionInputSchema.parse({
    id: 'execution',
    assignmentId: 'assignment',
    status: 'completed',
    completedAt: new Date(now).toISOString(),
    sets: [
      { stepId: 'press-step', exerciseId: 'press', set: 1, reps: 10 },
      { stepId: 'press-step', exerciseId: 'pushup', set: 2, reps: 8, reason: 'Equipo ocupado' },
      { stepId: 'squat-step', exerciseId: 'squat', set: 1, reps: 10 },
    ],
    ...input,
  });
}

function assignment(snapshot = program(), input: Partial<Assignment> = {}): Assignment {
  return {
    id: 'assignment',
    memberId: 'member',
    memberName: 'Socio',
    assignedBy: 'coach',
    createdAt: new Date(now).toISOString(),
    program: snapshot,
    availability: programAvailability(snapshot, new Set()),
    ...input,
  };
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof HttpError && error.code === code;
}

test('routine references are deduplicated across steps without allowing repeated alternatives within one step', () => {
  const snapshot = program();
  snapshot.steps[1].alternatives = ['press', 'pushup'];
  const original = structuredClone(snapshot);
  assert.deepEqual(programExerciseIds(snapshot), ['press', 'pushup', 'squat']);
  assert.doesNotThrow(() => validateAlternatives(snapshot));
  assert.deepEqual(snapshot, original);

  snapshot.steps[0].alternatives = ['pushup', 'pushup'];
  assert.throws(() => validateAlternatives(snapshot), hasCode('INVALID_ALTERNATIVE'));
  snapshot.steps[0].alternatives = ['press'];
  assert.throws(() => validateAlternatives(snapshot), hasCode('INVALID_ALTERNATIVE'));
});

test('execution validation accepts complete prescribed and substituted sets without mutating their snapshot', () => {
  const snapshot = program();
  const input = execution();
  const original = structuredClone({ snapshot, input });
  assert.doesNotThrow(() => validateExecution(snapshot, input, now));
  assert.deepEqual({ snapshot, input }, original);
});

test('execution clock tolerance accepts five minutes but rejects later completion timestamps', () => {
  assert.doesNotThrow(() =>
    validateExecution(
      program(),
      execution({ completedAt: new Date(now + 300_000).toISOString() }),
      now,
    ),
  );
  assert.throws(
    () =>
      validateExecution(
        program(),
        execution({ completedAt: new Date(now + 300_001).toISOString() }),
        now,
      ),
    hasCode('FUTURE_EXECUTION'),
  );
});

test('execution sets must belong to the assigned step and stay inside its prescribed series count', () => {
  const input = execution({ status: 'partial' });
  for (const changed of [{ stepId: 'other-step' }, { set: 3 }]) {
    const candidate = { ...input, sets: [{ ...input.sets[0], ...changed }] };
    assert.throws(() => validateExecution(program(), candidate, now), hasCode('INVALID_SET'));
  }
});

test('substitutions need both snapshot permission and a nonblank reason', () => {
  const input = execution({ status: 'partial' });
  for (const changed of [
    { exerciseId: 'squat', reason: 'No figura como alternativa en este paso' },
    { exerciseId: 'pushup', reason: '' },
    { exerciseId: 'pushup', reason: '   ' },
  ]) {
    const candidate = { ...input, sets: [{ ...input.sets[0], ...changed }] };
    assert.throws(
      () => validateExecution(program(), candidate, now),
      hasCode('INVALID_SUBSTITUTION'),
    );
  }
});

test('complete sessions require positive repetitions for every prescribed series in every step', () => {
  const input = execution();
  const incomplete = [
    { ...input, sets: input.sets.slice(0, 2) },
    { ...input, sets: input.sets.filter((set) => set.set !== 2) },
    {
      ...input,
      sets: input.sets.map((set) => (set.stepId === 'squat-step' ? { ...set, reps: 0 } : set)),
    },
  ];
  for (const candidate of incomplete) {
    assert.throws(
      () => validateExecution(program(), candidate, now),
      hasCode('INCOMPLETE_EXECUTION'),
    );
    assert.doesNotThrow(() =>
      validateExecution(program(), { ...candidate, status: 'partial' }, now),
    );
  }
});

test('assignments accept available alternatives and textual equipment requirements but reject entirely unavailable steps', () => {
  const snapshot = program();
  assert.doesNotThrow(() =>
    requireAssignableEquipment(snapshot, programAvailability(snapshot, new Set())),
  );

  snapshot.steps[0].alternatives = [];
  assert.throws(
    () => requireAssignableEquipment(snapshot, programAvailability(snapshot, new Set())),
    hasCode('EQUIPMENT_UNAVAILABLE'),
  );
  assert.doesNotThrow(() =>
    requireAssignableEquipment(snapshot, programAvailability(snapshot, new Set(['press-machine']))),
  );

  snapshot.exercises[0] = exercise('press', { equipment: 'dumbbells' });
  assert.doesNotThrow(() =>
    requireAssignableEquipment(snapshot, programAvailability(snapshot, new Set())),
  );
});

test('new executions check the equipment of the selected exercise, independently of permitted alternatives', () => {
  const prescribed = assignment();
  const input = execution({ status: 'partial' });
  assert.throws(
    () => requireExecutionEquipment(prescribed, input),
    hasCode('EQUIPMENT_UNAVAILABLE'),
  );

  const alternative = { ...input, sets: [input.sets[1]] };
  assert.doesNotThrow(() => requireExecutionEquipment(prescribed, alternative));
  const available = {
    ...prescribed,
    availability: programAvailability(prescribed.program, new Set(['press-machine'])),
  };
  assert.doesNotThrow(() => requireExecutionEquipment(available, input));
});

test('training reports aggregate only active member summaries while preserving authorized execution history and member order', () => {
  const members: Member[] = [
    {
      userId: 'empty',
      name: 'Sin actividad',
      role: 'member',
      active: true,
      email: 'empty@example.test',
      coachIds: [],
    },
    {
      userId: 'member',
      name: 'Socio',
      role: 'member',
      active: true,
      email: 'member@example.test',
      coachIds: [],
    },
    {
      userId: 'inactive',
      name: 'Inactivo',
      role: 'member',
      active: false,
      email: 'inactive@example.test',
      coachIds: [],
    },
    {
      userId: 'coach',
      name: 'Instructor',
      role: 'coach',
      active: true,
      email: 'coach@example.test',
      coachIds: [],
    },
  ];
  const log = (
    id: string,
    memberId: string,
    status: Execution['status'],
    completedAt: string,
  ): Execution => ({
    ...execution({ id, status, completedAt }),
    memberId,
    memberName: memberId,
    createdAt: completedAt,
    program: program(),
  });
  const executions = [
    log('latest', 'member', 'partial', '2026-10-10T12:00:00Z'),
    log('oldest', 'member', 'completed', '2026-10-09T12:00:00Z'),
    log('inactive', 'inactive', 'completed', '2026-10-10T12:00:00Z'),
  ];
  const assignments = [
    assignment(),
    assignment(program(), { id: 'second' }),
    assignment(program(), { memberId: 'inactive' }),
  ];
  const original = structuredClone({ members, assignments, executions });
  const report = trainingReport(members, assignments, executions);
  assert.deepEqual(report.members, [
    {
      userId: 'empty',
      name: 'Sin actividad',
      assignments: 0,
      completed: 0,
      partial: 0,
      lastActivityAt: null,
    },
    {
      userId: 'member',
      name: 'Socio',
      assignments: 2,
      completed: 1,
      partial: 1,
      lastActivityAt: '2026-10-10T12:00:00Z',
    },
  ]);
  assert.strictEqual(report.executions, executions);
  assert.deepEqual({ members, assignments, executions }, original);
});

test('training authorization rejects members and staff before touching forbidden dependencies', async () => {
  const untouched = (): never => {
    throw new Error('Unauthorized operation reached a dependency');
  };
  const module = new TrainingModule({
    catalog: { resolveExercises: untouched, resolvePublishedMachines: untouched },
    equipment: { activeModels: untouched },
    memberAccess: untouched,
    members: untouched,
  });
  const context = (role: Role): Context => ({
    db: { query: untouched } as unknown as PoolClient,
    actorId: 'actor',
    role,
    org: {
      id: 'gym',
      slug: 'gym',
      brand: BrandInputSchema.parse({ name: 'Gym' }),
      service_enabled: true,
      service_ends_at: null,
    },
  });
  const member = context('member');
  await assert.rejects(module.programs(member), hasCode('FORBIDDEN'));
  await assert.rejects(module.createProgram(member, program()), hasCode('FORBIDDEN'));
  await assert.rejects(module.updateProgram(member, 'program', program(), 0), hasCode('FORBIDDEN'));
  await assert.rejects(module.publishProgram(member, 'program', 0), hasCode('FORBIDDEN'));
  await assert.rejects(module.programVersion(member, 'program', 1), hasCode('FORBIDDEN'));
  await assert.rejects(
    module.assignProgram(member, { memberId: 'member', programId: 'program', version: 1 }),
    hasCode('FORBIDDEN'),
  );
  await assert.rejects(module.report(member), hasCode('FORBIDDEN'));
  for (const role of ['admin', 'coach'] as const) {
    await assert.rejects(module.recordExecution(context(role), execution()), hasCode('FORBIDDEN'));
  }
});
