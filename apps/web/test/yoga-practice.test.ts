import assert from 'node:assert/strict'
import test from 'node:test'
import { YogaPracticeSchema, type YogaPractice } from '@klisteniapp/scene-schema'
import { asanas, getAsana } from '../src/data/yoga.ts'
import { expandYogaSides, yogaCompletedStep, yogaDuration, yogaPracticeSeconds, yogaSearch, yogaStepsForAsana } from '../src/lib/yoga-practice.ts'

const tree = getAsana('vrksasana')!
const mountain = getAsana('tadasana')!
function practice(): YogaPractice {
  return { id: 'practice-fixture', name: 'Una pausa', intention: 'Prestar atención', steps: [{ id: 'tree-both', asanaId: tree.id, side: 'both', durationSeconds: 35 }] }
}

test('adding a unilateral asana creates independently timed left and right steps', () => {
  const steps = yogaStepsForAsana(tree)
  assert.equal(steps.length, 2)
  assert.deepEqual(steps.map(step => step.side), ['left', 'right'])
  assert.equal(new Set(steps.map(step => step.id)).size, 2)
  assert.ok(steps.every(step => step.asanaId === tree.id && step.durationSeconds === tree.defaultHoldSeconds))
  assert.deepEqual(yogaStepsForAsana(mountain).map(step => step.side), ['both'])
})

test('imported both-side practice uses full per-side duration and gets an immutable execution snapshot', () => {
  const original = practice()
  const snapshot = expandYogaSides(original)
  assert.equal(yogaPracticeSeconds(original), 70)
  assert.equal(yogaPracticeSeconds(snapshot), 70)
  assert.equal(snapshot.steps[0]!.id, 'tree-both')
  assert.notEqual(snapshot.steps[0]!.id, snapshot.steps[1]!.id)
  assert.deepEqual(snapshot.steps.map(step => step.side), ['left', 'right'])
  assert.equal(original.steps.length, 1)
  assert.equal(original.steps[0]!.side, 'both')
  original.name = 'Editada después'
  original.steps[0]!.durationSeconds = 10
  assert.equal(snapshot.name, 'Una pausa')
  assert.equal(snapshot.steps[0]!.durationSeconds, 35)
  assert.equal(YogaPracticeSchema.safeParse(snapshot).success, true)
})

test('completion records only whole seconds actually practiced, capped to the planned duration', () => {
  const step = practice().steps[0]!
  assert.equal(yogaCompletedStep(step, 35000), null)
  assert.equal(yogaCompletedStep(step, 34500), null)
  assert.equal(yogaCompletedStep(step, 32401)?.durationSeconds, 2)
  assert.equal(yogaCompletedStep(step, 0)?.durationSeconds, 35)
  assert.equal(yogaCompletedStep(step, -1000)?.durationSeconds, 35)
  assert.equal(yogaCompletedStep(step, 36000), null)
  assert.deepEqual(yogaCompletedStep(step, 30000), { stepId: step.id, asanaId: step.asanaId, side: step.side, durationSeconds: 5 })
})

test('an imported practice that exceeds the expanded limits cannot start silently', () => {
  const original = practice()
  original.steps = Array.from({ length: 51 }, (_, index) => ({ ...original.steps[0]!, id: `step-${index}` }))
  assert.equal(YogaPracticeSchema.safeParse(original).success, true)
  assert.equal(YogaPracticeSchema.safeParse(expandYogaSides(original)).success, false)
})

test('search ignores accents and durations remain precise below and above a minute', () => {
  assert.equal(yogaSearch('  VṚKṢĀSANA  '), 'vrksasana')
  assert.equal(yogaSearch('Flexión'), yogaSearch('flexion'))
  assert.deepEqual([0, 5, 65, 3601].map(yogaDuration), ['0:00', '0:05', '1:05', '60:01'])
  assert.ok(asanas.every(asana => yogaStepsForAsana(asana).length === (asana.bilateral ? 1 : 2)))
})
