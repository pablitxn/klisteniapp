import assert from 'node:assert/strict';
import test from 'node:test';
import { CardioLogSchema, ProgressDataSchema, WorkoutLogSchema } from '../src/index.ts';

const validWorkout = {
  id: 'session-1',
  date: '2026-10-03',
  completedAt: '2026-10-03T18:00:00+02:00',
  exercises: [{ exerciseId: 'pushup', sets: 2, reps: 6 }],
  durationMinutes: 12,
};

test('a saved workout must contain actual completed exercise work', () => {
  for (const exercises of [[], [{ exerciseId: 'squat', sets: 0, reps: 10 }], [{ exerciseId: 'squat', sets: 2, reps: 0 }]]) {
    assert.equal(WorkoutLogSchema.safeParse({ ...validWorkout, exercises }).success, false);
  }
  assert.equal(WorkoutLogSchema.safeParse(validWorkout).success, true);
});

test('unknown exercise ids cannot enter the renderer through an import', () => {
  assert.equal(WorkoutLogSchema.safeParse({
    ...validWorkout, exercises: [{ exerciseId: 'unsupported-move', sets: 2, reps: 10 }],
  }).success, false);
});

test('duplicate ids are rejected across workout and cardio collections', () => {
  assert.equal(ProgressDataSchema.safeParse({
    version: 1, workouts: [validWorkout],
    cardio: [{ id: 'session-1', date: '2026-10-03', activity: 'walk', minutes: 20 }],
  }).success, false);
});

test('cardio accepts omitted distance and rejects invalid duration or distance', () => {
  const cardio = { id: 'walk-1', date: '2026-10-03', activity: 'walk', minutes: 15 };
  assert.deepEqual(CardioLogSchema.parse(cardio), cardio);
  assert.equal(CardioLogSchema.safeParse({ ...cardio, minutes: 1.5 }).success, false);
  assert.equal(CardioLogSchema.safeParse({ ...cardio, distanceKm: -3 }).success, false);
  assert.equal(CardioLogSchema.safeParse({ ...cardio, minutes: '15' }).success, false);
});

test('import rejects unsupported versions and invalid completion timestamps', () => {
  assert.equal(ProgressDataSchema.safeParse({ version: 2, workouts: [], cardio: [] }).success, false);
  assert.equal(WorkoutLogSchema.safeParse({ ...validWorkout, completedAt: 'yesterday' }).success, false);
});
