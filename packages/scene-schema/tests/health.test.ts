import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ActivityRecordSchema, BodyMeasurementSchema, HealthDataSchema, HealthGoalSchema,
  PersonalDataSchema, SleepRecordSchema, SupplementRecordSchema,
  computeHealthGoalProgress, createDefaultPersonalData, createEmptyHealthData,
  healthHasFutureObservations, summarizeSleepDays, HEALTH_DATA_MAX_BYTES, type HealthGoal, type WorkoutLog,
} from '../src/index.ts';

const base = { id: 'm1', date: '2026-10-01', recordedAt: '2026-10-01T14:00:00+02:00', source: { kind: 'manual' as const } };
const measurement = { ...base, weightKg: 80, waistCm: 100 };
const goal: HealthGoal = { id: 'g1', title: 'Mi objetivo', metric: 'waistCm', target: 90, startDate: '2026-10-01' };

test('legacy account documents remain valid without silently inventing stored health', () => {
  const current = createDefaultPersonalData('Ana');
  assert.deepEqual(current.settings.health, createEmptyHealthData());
  const settings = structuredClone(current.settings);
  delete settings.health;
  const legacy = PersonalDataSchema.parse({ ...current, settings });
  assert.equal(legacy.settings.health, undefined);
  assert.deepEqual(legacy.progress, current.progress);
});

test('all observations require provenance, actual values and finite bounded units', () => {
  assert.equal(BodyMeasurementSchema.safeParse(measurement).success, true);
  for (const candidate of [base, { ...measurement, weightKg: NaN }, { ...measurement, waistCm: Infinity },
    { ...measurement, bodyFatPercent: 101 }, { ...measurement, weightKg: -1 },
    { ...measurement, skeletalMuscleKg: 90 }, { ...measurement, fatMassKg: 90 },
    { ...measurement, source: { kind: 'manual', guessed: true } },
    { ...measurement, weightLbs: 180 }, { ...measurement, date: '2026-02-30' },
    { ...measurement, recordedAt: '2026-10-01T14:00:00' }, { ...measurement, timeZone: 'Mars/Test' }]) {
    assert.equal(BodyMeasurementSchema.safeParse(candidate).success, false, JSON.stringify(candidate));
  }
  assert.equal(ActivityRecordSchema.safeParse({ ...base, steps: 0 }).success, true);
  assert.equal(ActivityRecordSchema.safeParse({ ...base, steps: 1.5 }).success, false);
  assert.equal(ActivityRecordSchema.safeParse({ ...base, averageHeartRateBpm: 160, maxHeartRateBpm: 100 }).success, false);
});

test('sleep intervals require offsets, paired timestamps and plausible consistent duration', () => {
  const sleep = { ...base, durationMinutes: 420, startAt: '2026-09-30T23:00:00+02:00', endAt: '2026-10-01T07:00:00+02:00', awakeMinutes: 60 };
  assert.equal(SleepRecordSchema.safeParse(sleep).success, true);
  for (const candidate of [
    { ...sleep, endAt: undefined }, { ...sleep, endAt: sleep.startAt },
    { ...sleep, durationMinutes: 600 }, { ...sleep, deepMinutes: 300, remMinutes: 200 },
    { ...sleep, awakeMinutes: 100 }, { ...sleep, endAt: '2026-10-01T07:00:00' },
  ]) assert.equal(SleepRecordSchema.safeParse(candidate).success, false);
  const acrossDst = { ...base, durationMinutes: 180, startAt: '2026-10-25T01:00:00+02:00', endAt: '2026-10-25T03:00:00+01:00' };
  assert.equal(SleepRecordSchema.safeParse(acrossDst).success, true);
});

test('supplement logs record user-selected doses with explicit units, not prescriptions', () => {
  assert.equal(SupplementRecordSchema.safeParse({ ...base, name: 'Creatina', taken: true }).success, true);
  assert.equal(SupplementRecordSchema.safeParse({ ...base, name: 'Creatina', taken: true, dose: 3, unit: 'g' }).success, true);
  assert.equal(SupplementRecordSchema.safeParse({ ...base, name: 'Creatina', taken: true, dose: 3 }).success, false);
});

test('duplicate IDs across categories and repeated provider identities are rejected', () => {
  const imported = { ...measurement, source: { kind: 'samsung-health', externalId: 'native-1' } };
  assert.equal(HealthDataSchema.safeParse({ version: 1, measurements: [measurement], sleep: [{ ...base, durationMinutes: 420 }] }).success, false);
  assert.equal(HealthDataSchema.safeParse({ version: 1, measurements: [imported, { ...imported, id: 'other-id' }] }).success, false);
  assert.equal(HealthDataSchema.safeParse({ version: 1, measurements: [imported, { ...imported, id: 'other-id', source: { kind: 'health-connect', externalId: 'native-1' } }] }).success, true);
});

test('future observations use server instant and recorded source timezone', () => {
  const now = new Date('2026-10-01T23:00:00Z');
  const health = createEmptyHealthData();
  health.measurements = [{ ...measurement, date: '2026-10-02', timeZone: 'Europe/Sarajevo' }];
  assert.equal(healthHasFutureObservations(health, '2026-10-01', now), false);
  health.measurements[0].timeZone = 'America/New_York';
  assert.equal(healthHasFutureObservations(health, '2026-10-01', now), true);
  health.measurements = [{ ...measurement, recordedAt: '2026-10-02T10:00:00Z' }];
  assert.equal(healthHasFutureObservations(health, '2026-10-01', now), true);
  health.measurements = [{ ...measurement, modifiedAt: '2026-10-02T10:00:00Z' }];
  assert.equal(healthHasFutureObservations(health, '2026-10-01', now), true);
  health.measurements = []; health.profile.birthDate = '2027-01-01';
  assert.equal(healthHasFutureObservations(health, '2026-10-01', now), true);
});

test('goal targets validate their metric and never infer a target from a profile', () => {
  assert.equal(HealthGoalSchema.safeParse(goal).success, true);
  for (const candidate of [{ ...goal, target: Infinity }, { ...goal, targetDate: '2026-09-01' },
    { ...goal, metric: 'weeklyTrainingDays', target: 8 }, { ...goal, metric: 'weeklyTrainingDays', target: 2.5 },
    { ...goal, metric: 'bodyFatPercent', target: -3 }]) assert.equal(HealthGoalSchema.safeParse(candidate).success, false);
  assert.deepEqual(createEmptyHealthData().goals, []);
});

test('metric progress sorts observation dates and excludes earlier baselines and future data', () => {
  const health = createEmptyHealthData();
  health.measurements = [
    { ...measurement, id: 'recent', date: '2026-10-03', waistCm: 95 },
    { ...measurement, id: 'future', date: '2026-10-05', waistCm: 90 },
    measurement,
    { ...measurement, id: 'before', date: '2026-09-30', waistCm: 130 },
  ];
  const result = computeHealthGoalProgress(goal, health, [], '2026-10-04');
  assert.deepEqual(result, { baseline: 100, current: 95, change: -5, percent: 50, achieved: false, observationDate: '2026-10-03' });
  assert.equal(computeHealthGoalProgress(goal, health, [], '2026-10-05').achieved, true);
  assert.equal(computeHealthGoalProgress({ ...goal, startDate: '2027-01-01' }, health, [], '2026-10-04').current, null);
});

test('sleep goals aggregate night and nap duration by observation date', () => {
  const health = createEmptyHealthData();
  health.sleep = [
    { ...base, id: 'night1', durationMinutes: 300 },
    { ...base, id: 'night2', date: '2026-10-02', durationMinutes: 360, startAt: '2026-10-02T00:00:00Z', endAt: '2026-10-02T06:00:00Z' },
    { ...base, id: 'nap2', date: '2026-10-02', durationMinutes: 60, startAt: '2026-10-02T15:00:00Z', endAt: '2026-10-02T16:00:00Z' },
  ];
  const result = computeHealthGoalProgress({ ...goal, metric: 'sleepMinutes', target: 420 }, health, [], '2026-10-04');
  assert.equal(result.baseline, 300); assert.equal(result.current, 420); assert.equal(result.achieved, true);
});

test('overlapping or untimed sleep sources cannot inflate daily summaries or earn a goal', () => {
  const health = createEmptyHealthData();
  const night = { ...base, date: '2026-10-02', durationMinutes: 420, startAt: '2026-10-01T23:00:00Z', endAt: '2026-10-02T06:00:00Z' };
  health.sleep = [
    { ...base, id: 'baseline', durationMinutes: 360 },
    { ...night, id: 'samsung', source: { kind: 'samsung-health' } },
    { ...night, id: 'hc', source: { kind: 'health-connect' } },
  ];
  assert.deepEqual(summarizeSleepDays(health.sleep), [
    { date: '2026-10-01', durationMinutes: 360, recordCount: 1 },
    { date: '2026-10-02', durationMinutes: null, recordCount: 2 },
  ]);
  const result = computeHealthGoalProgress({ ...goal, metric: 'sleepMinutes', target: 420 }, health, [], '2026-10-04');
  assert.equal(result.baseline, 360); assert.equal(result.current, null); assert.equal(result.achieved, false);
  assert.equal(result.observationDate, '2026-10-02');
  assert.equal(summarizeSleepDays([{ ...base, id: 'night', durationMinutes: 400 }, { ...base, id: 'nap', durationMinutes: 60 }])[0].durationMinutes, null);
  assert.deepEqual(summarizeSleepDays([{ ...night, id: 'zone1' }, { ...night, id: 'zone2', date: '2026-10-01' }]).map((entry) => entry.durationMinutes), [null, null]);
});

test('weekly training goals count distinct days of this calendar week only', () => {
  const workout = (date: string, id = date): WorkoutLog => ({ id, date, completedAt: `${date}T12:00:00Z`, exercises: [{ exerciseId: 'pushup', sets: 2, reps: 8 }], durationMinutes: 10 });
  const logs = [workout('2026-09-28'), workout('2026-10-01'), workout('2026-10-01', 'second'), workout('2026-10-02'), workout('2026-10-05')];
  const weekly = { ...goal, metric: 'weeklyTrainingDays' as const, target: 3 };
  assert.equal(computeHealthGoalProgress(weekly, createEmptyHealthData(), logs, '2026-10-04').current, 2);
  assert.equal(computeHealthGoalProgress(weekly, createEmptyHealthData(), logs, '2026-10-05').current, 1);
});


test('the cumulative health limit counts UTF-8 bytes and leaves room below the request limit', () => {
  const health = createEmptyHealthData();
  health.measurements = Array.from({ length: 1200 }, (_, index) => ({ ...measurement, id: `size-${index}`, notes: 'á'.repeat(1900) }));
  const serialized = JSON.stringify(health);
  assert.ok(serialized.length < HEALTH_DATA_MAX_BYTES);
  assert.ok(new TextEncoder().encode(serialized).byteLength > HEALTH_DATA_MAX_BYTES);
  const oversized = HealthDataSchema.safeParse(health);
  assert.equal(oversized.success, false);
  if (!oversized.success) assert.match(oversized.error.issues[0].message, /máximo acumulado de 4 MiB/);
  health.measurements = health.measurements.slice(0, 600);
  assert.equal(HealthDataSchema.safeParse(health).success, true);
  assert.ok(HEALTH_DATA_MAX_BYTES + 1024 < 5 * 1024 * 1024);
});
