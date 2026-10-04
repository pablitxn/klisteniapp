import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyHealthData, type BodyMeasurement, type WorkoutLog } from '@klisteniapp/scene-schema';
import { buildHealthDashboard, getBodyTrend } from '../src/lib/health-dashboard.ts';

const base = (id: string, date: string) => ({ id, date, recordedAt: `${date}T12:00:00Z`, source: { kind: 'manual' as const } });
const workout = (id: string, date: string): WorkoutLog => ({
  id, date, completedAt: `${date}T12:00:00Z`, durationMinutes: 20,
  exercises: [{ exerciseId: 'pushup', sets: 1, reps: 10 }],
});

test('empty dashboard preserves unknown values and contains no invented observations', () => {
  const result = buildHealthDashboard(createEmptyHealthData(), [], '2026-10-04', 30);
  assert.equal(result.from, '2026-09-05');
  assert.equal(result.to, '2026-10-04');
  assert.equal(result.dayCount, 30);
  assert.equal(result.sleep.averageMinutes, null);
  assert.equal(result.nutrition.energyKcal, null);
  assert.equal(result.nutrition.proteinG, null);
  assert.deepEqual(result.supplements, []);
  assert.deepEqual(result.bodySources, []);
  assert.ok(result.coverage.every((entry) => entry.count === 0 && entry.latestDate === null));
});

test('calendar window includes both boundaries across DST and counts distinct training dates only', () => {
  const result = buildHealthDashboard(createEmptyHealthData(), [
    workout('before', '2026-10-19'), workout('first', '2026-10-20'),
    workout('same-day-1', '2026-10-25'), workout('same-day-2', '2026-10-25'),
    workout('last', '2026-10-26'), workout('future', '2026-10-27'),
  ], '2026-10-26', 7);
  assert.equal(result.from, '2026-10-20');
  assert.deepEqual(result.training, { days: 3, dates: ['2026-10-20', '2026-10-25', '2026-10-26'] });
  assert.equal(buildHealthDashboard(createEmptyHealthData(), [], '2024-03-01', 7).from, '2024-02-24');
  assert.equal(buildHealthDashboard(createEmptyHealthData(), [], '2026-01-01', 90).from, '2025-10-04');
});

test('sleep excludes ambiguous cross-boundary overlaps before computing observed-day average', () => {
  const health = createEmptyHealthData();
  health.sleep = [
    { ...base('previous-date', '2026-09-27'), durationMinutes: 420, startAt: '2026-09-27T22:00:00Z', endAt: '2026-09-28T05:00:00Z' },
    { ...base('first-date', '2026-09-28'), durationMinutes: 420, startAt: '2026-09-27T22:00:00Z', endAt: '2026-09-28T05:00:00Z' },
    { ...base('valid', '2026-09-30'), durationMinutes: 480 },
    { ...base('valid-last', '2026-10-04'), durationMinutes: 420 },
    { ...base('future', '2026-10-05'), durationMinutes: 600 },
  ];
  const result = buildHealthDashboard(health, [], '2026-10-04', 7);
  assert.equal(result.sleep.validDays, 2);
  assert.equal(result.sleep.ambiguousDays, 1);
  assert.equal(result.sleep.averageMinutes, 450);
  assert.deepEqual(result.sleep.days, [
    { date: '2026-09-28', durationMinutes: null, recordCount: 1 },
    { date: '2026-09-30', durationMinutes: 480, recordCount: 1 },
    { date: '2026-10-04', durationMinutes: 420, recordCount: 1 },
  ]);
  assert.deepEqual(result.coverage.find(({ key }) => key === 'sleep'), { key: 'sleep', label: 'Sueño', count: 3, latestDate: '2026-10-04' });
});

test('nutrition keeps separate field denominators, accepts recorded zero, and does not fill missing days', () => {
  const health = createEmptyHealthData();
  health.nutrition = [
    { ...base('meal', '2026-09-28'), meal: 'Almuerzo' },
    { ...base('energy', '2026-09-28'), energyKcal: 500 },
    { ...base('protein', '2026-10-01'), proteinG: 35 },
    { ...base('zero', '2026-10-04'), energyKcal: 0, proteinG: 0 },
    { ...base('old', '2026-09-27'), energyKcal: 999, proteinG: 99 },
    { ...base('future', '2026-10-05'), energyKcal: 999, proteinG: 99 },
  ];
  assert.deepEqual(buildHealthDashboard(health, [], '2026-10-04', 7).nutrition, {
    recordCount: 4, days: 3, energyKcal: 500, energyRecords: 2, proteinG: 35, proteinRecords: 2,
  });
  health.nutrition = [{ ...base('zero-only', '2026-10-04'), energyKcal: 0 }];
  const result = buildHealthDashboard(health, [], '2026-10-04', 7);
  assert.equal(result.nutrition.energyKcal, 0);
  assert.equal(result.nutrition.proteinG, null);
});

test('supplement summary describes logged takes and skips, with distinct dates instead of an adherence target', () => {
  const health = createEmptyHealthData();
  health.supplements = [
    { ...base('one', '2026-10-01'), name: 'Creatina', taken: true, dose: 3, unit: 'g' },
    { ...base('two', '2026-10-01'), name: 'creatina', taken: true, dose: 2, unit: 'g' },
    { ...base('three', '2026-10-03'), name: 'CREATINA', taken: false },
    { ...base('old', '2026-09-27'), name: 'Creatina', taken: false },
    { ...base('future', '2026-10-05'), name: 'Creatina', taken: true },
  ];
  assert.deepEqual(buildHealthDashboard(health, [], '2026-10-04', 7).supplements, [
    { name: 'Creatina', taken: 2, skipped: 1, days: 2 },
  ]);
});

test('body trends keep sources and devices separate and respect chronological timestamp offsets', () => {
  const health = createEmptyHealthData();
  const source = { kind: 'samsung-health' as const, device: 'Galaxy Watch8' };
  health.measurements = [
    { ...base('day-two-early', '2026-10-03'), source, recordedAt: '2026-10-03T10:00:00+03:00', weightKg: 88 },
    { ...base('day-one', '2026-10-02'), source, weightKg: 80 },
    { ...base('day-two-later', '2026-10-03'), source, recordedAt: '2026-10-03T08:00:00Z', weightKg: 79 },
    { ...base('other-device', '2026-10-04'), source: { ...source, device: 'Balanza' }, weightKg: 100 },
    { ...base('other-provider', '2026-10-04'), source: { kind: 'health-connect', device: source.device }, weightKg: 120 },
    { ...base('other-metric', '2026-10-04'), source, waistCm: 95 },
    { ...base('old', '2026-09-27'), source, weightKg: 150 },
    { ...base('future', '2026-10-05'), source, weightKg: 130 },
  ];
  const before = structuredClone(health);
  const dashboard = buildHealthDashboard(health, [], '2026-10-04', 7);
  assert.equal(dashboard.bodySources.length, 3);
  assert.equal(dashboard.measurementCount, 6);
  const selectedSource = dashboard.bodySources.find(({ label }) => label === 'Samsung Health · Galaxy Watch8')!;
  const trend = getBodyTrend(health, 'weightKg', selectedSource.key, dashboard.from, dashboard.to);
  assert.deepEqual(trend, {
    points: [
      { date: '2026-10-02', value: 80, recordedAt: '2026-10-02T12:00:00Z' },
      { date: '2026-10-03', value: 79, recordedAt: '2026-10-03T08:00:00Z' },
    ], latest: 79, change: -1,
  });
  assert.deepEqual(health, before);
});

test('body series with one day has no change estimate and same-time ties resolve independently of input order', () => {
  const health = createEmptyHealthData();
  const first: BodyMeasurement = { ...base('a', '2026-10-04'), bodyFatPercent: 25 };
  const last: BodyMeasurement = { ...base('z', '2026-10-04'), recordedAt: '2026-10-04T14:00:00+02:00', bodyFatPercent: 24 };
  health.measurements = [last, first];
  const key = buildHealthDashboard(health, [], '2026-10-04', 7).bodySources[0]!.key;
  const trend = getBodyTrend(health, 'bodyFatPercent', key, '2026-09-28', '2026-10-04');
  assert.equal(trend.latest, 24);
  assert.equal(trend.change, null);
  assert.deepEqual(getBodyTrend(health, 'weightKg', key, '2026-09-28', '2026-10-04'), { points: [], latest: null, change: null });
  health.measurements.reverse();
  assert.deepEqual(getBodyTrend(health, 'bodyFatPercent', key, '2026-09-28', '2026-10-04'), trend);
});
