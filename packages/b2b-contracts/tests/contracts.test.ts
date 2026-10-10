import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AssetSchema, ExecutionInputSchema, ExerciseInputSchema, MachineInputSchema, MachineSchema, ProgramInputSchema, ProgramVersionSchema, B2BResponseSchemas } from '../src/index.ts';
test('untrusted catalog media cannot supply script or protocol-relative URLs', () => {
  for (const url of ['javascript:alert(1)', '//foreign.example.test/model.glb', 'data:text/html,bad']) assert.equal(AssetSchema.safeParse({ id: 'x', kind: 'image', label: 'test', url }).success, false);
  assert.equal(AssetSchema.safeParse({ id: 'x', kind: 'model3d', label: 'test', url: '/models/example.glb' }).success, true);
});
test('program steps and executed sets cannot duplicate their identifiers', () => {
  const step = { id: 'step', exerciseId: 'dynamic-exercise', sets: 2, reps: 10 };
  assert.equal(ProgramInputSchema.safeParse({ name: 'Test', steps: [step, step] }).success, false);
  const set = { stepId: 'step', set: 1, exerciseId: 'dynamic-exercise', reps: 10 };
  assert.equal(ExecutionInputSchema.safeParse({ id: 'log', assignmentId: 'assignment', status: 'partial', completedAt: new Date().toISOString(), sets: [set, set] }).success, false);
});

test('immutable machine snapshots from before catalog migrations remain readable without weakening current responses', () => {
  const exercise = { ...ExerciseInputSchema.parse({ name: 'Remo', instructions: ['Prepará la posición.'], machineId: 'machine-1' }), id: 'exercise-1', scope: 'organization', status: 'published', version: 1, revision: 0 };
  const machine = { ...MachineInputSchema.parse({ name: 'Polea', type: 'cable' }), id: 'machine-1', scope: 'organization', version: 1, revision: 3, status: 'published' };
  const legacyMachine = Object.fromEntries(Object.entries(machine).filter(([key]) => !['derivedFromId', 'derivedFromVersion', 'revision', 'status'].includes(key)));
  const snapshot = { ...ProgramInputSchema.parse({ name: 'Rutina histórica', steps: [{ id: 'step-1', exerciseId: exercise.id, sets: 2, reps: 10 }] }), programId: 'program-1', version: 1, publishedAt: '2026-10-10T10:00:00.000Z', exercises: [exercise], machines: [legacyMachine] };
  const before = JSON.stringify(snapshot);
  const decoded = ProgramVersionSchema.parse(snapshot);
  assert.equal(decoded.machines[0].status, 'published');
  assert.equal(decoded.machines[0].revision, 0);
  assert.equal(decoded.machines[0].derivedFromId, null);
  assert.equal(decoded.machines[0].derivedFromVersion, null);
  assert.equal(JSON.stringify(snapshot), before, 'decoding does not mutate stored history');
  assert.equal(MachineSchema.safeParse(legacyMachine).success, false);
  assert.equal(B2BResponseSchemas.machines.safeParse({ machines: [legacyMachine] }).success, false);
  assert.equal(ProgramVersionSchema.safeParse({ ...snapshot, machines: [machine] }).success, true);
  for (const malformed of [{ status: 'unknown' }, { status: null }, { revision: '0' }, { derivedFromId: 123 }, { derivedFromVersion: 0 }]) {
    assert.equal(ProgramVersionSchema.safeParse({ ...snapshot, machines: [{ ...legacyMachine, ...malformed }] }).success, false);
  }
  const missingExerciseRevision = Object.fromEntries(Object.entries(exercise).filter(([key]) => key !== 'revision'));
  assert.equal(ProgramVersionSchema.safeParse({ ...snapshot, exercises: [missingExerciseRevision] }).success, false, 'exercise metadata existed in the initial schema and stays required');
});
