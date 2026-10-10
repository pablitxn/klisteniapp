import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AssetSchema, ExecutionInputSchema, ProgramInputSchema } from '../src/index.ts';
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
