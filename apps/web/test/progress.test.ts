import assert from 'node:assert/strict';
import test from 'node:test';
import { CardioLogSchema, LocalDateSchema, WorkoutLogSchema, type WorkoutLog, type CardioLog, type YogaLog } from '@klisteniapp/scene-schema';
import { computeProgress, emptyProgress, localDateKey, parseProgress, serializeProgress, weekStartKey } from '../src/lib/progress.ts';
import { exercises, starterRoutine } from '../src/data/exercises.ts';

const workout = (date: string, id = date): WorkoutLog => ({
  id, date, completedAt: `${date}T16:00:00Z`,
  durationMinutes: 15, exercises: [{ exerciseId: 'squat', sets: 2, reps: 8 }],
});
const cardio = (date: string, id = `walk-${date}`): CardioLog => ({ id, date, activity: 'walk', minutes: 20 });
const yoga = (date: string, seconds = 90): YogaLog => ({
  id: `yoga-${date}`, date, completedAt: `${date}T16:00:00Z`, durationSeconds: seconds,
  practiceSnapshot: { id: 'practice', name: 'Una pausa', intention: '', steps: [{ id: 'rest', asanaId: 'savasana', durationSeconds: seconds, side: 'both' }] },
  completedSteps: [{ stepId: 'rest', asanaId: 'savasana', durationSeconds: seconds, side: 'both' }],
});

test('yoga contributes actual practice minutes and active days without filling strength goals', () => {
  const recorded = yoga('2026-10-07');
  const result = computeProgress([], [], new Date(2026, 9, 7), [yoga('2026-10-06'), recorded, recorded, yoga('2026-10-08', 600)]);
  assert.equal(result.streak, 2);
  assert.equal(result.weeklyActiveDays, 2);
  assert.equal(result.xp, 3);
  assert.equal(result.totalSets, 0);
  assert.equal(result.weeklyWorkouts, 0);
  assert.equal(result.weeklyCardioMinutes, 0);
});

test('first visit has no synthetic history, streak or XP', () => {
  const parsed = parseProgress(null);
  assert.equal(parsed.error, null);
  assert.deepEqual(parsed.data, emptyProgress());
  assert.deepEqual(computeProgress([], [], new Date(2026, 9, 3)), {
    streak: 0, weeklyWorkouts: 0, weeklyActiveDays: 0, weeklyCardioMinutes: 0,
    totalWorkouts: 0, totalSets: 0, xp: 0, level: 1, levelProgress: 0, activeDays: [],
  });
});

test('streak spans month boundary and counts an active day once', () => {
  const progress = computeProgress(
    [workout('2026-09-30'), workout('2026-10-01'), workout('2026-10-02')],
    [cardio('2026-10-01'), cardio('2026-10-03')], new Date(2026, 9, 3, 10),
  );
  assert.equal(progress.streak, 4);
  assert.equal(progress.weeklyActiveDays, 4);
  assert.equal(progress.xp, 100);
  assert.equal(progress.level, 2);
  assert.equal(progress.levelProgress, 0);
});

test('yesterday remains an active streak; missing yesterday breaks it', () => {
  assert.equal(computeProgress([workout('2026-10-01'), workout('2026-10-02')], [], new Date(2026, 9, 3, 23)).streak, 2);
  assert.equal(computeProgress([workout('2026-10-01')], [], new Date(2026, 9, 3)).streak, 0);
});

test('week resets on local Monday and excludes future logs from all rewards', () => {
  const now = new Date(2026, 9, 5, 9);
  assert.equal(weekStartKey(now), '2026-10-05');
  const progress = computeProgress([workout('2026-10-04'), workout('2026-10-06')], [cardio('2026-10-05'), cardio('2026-10-06')], now);
  assert.equal(progress.weeklyWorkouts, 0);
  assert.equal(progress.weeklyCardioMinutes, 20);
  assert.equal(progress.totalWorkouts, 1);
  assert.equal(progress.xp, 40);
});

test('duplicate record ids cannot multiply XP or sessions', () => {
  const entry = workout('2026-10-03');
  const progress = computeProgress([entry, entry], [], new Date(2026, 9, 3));
  assert.equal(progress.totalWorkouts, 1);
  assert.equal(progress.xp, 20);
  assert.notEqual(parseProgress(JSON.stringify({ version: 1, workouts: [entry, entry], cardio: [] })).error, null);
});

test('local dates preserve the user calendar date around midnight', () => {
  const localMidnight = new Date(2026, 9, 3, 0, 5);
  assert.equal(localDateKey(localMidnight), '2026-10-03');
  assert.equal(weekStartKey(new Date(2026, 9, 4, 23, 59)), '2026-09-28');
});

test('streak uses calendar arithmetic over daylight saving transitions', () => {
  const before = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
  try {
    const progress = computeProgress([workout('2026-10-24'), workout('2026-10-25'), workout('2026-10-26')], [], new Date(2026, 9, 26, 12));
    assert.equal(progress.streak, 3);
    assert.equal(progress.weeklyWorkouts, 1);
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('malformed JSON and old or invalid schemas return an explicit recoverable error', () => {
  for (const raw of ['{', '', 'null', '{"version":2,"workouts":[],"cardio":[]}', '{"version":1,"workouts":{},"cardio":[]}']) {
    const parsed = parseProgress(raw);
    assert.notEqual(parsed.error, null);
    assert.deepEqual(parsed.data, emptyProgress());
  }
});

test('schema rejects impossible dates and empty, negative or non-finite activity', () => {
  assert.equal(LocalDateSchema.safeParse('2026-02-30').success, false);
  assert.equal(LocalDateSchema.safeParse('2024-02-29').success, true);
  assert.equal(WorkoutLogSchema.safeParse({ ...workout('2026-10-03'), exercises: [] }).success, false);
  assert.equal(CardioLogSchema.safeParse({ ...cardio('2026-10-03'), minutes: -1 }).success, false);
  assert.equal(CardioLogSchema.safeParse({ ...cardio('2026-10-03'), distanceKm: Infinity }).success, false);
});

test('valid progress round-trips without rewriting dates or creating logs', () => {
  const data = { ...emptyProgress(), workouts: [workout('2026-10-03')], cardio: [cardio('2026-10-03')] };
  assert.deepEqual(parseProgress(serializeProgress(data)), { data, error: null });
});

test('starter routine remains equipment-free with the pulling gap explicit', () => {
  assert.equal(starterRoutine.exerciseIds.length, 6);
  assert.equal(starterRoutine.exerciseIds.includes('row'), false);
  assert.ok(starterRoutine.exerciseIds.every((id) => exercises.find((exercise) => exercise.id === id)?.equipment === 'none'));
  assert.match(exercises.find((exercise) => exercise.id === 'prone-w')!.note!, /No reemplaza/);
});
