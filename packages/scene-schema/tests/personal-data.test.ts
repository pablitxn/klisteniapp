import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CardioLogSchema,
  PersonalDataSchema,
  PersonalSettingsSchema,
  ServerStateSchema,
  TimeZoneSchema,
  TrainingPlanSchema,
  WorkoutLogSchema,
  computePlanProgress,
  createDefaultPersonalData,
  dateInTimeZone,
  isPlanHistoryPreserved,
  nextPlanEffectiveDate,
  planWeekStart,
  type TrainingPlan,
  type WorkoutLog,
} from '../src/index.ts';

function plan(effectiveFrom = '2026-09-21', weekdays = [1, 3, 5], id = 'plan-1'): TrainingPlan {
  return { id, effectiveFrom, weekdays, routineId: 'starter' };
}
function workout(date: string, id = date): WorkoutLog {
  return {
    id, date, completedAt: `${date}T18:00:00Z`,
    exercises: [{ exerciseId: 'pushup', sets: 2, reps: 6 }], durationMinutes: 12,
  };
}

const settings = createDefaultPersonalData('Ana', 'Europe/Sarajevo').settings;

test('new accounts have empty history and six no-equipment exercises without an invented plan', () => {
  const data = createDefaultPersonalData('  Ana  ', 'Europe/Sarajevo');
  assert.equal(data.settings.profile.displayName, 'Ana');
  assert.equal(data.settings.routines[0].exerciseIds.length, 6);
  assert.equal(data.settings.routines[0].exerciseIds.includes('row'), false);
  assert.deepEqual(data.settings.plans, []);
  assert.deepEqual(data.progress, { version: 1, workouts: [], cardio: [] });
  assert.equal(PersonalDataSchema.safeParse(data).success, true);
  assert.equal(ServerStateSchema.safeParse({ data, revision: 0 }).success, true);
  assert.equal(ServerStateSchema.safeParse({ data, revision: -1 }).success, false);
});

test('account settings reject unsupported zones, missing references and duplicate identifiers', () => {
  assert.equal(TimeZoneSchema.safeParse('Mars/Olympus').success, false);
  assert.equal(TimeZoneSchema.safeParse('+02:00').success, false);
  assert.equal(TimeZoneSchema.safeParse('UTC').success, true);
  assert.equal(PersonalSettingsSchema.safeParse({ ...settings, activeRoutineId: 'missing' }).success, false);
  assert.equal(PersonalSettingsSchema.safeParse({ ...settings, routines: [settings.routines[0], settings.routines[0]] }).success, false);
  assert.equal(PersonalSettingsSchema.safeParse({ ...settings, plans: [{ ...plan(), routineId: 'missing' }] }).success, false);
  assert.equal(PersonalSettingsSchema.safeParse({ ...settings, plans: [plan(), plan('2026-09-28')] }).success, false);
  assert.equal(PersonalSettingsSchema.safeParse({ ...settings, plans: [plan(), plan('2026-09-21', [2], 'other')] }).success, false);
});

test('week plans require valid Monday dates and unique weekdays', () => {
  assert.equal(TrainingPlanSchema.safeParse(plan('2026-09-22')).success, false);
  assert.equal(TrainingPlanSchema.safeParse(plan('2026-02-30')).success, false);
  assert.equal(TrainingPlanSchema.safeParse(plan('2026-09-21', [1, 1])).success, false);
  assert.equal(TrainingPlanSchema.safeParse(plan('2026-09-21', [])).success, false);
  assert.equal(TrainingPlanSchema.safeParse(plan('2026-09-21', [0])).success, false);
  assert.equal(TrainingPlanSchema.safeParse(plan('2026-09-21', [1, 7])).success, true);
});

test('new logs preserve the routine snapshot and tracking zone while accepting old v1 logs', () => {
  const old = workout('2026-10-04');
  assert.deepEqual(WorkoutLogSchema.parse(old), old);
  const withSnapshot = { ...old, timeZone: 'Europe/Sarajevo', routineSnapshot: settings.routines[0] };
  assert.deepEqual(WorkoutLogSchema.parse(withSnapshot), withSnapshot);
  assert.equal(WorkoutLogSchema.safeParse({ ...old, timeZone: 'wrong' }).success, false);
  assert.equal(CardioLogSchema.safeParse({ id: 'c', date: old.date, activity: 'walk', minutes: 20, timeZone: 'UTC' }).success, true);
});

test('tracking dates are independent of the device zone and stable across DST transitions', () => {
  const instant = new Date('2026-10-03T23:30:00Z');
  assert.equal(dateInTimeZone(instant, 'Europe/Sarajevo'), '2026-10-04');
  assert.equal(dateInTimeZone(instant, 'America/New_York'), '2026-10-03');
  assert.equal(dateInTimeZone(new Date('2026-03-29T00:30:00Z'), 'Europe/Sarajevo'), '2026-03-29');
  assert.equal(dateInTimeZone(new Date('2026-03-29T01:30:00Z'), 'Europe/Sarajevo'), '2026-03-29');
  assert.equal(dateInTimeZone(new Date('2026-10-25T00:30:00Z'), 'Europe/Sarajevo'), '2026-10-25');
  assert.equal(dateInTimeZone(new Date('2026-10-25T01:30:00Z'), 'Europe/Sarajevo'), '2026-10-25');
  assert.throws(() => dateInTimeZone(new Date('invalid'), 'UTC'));
});

test('calendar weeks cross DST, month and year boundaries without 24-hour arithmetic', () => {
  assert.equal(planWeekStart('2026-03-29'), '2026-03-23');
  assert.equal(planWeekStart('2026-10-25'), '2026-10-19');
  assert.equal(planWeekStart('2027-01-01'), '2026-12-28');
  assert.equal(nextPlanEffectiveDate([], '2026-12-31'), '2026-12-28');
  assert.equal(nextPlanEffectiveDate([plan()], '2026-12-31'), '2027-01-04');
});

test('later edits cannot erase or rewrite begun plan weeks or backdate a revision', () => {
  const prior = [plan()];
  assert.equal(isPlanHistoryPreserved([], [plan('2026-09-28')], '2026-09-30'), true);
  assert.equal(isPlanHistoryPreserved([], prior, '2026-09-30'), false);
  assert.equal(isPlanHistoryPreserved(prior, [], '2026-09-30'), false);
  assert.equal(isPlanHistoryPreserved(prior, [plan('2026-09-21', [1, 5])], '2026-09-30'), false);
  assert.equal(isPlanHistoryPreserved(prior, [...prior, plan('2026-09-28', [1], 'new')], '2026-09-30'), false);
  assert.equal(isPlanHistoryPreserved(prior, [...prior, plan('2026-10-05', [1], 'new')], '2026-09-30'), true);
  assert.equal(isPlanHistoryPreserved(prior, [plan('2026-09-21', [5, 3, 1])], '2026-09-30'), true);
});

test('a not-yet-effective plan can be corrected without rewriting history', () => {
  const old = plan();
  const future = plan('2026-10-05', [1, 3], 'future');
  assert.equal(isPlanHistoryPreserved([old, future], [old, { ...future, weekdays: [2, 4, 6] }], '2026-10-04'), true);
  assert.equal(isPlanHistoryPreserved([old, future], [old, { ...future, weekdays: [2, 4, 6] }], '2026-10-05'), false);
});

test('rest days and an unfinished current week preserve fulfilled prior weeks', () => {
  const logs = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28'].map((date) => workout(date));
  const progress = computePlanProgress([plan()], logs, '2026-09-29');
  assert.equal(progress.fulfilledWeeksStreak, 1);
  assert.equal(progress.weeklyCompleted, 1);
  assert.equal(progress.weeklyTarget, 3);
  assert.deepEqual(progress.scheduledDates, ['2026-09-28', '2026-09-30', '2026-10-02']);
  assert.equal(computePlanProgress([plan()], logs, '2026-10-05').fulfilledWeeksStreak, 0);
});

test('plan revisions only affect their effective week and future revisions do not change this week', () => {
  const logs = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-10-02'].map((date) => workout(date));
  const plans = [plan(), plan('2026-09-28', [1, 5], 'revision'), plan('2026-10-05', [1, 3, 5, 7], 'future')];
  assert.equal(computePlanProgress(plans, logs, '2026-09-27').weeklyTarget, 3);
  const current = computePlanProgress(plans, logs, '2026-10-04');
  assert.equal(current.weeklyTarget, 2);
  assert.equal(current.fulfilledWeeksStreak, 2);
  assert.equal(computePlanProgress(plans, logs, '2026-10-05').weeklyTarget, 4);
  assert.equal(computePlanProgress(plans, logs, '2026-10-05').fulfilledWeeksStreak, 2);
});

test('sessions may move within a week but duplicate IDs/days and future logs cannot inflate compliance', () => {
  const logs = [
    workout('2026-09-22', 'a'), workout('2026-09-22', 'b'), workout('2026-09-23', 'a'),
    workout('2026-09-24', 'c'), workout('2026-09-26', 'd'), workout('2026-09-27', 'future'),
  ];
  const result = computePlanProgress([plan()], logs, '2026-09-26');
  assert.equal(result.weeklyCompleted, 3);
  assert.equal(result.fulfilledWeeksStreak, 1);
  assert.deepEqual(result.completedDates, ['2026-09-22', '2026-09-24', '2026-09-26']);
  assert.equal(computePlanProgress([plan('2026-09-21', [1])], logs, '2026-09-26').weeklyCompleted, 1);
});

test('there is no invented goal or streak before the first plan', () => {
  const logs = [workout('2026-09-25')];
  for (const plans of [[], [plan('2026-09-28')]]) {
    const result = computePlanProgress(plans, logs, '2026-09-27');
    assert.equal(result.weeklyTarget, 0);
    assert.equal(result.weeklyCompleted, 0);
    assert.equal(result.fulfilledWeeksStreak, 0);
  }
});
