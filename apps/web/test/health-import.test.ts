import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyHealthData, type BodyMeasurement } from '@klisteniapp/scene-schema';
import {
  createHealthImportTemplate, HEALTH_IMPORT_MAX_BYTES, previewHealthImport,
} from '../src/lib/health-import.ts';

const now = new Date('2026-10-04T12:00:00Z');
const measurement = (overrides: Partial<BodyMeasurement> = {}): BodyMeasurement => ({
  id: 'weight-1', date: '2026-10-03', recordedAt: '2026-10-03T09:00:00+02:00',
  source: { kind: 'samsung-health', externalId: 'weight-source-1', device: 'Galaxy Watch 8' },
  weightKg: 81.5, ...overrides,
});
function file(records: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: 'klisteniapp.health', version: 1, exportedAt: now.toISOString(), timeZone: 'Europe/Sarajevo',
    records: { measurements: [], sleep: [], activity: [], nutrition: [], supplements: [], ...records }, ...overrides,
  });
}
function expectFailure(raw: string, pattern?: RegExp) {
  const result = previewHealthImport(raw, createEmptyHealthData(), now);
  assert.equal(result.ok, false);
  if (!result.ok && pattern) assert.match(result.error, pattern);
}

test('empty template downloads without fabricated personal data and requires real records', () => {
  const raw = createHealthImportTemplate(now, 'Europe/Sarajevo');
  const parsed = JSON.parse(raw);
  assert.ok(Object.values(parsed.records).every((records) => Array.isArray(records) && records.length === 0));
  expectFailure(raw, /vacía/);
});

test('preview preserves all categories, provenance and explicit units without mutating existing data', () => {
  const current = createEmptyHealthData();
  current.profile.context = 'Contexto privado';
  current.goals.push({ id: 'goal-1', title: 'Mi objetivo', metric: 'waistCm', target: 85, startDate: '2026-10-01' });
  const before = structuredClone(current);
  const base = measurement();
  const shared = { date: base.date, recordedAt: base.recordedAt, source: { kind: 'health-connect', externalId: 'source-1' } };
  const result = previewHealthImport(file({
    measurements: [base],
    sleep: [{ ...shared, id: 'sleep-1', durationMinutes: 420, deepMinutes: 70, remMinutes: 90, awakeMinutes: 60, startAt: '2026-10-02T23:00:00+02:00', endAt: '2026-10-03T07:00:00+02:00' }],
    activity: [{ ...shared, id: 'activity-1', steps: 0, activeEnergyKcal: 0 }],
    nutrition: [{ ...shared, id: 'nutrition-1', meal: 'Almuerzo', proteinG: 30, fatG: 0 }],
    supplements: [{ ...shared, id: 'supplement-1', name: 'Mi suplemento', taken: false }],
  }), current, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(current, before);
  assert.deepEqual(result.health.profile, current.profile);
  assert.deepEqual(result.health.goals, current.goals);
  assert.deepEqual(result.counts, { total: 5, added: 5, duplicates: 0 });
  assert.equal(result.health.measurements[0]?.timeZone, 'Europe/Sarajevo');
  assert.deepEqual(result.health.measurements[0]?.source, base.source);
  assert.equal(result.health.measurements[0]?.skeletalMuscleKg, undefined);
  assert.equal(result.health.nutrition[0]?.energyKcal, undefined);
  assert.equal(result.health.supplements[0]?.dose, undefined);
  assert.deepEqual(result.range, { from: '2026-10-03', to: '2026-10-03' });
});

test('reimport and duplicates within one file are idempotent even when local ID and timestamp offset differ', () => {
  const first = measurement();
  const copy = { ...first, id: 'another-local-id', recordedAt: '2026-10-03T07:00:00Z' };
  const result = previewHealthImport(file({ measurements: [first, copy] }), createEmptyHealthData(), now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.counts, { total: 2, added: 1, duplicates: 1 });
  const again = previewHealthImport(file({ measurements: [copy, first] }), result.health, now);
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.deepEqual(again.counts, { total: 2, added: 0, duplicates: 2 });
  assert.equal(again.health.measurements[0]?.id, 'weight-1');
});

test('changed source payload rejects the entire file and leaves current data untouched', () => {
  const initial = previewHealthImport(file({ measurements: [measurement()] }), createEmptyHealthData(), now);
  assert.equal(initial.ok, true);
  if (!initial.ok) return;
  const before = structuredClone(initial.health);
  const result = previewHealthImport(file({ measurements: [
    measurement({ id: 'new', source: { kind: 'manual', externalId: 'new' } }),
    measurement({ weightKg: 80 }),
  ] }), initial.health, now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /contenido diferente/);
  assert.deepEqual(initial.health, before);
});

test('two origins cannot reuse a local ID in a file or collide with a saved record', () => {
  const first = measurement();
  const collision = measurement({ source: { kind: 'health-connect', externalId: 'different-origin' } });
  expectFailure(file({ measurements: [first, collision] }), /identificador local/);
  const current = createEmptyHealthData();
  current.measurements.push({ ...first, timeZone: 'Europe/Sarajevo' });
  const result = previewHealthImport(file({ measurements: [collision] }), current, now);
  assert.equal(result.ok, false);
  assert.equal(current.measurements.length, 1);
  expectFailure(file({ measurements: [first], nutrition: [{ ...collision, weightKg: undefined, meal: 'Comida' }] }), /conflicto/);
});

test('the same external ID can exist in distinct sources without being collapsed', () => {
  const first = measurement();
  const other = measurement({ id: 'other', source: { kind: 'health-connect', externalId: first.source.externalId } });
  const result = previewHealthImport(file({ measurements: [first, other] }), createEmptyHealthData(), now);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.counts.added, 2);
});

test('unknown fields, wrong units, impossible dates and missing source identity are rejected', () => {
  expectFailure(file({ measurements: [{ ...measurement(), weightLb: 170 }] }), /Formato/);
  expectFailure(file({ measurements: [{ ...measurement(), source: { ...measurement().source, packageName: 'unhandled' } }] }), /Formato/);
  expectFailure(file({ measurements: [{ ...measurement(), weightKg: '81.5 kg' }] }), /Formato/);
  expectFailure(file({ measurements: [measurement({ date: '2026-02-30' })] }), /Formato/);
  expectFailure(file({ measurements: [measurement({ source: { kind: 'manual' } })] }), /externalId/);
  expectFailure(file({ measurements: [measurement()] }, { version: 2 }), /Formato/);
  expectFailure(file({ measurements: [measurement()] }, { profile: { name: 'unhandled' } }), /Formato/);
  expectFailure(file({ measurements: [measurement()] }, { timeZone: 'Not/AZone' }), /Formato/);
});

test('future export, observation and record timestamps reject the entire import', () => {
  expectFailure(file({ measurements: [measurement()] }, { exportedAt: '2026-10-05T00:00:00Z' }), /futuro/);
  expectFailure(file({ measurements: [measurement({ date: '2026-10-05' })] }), /futura/);
  expectFailure(file({ measurements: [measurement({ recordedAt: '2026-10-04T12:00:01Z' })] }), /futura/);
  expectFailure(file({ measurements: [measurement({ modifiedAt: '2026-10-04T12:00:01Z' })] }), /futura/);
  const base = { ...measurement(), weightKg: undefined };
  expectFailure(file({ sleep: [{ ...base, durationMinutes: 60, startAt: '2026-10-04T11:30:00Z', endAt: '2026-10-04T12:30:00Z' }] }), /futura/);
});

test('manual correction timestamps are preserved and normalized for comparison without overwriting corrections', () => {
  const corrected = measurement({ weightKg: 81, modifiedAt: '2026-10-04T12:00:00+02:00' });
  const initial = previewHealthImport(file({ measurements: [corrected] }), createEmptyHealthData(), now);
  assert.equal(initial.ok, true);
  if (!initial.ok) return;
  assert.equal(initial.health.measurements[0]?.modifiedAt, corrected.modifiedAt);
  const same = previewHealthImport(file({ measurements: [{ ...corrected, modifiedAt: '2026-10-04T10:00:00Z' }] }), initial.health, now);
  assert.equal(same.ok, true);
  if (same.ok) assert.deepEqual(same.counts, { total: 1, added: 0, duplicates: 1 });
  const stale = previewHealthImport(file({ measurements: [measurement()] }), initial.health, now);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.match(stale.error, /contenido diferente/);
  assert.equal(initial.health.measurements[0]?.weightKg, 81);
});

test('explicit record timezone wins over file timezone and is persisted', () => {
  const result = previewHealthImport(file({ measurements: [measurement({ date: '2026-10-05', timeZone: 'Pacific/Kiritimati' })] }), createEmptyHealthData(), now);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.health.measurements[0]?.timeZone, 'Pacific/Kiritimati');
  expectFailure(file({ measurements: [measurement({ date: '2026-10-05', timeZone: 'UTC' })] }), /futura/);
});

test('invalid sleep windows and stages do not become apparently valid summaries', () => {
  const base = { ...measurement(), weightKg: undefined };
  expectFailure(file({ sleep: [{ ...base, durationMinutes: 420, deepMinutes: 200, remMinutes: 300 }] }), /Formato/);
  expectFailure(file({ sleep: [{ ...base, durationMinutes: 480, awakeMinutes: 60, startAt: '2026-10-02T23:00:00Z', endAt: '2026-10-03T07:00:00Z' }] }), /Formato/);
});

test('raw Samsung/Health Connect exports are not accepted as normalized records', () => {
  expectFailure('PK\u0003\u0004health-connect-backup', /ZIP/);
  expectFailure('uuid,start_time,weight\n123,123,81', /CSV/);
  expectFailure(JSON.stringify({ 'com.samsung.health.weight': [measurement()] }), /Formato/);
});

test('UTF-8 byte bound and total-record bound fail before processing records', () => {
  expectFailure(' '.repeat(HEALTH_IMPORT_MAX_BYTES + 1), /2 MiB/);
  expectFailure('é'.repeat(HEALTH_IMPORT_MAX_BYTES / 2 + 1), /2 MiB/);
  const small = { id: 'a', date: '2026-10-01', recordedAt: '2026-10-01T00:00:00Z', source: { kind: 'manual', externalId: 'a' } };
  expectFailure(file({ measurements: Array(5001).fill({ ...small, weightKg: 80 }), activity: Array(5000).fill({ ...small, steps: 1 }) }), /10.000/);
});
