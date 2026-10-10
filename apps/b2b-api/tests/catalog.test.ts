import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import {
  BrandInputSchema, ExerciseInputSchema, MachineInputSchema, ProgramStepSchema, UnitInputSchema,
  type Exercise, type Role,
} from '@klisteniapp/b2b-contracts';
import { CatalogModule } from '../src/catalog/index.ts';
import { exerciseAvailability, exerciseMachineIds, programAvailability, supportsMachine } from '../src/catalog/compatibility.ts';
import { EquipmentModule } from '../src/equipment/index.ts';
import { HttpError } from '../src/errors.ts';
import type { Context } from '../src/organization-context.ts';

function exercise(id: string, input: Partial<Exercise> = {}): Exercise {
  return {
    ...ExerciseInputSchema.parse({ name: id, instructions: ['Contenido del ejercicio.'] }),
    id, scope: 'base', status: 'published', version: 1, revision: 0, ...input,
  };
}

test('model compatibility includes explicit alternatives, without inferring it from equipment labels', () => {
  const press = exercise('press', {
    machineId: 'press-a', compatibleMachineIds: ['press-a', 'press-b', 'press-b'], equipment: 'machine',
  });
  assert.deepEqual(exerciseMachineIds(press), ['press-a', 'press-b']);
  assert.equal(supportsMachine(press, 'press-a'), true);
  assert.equal(supportsMachine(press, 'press-b'), true);
  assert.equal(supportsMachine(press, 'machine'), false);
  assert.equal(supportsMachine(exercise('bodyweight'), 'press-a'), false);
  assert.deepEqual(press.compatibleMachineIds, ['press-a', 'press-b', 'press-b']);
});

test('availability distinguishes compatible inventory, textual requirements and bodyweight exercises', () => {
  const press = exercise('press', { machineId: 'press-a', compatibleMachineIds: ['press-b'], equipment: 'machine' });
  assert.equal(exerciseAvailability(press, new Set(['press-b'])), 'available');
  assert.equal(exerciseAvailability(press, new Set(['leg-press'])), 'unavailable');
  assert.equal(exerciseAvailability(press, new Set()), 'unavailable');
  assert.equal(exerciseAvailability(exercise('dumbbell', { equipment: 'dumbbell' }), new Set(['dumbbell'])), 'equipment-required');
  assert.equal(exerciseAvailability(exercise('bodyweight'), new Set()), 'available');
  assert.equal(exerciseAvailability(exercise('empty-requirement', { equipment: '' }), new Set()), 'available');
  assert.equal(exerciseAvailability(exercise('explicit-model', { machineId: 'press-a', equipment: 'none' }), new Set()), 'unavailable');
});

test('assigned snapshot availability follows current inventory while preserving each permitted alternative and historical content', () => {
  const snapshot = {
    steps: [ProgramStepSchema.parse({ id: 'step', exerciseId: 'press', sets: 3, reps: 10, alternatives: ['pushup', 'missing'] })],
    exercises: [exercise('press', { machineId: 'press-a', equipment: 'machine' }), exercise('pushup')],
  };
  const saved = structuredClone(snapshot);
  assert.deepEqual(programAvailability(snapshot, new Set()), [{
    stepId: 'step', exercises: [
      { exerciseId: 'press', status: 'unavailable', equipment: 'machine' },
      { exerciseId: 'pushup', status: 'available', equipment: 'none' },
      { exerciseId: 'missing', status: 'unavailable', equipment: '' },
    ],
  }]);
  assert.equal(programAvailability(snapshot, new Set(['press-a']))[0].exercises[0].status, 'available');
  assert.deepEqual(snapshot, saved);
});

test('extracted catalogue and equipment modules reject unauthorized writes before touching dependencies', async () => {
  const untouched = () => { assert.fail('Unauthorized operation reached a dependency'); };
  const catalog = new CatalogModule(async () => untouched());
  const equipment = new EquipmentModule({ validateMachine: async () => untouched() }, async () => untouched());
  const context = (role: Role): Context => ({
    db: { query: untouched } as unknown as PoolClient,
    actorId: 'actor', role,
    org: { id: 'gym', slug: 'gym', brand: BrandInputSchema.parse({ name: 'Gym' }), service_enabled: true, service_ends_at: null },
  });
  const machine = MachineInputSchema.parse({ name: 'Press', type: 'press' });
  const movement = ExerciseInputSchema.parse({ name: 'Press', instructions: ['Contenido.'] });
  const unit = UnitInputSchema.parse({ machineId: 'press', label: 'Press 1' });
  const forbidden = (error: unknown) => error instanceof HttpError && error.status === 403 && error.code === 'FORBIDDEN';
  for (const role of ['member', 'coach'] as const) {
    const c = context(role);
    await assert.rejects(catalog.createMachine(c, machine), forbidden);
    await assert.rejects(catalog.updateMachine(c, 'press', machine, 0), forbidden);
    await assert.rejects(catalog.transitionMachine(c, 'press', 0, false), forbidden);
    await assert.rejects(catalog.transitionMachine(c, 'press', 0, true), forbidden);
    await assert.rejects(equipment.createUnit(c, unit), forbidden);
    await assert.rejects(equipment.updateUnit(c, 'unit', unit, 0), forbidden);
    await assert.rejects(equipment.batchUnits(c, { id: 'batch', units: [unit] }), forbidden);
  }
  const member = context('member');
  await assert.rejects(catalog.createExercise(member, movement), forbidden);
  await assert.rejects(catalog.updateExercise(member, 'exercise', movement, 0), forbidden);
  await assert.rejects(catalog.reviewExercise(member, 'exercise', 0), forbidden);
  await assert.rejects(catalog.publishExercise(member, 'exercise', 0), forbidden);
});
