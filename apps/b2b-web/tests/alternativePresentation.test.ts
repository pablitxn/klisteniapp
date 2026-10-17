import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReviewedRelation, RoutineVersionV2 } from '@klisteniapp/b2b-contracts/product-v2'
import {
  alternativePresentation,
  doseLabel,
  legacyAuthorizationLabel,
  conditionLabels,
  requirementLabel,
} from '../src/features/alternatives/alternativePresentation.ts'
const dose: RoutineVersionV2['steps'][number]['dose'] = {
  mode: 'repetitions',
  sets: { kind: 'fixed', value: 2 },
  repetitions: { kind: 'range', min: 6, max: 10 },
  durationSeconds: null,
  load: { mode: 'bodyweight' },
  restSeconds: { kind: 'fixed', value: 90 },
  laterality: 'alternating',
  targetRpe: null,
  notes: '',
}
const step: RoutineVersionV2['steps'][number] = {
  id: 'step',
  exerciseId: 'source',
  dose,
  substitutionPolicy: 'reviewed',
}
test('blocked and no-reviewed-option messages are distinct and scoped to the step', () => {
  assert.equal(alternativePresentation(step, []).kind, 'empty')
  assert.equal(
    alternativePresentation({ ...step, substitutionPolicy: 'blocked' }, []).kind,
    'blocked',
  )
  assert.notEqual(
    alternativePresentation(step, []).message,
    alternativePresentation({ ...step, substitutionPolicy: 'blocked' }, []).message,
  )
  const relation = { sourceExerciseId: 'source' } as ReviewedRelation
  assert.equal(alternativePresentation(step, [relation]).options.length, 1)
  assert.equal(
    alternativePresentation({ ...step, exerciseId: 'other' }, [relation]).options.length,
    0,
  )
})
test('target range/units/rest/per-side labels never imply equivalent load or count', () => {
  assert.match(
    doseLabel(dose),
    /2 series.*6–10 repeticiones por lado, alternando.*peso corporal.*90 s/,
  )
  assert.match(
    doseLabel({
      ...dose,
      mode: 'duration',
      repetitions: null,
      durationSeconds: { kind: 'fixed', value: 20 },
      laterality: 'bilateral',
      load: { mode: 'external', kilograms: { kind: 'range', min: 1, max: 2 } },
    }),
    /20 segundos.*1–2 kg/,
  )
  assert.equal(Object.keys(conditionLabels).length, 8)
})
test('manual legacy authorizations are labelled separately and empty legacy lists are not a block', () => {
  assert.equal(legacyAuthorizationLabel([]), null)
  assert.match(legacyAuthorizationLabel(['old'])!, /no acreditan/)
})

test('reviewed requirements use readable labels and preserve unknown future requirements honestly', () => {
  assert.equal(requirementLabel('position:high-plank'), 'Posición: plancha alta')
  assert.equal(requirementLabel('count:per-side'), 'Conteo: por cada lado')
  assert.equal(
    requirementLabel('source:https://example.test/review'),
    'Fuente: https://example.test/review',
  )
  assert.equal(requirementLabel('New reviewed requirement'), 'New reviewed requirement')
})
