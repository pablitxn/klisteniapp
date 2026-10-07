import assert from 'node:assert/strict';
import test from 'node:test';
import { YOGA_DATA_MAX_BYTES, YogaDataSchema, YogaLogSchema, YogaPracticeSchema, createDefaultPersonalData, preserveOptionalPersonalSettings, type YogaPractice, type YogaLog } from '../src/index.ts';

const practice: YogaPractice = {
  id: 'practice', name: 'Volver a la respiración', intention: 'Explorar sin forzar',
  steps: [
    { id: 'start', asanaId: 'tadasana', durationSeconds: 30, side: 'both' },
    { id: 'skip', asanaId: 'vrksasana', durationSeconds: 20, side: 'left' },
    { id: 'return', asanaId: 'tadasana', durationSeconds: 30, side: 'both' },
  ],
};
const log: YogaLog = {
  id: 'log', date: '2026-10-07', completedAt: '2026-10-07T10:00:00Z', timeZone: 'Europe/Tirane',
  practiceSnapshot: practice, durationSeconds: 40,
  completedSteps: [
    { stepId: 'start', asanaId: 'tadasana', durationSeconds: 30, side: 'both' },
    { stepId: 'return', asanaId: 'tadasana', durationSeconds: 10, side: 'both' },
  ],
};

test('a sequence allows repeated asanas with unique occurrence IDs', () => {
  assert.deepEqual(YogaPracticeSchema.parse(practice), practice);
  assert.equal(YogaPracticeSchema.safeParse({ ...practice, steps: [practice.steps[0], practice.steps[0]] }).success, false);
  assert.equal(YogaPracticeSchema.safeParse({ ...practice, steps: [{ ...practice.steps[0], asanaId: 'invented' }] }).success, false);
});

test('a partial log counts only completed time, with skipped steps absent and an independent snapshot', () => {
  const parsed = YogaLogSchema.parse(log);
  assert.equal(parsed.durationSeconds, 40);
  assert.equal(parsed.completedSteps.length, 2);
  const edited = structuredClone(practice);
  edited.name = 'Changed'; edited.steps.pop();
  assert.equal(parsed.practiceSnapshot.name, practice.name);
  assert.equal(parsed.practiceSnapshot.steps.length, 3);
  assert.equal(YogaLogSchema.safeParse({ ...log, durationSeconds: 80 }).success, false);
  assert.equal(YogaLogSchema.safeParse({ ...log, completedSteps: [] }).success, false);
});

test('logs reject unknown, duplicated, reordered, wrong-side and overlong steps', () => {
  for (const completedSteps of [
    [{ ...log.completedSteps[0], stepId: 'absent' }],
    [log.completedSteps[0], log.completedSteps[0]],
    [...log.completedSteps].reverse(),
    [{ ...log.completedSteps[0], side: 'left' }],
    [{ ...log.completedSteps[0], durationSeconds: 31 }],
  ]) assert.equal(YogaLogSchema.safeParse({ ...log, completedSteps }).success, false);
});

test('yoga rejects impossible dates, invalid zones, unbounded content and duplicate records', () => {
  for (const patch of [{ date: '2026-02-30' }, { timeZone: 'not/a/zone' }, { notes: 'a'.repeat(3001) }]) {
    assert.equal(YogaLogSchema.safeParse({ ...log, ...patch }).success, false);
  }
  assert.equal(YogaPracticeSchema.safeParse({ ...practice, name: ' ', intention: 'a'.repeat(1001) }).success, false);
  assert.equal(YogaDataSchema.safeParse({ practices: [practice, practice], logs: [] }).success, false);
  assert.equal(YogaDataSchema.safeParse({ practices: [], logs: [log, log] }).success, false);
});

test('legacy settings retain absence and cannot erase yoga, while explicit empty data can delete it', () => {
  const legacy = createDefaultPersonalData('Legacy', 'UTC').settings;
  assert.equal(legacy.yoga, undefined);
  const current = { ...legacy, yoga: { practices: [practice], logs: [log] } };
  assert.deepEqual(preserveOptionalPersonalSettings(current, legacy).yoga, current.yoga);
  assert.deepEqual(preserveOptionalPersonalSettings(current, { ...legacy, yoga: { practices: [], logs: [] } }).yoga, { practices: [], logs: [] });
});

test('the cumulative yoga limit counts UTF-8 bytes below the dedicated request body limit', () => {
  const value = { practices: [practice], logs: Array.from({ length: 1400 }, (_, index) => ({ ...log, id: `log-${index}`, notes: 'á'.repeat(1500) })) };
  assert.ok(new TextEncoder().encode(JSON.stringify(value)).byteLength > YOGA_DATA_MAX_BYTES);
  assert.equal(YogaDataSchema.safeParse(value).success, false);
});
