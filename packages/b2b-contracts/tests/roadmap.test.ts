import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WebsiteInputSchema } from '../src/website.ts'
import { ProgramInputSchema, ExecutionInputSchema, ProgramVersionSchema } from '../src/training.ts'

test('floor plans require bounded unique unit points and an image, and decode old websites', () => {
  assert.equal(WebsiteInputSchema.parse({ headline: 'Gym' }).floorPlan, null)
  const plan = {
    title: 'Sala',
    image: { id: 'img', kind: 'image', label: 'Croquis', url: '/models/plan.png' },
    points: [{ unitId: 'u1', x: 25, y: 80 }],
  }
  assert.equal(WebsiteInputSchema.safeParse({ floorPlan: plan }).success, true)
  for (const floorPlan of [
    { ...plan, points: [plan.points[0], plan.points[0]] },
    { ...plan, points: [{ unitId: 'u1', x: -1, y: 50 }] },
    { ...plan, points: [{ unitId: 'u1', x: 50, y: 101 }] },
    { ...plan, image: { ...plan.image, kind: 'video' } },
  ])
    assert.equal(WebsiteInputSchema.safeParse({ floorPlan }).success, false)
  assert.equal(WebsiteInputSchema.safeParse({ spatialModel: plan.image }).success, false)
})

test('prescriptions distinguish timed and repetition sets and keep historical snapshots readable', () => {
  const step = {
    id: 'hold',
    exerciseId: 'plank',
    sets: 2,
    reps: null,
    durationSeconds: 30,
    targetRpe: 6,
  }
  const timed = { name: 'Practice', steps: [step] }
  assert.equal(ProgramInputSchema.safeParse(timed).success, true)
  for (const patch of [
    { reps: 10 },
    { durationSeconds: null },
    { durationSeconds: 0 },
    { targetRpe: 11 },
  ]) {
    assert.equal(
      ProgramInputSchema.safeParse({ ...timed, steps: [{ ...step, ...patch }] }).success,
      false,
    )
  }
  const legacy = ProgramInputSchema.parse({
    name: 'Old',
    steps: [{ id: 's', exerciseId: 'squat', sets: 1, reps: 10 }],
  })
  const snapshot = {
    ...legacy,
    programId: 'p',
    version: 1,
    exercises: [],
    machines: [],
    publishedAt: '2026-10-11T00:00:00Z',
  }
  const historical = JSON.parse(JSON.stringify(snapshot))
  delete historical.steps[0].durationSeconds
  delete historical.steps[0].targetRpe
  const decoded = ProgramVersionSchema.parse(historical)
  assert.equal(decoded.steps[0].durationSeconds, null)
  assert.equal(decoded.steps[0].reps, 10)
  assert.equal(
    'durationSeconds' in historical.steps[0],
    false,
    'decoding never rewrites persisted snapshots',
  )
})

test('actual duration and RPE remain explicit observations and old retries normalize identically', () => {
  const legacy = {
    id: 'log',
    assignmentId: 'a',
    status: 'partial',
    completedAt: '2026-10-11T00:00:00Z',
    sets: [{ stepId: 's', exerciseId: 'squat', set: 1, reps: 8 }],
  }
  const parsed = ExecutionInputSchema.parse(legacy)
  assert.deepEqual(ExecutionInputSchema.parse(parsed), parsed)
  assert.equal(parsed.sets[0].rpe, null)
  assert.equal(
    ExecutionInputSchema.safeParse({
      ...legacy,
      sets: [{ ...legacy.sets[0], reps: null, durationSeconds: 25, rpe: 7 }],
    }).success,
    true,
  )
  for (const patch of [
    { durationSeconds: 25 },
    { reps: null },
    { rpe: 0 },
    { rpe: 11 },
    { reps: null, durationSeconds: -1 },
  ]) {
    assert.equal(
      ExecutionInputSchema.safeParse({ ...legacy, sets: [{ ...legacy.sets[0], ...patch }] })
        .success,
      false,
    )
  }
})
