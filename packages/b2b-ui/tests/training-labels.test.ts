import assert from 'node:assert/strict'
import test from 'node:test'
import { prescriptionDoseLabel, executionDoseLabel } from '../src/training-labels.ts'

test('prescribed and recorded effort stay separate from repetitions and duration', () => {
  assert.equal(
    prescriptionDoseLabel({ reps: null, durationSeconds: 45, loadKg: null, targetRpe: 7 }),
    '45 s · RPE 7/10',
  )
  assert.equal(
    executionDoseLabel({ reps: null, durationSeconds: 38, loadKg: null, rpe: 8 }),
    '38 s · RPE 8/10',
  )
  assert.equal(
    prescriptionDoseLabel({ reps: 12, durationSeconds: null, loadKg: 22.5, targetRpe: null }),
    '12 reps · 22.5 kg',
  )
})

test('a real zero performance or zero load is retained in the actual record', () => {
  assert.equal(
    executionDoseLabel({ reps: null, durationSeconds: 0, loadKg: 0, rpe: null }),
    '0 s · 0 kg',
  )
  assert.equal(
    executionDoseLabel({ reps: 0, durationSeconds: null, loadKg: null, rpe: null }),
    '0 reps',
  )
})
