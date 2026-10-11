import assert from 'node:assert/strict'
import test from 'node:test'
import { bodyRegions } from '../src/data/body-guide.ts'
import { getAsana } from '../src/data/yoga.ts'
import { learningSearch, regionAsanas, relatedAsanas, searchLearningAsanas, searchMuscles } from '../src/lib/learning-library.ts'

test('encyclopedia search finds muscle function, accents and translated region names', () => {
  assert.equal(learningSearch('  CUÁDRICEPS  '), 'cuadriceps')
  assert.ok(searchMuscles('cuadriceps').includes('quadriceps'))
  assert.ok(searchMuscles('supinación').includes('biceps'))
  const translated = searchMuscles('lower body', value => value === 'Tren inferior' ? 'Lower body' : value)
  assert.deepEqual(translated, bodyRegions.find(region => region.id === 'lower')!.muscles)
  assert.equal(searchMuscles('no-existe-una-region').length, 0)
  assert.equal(searchMuscles('').length, 12)
})

test('yoga encyclopedia retains Sanskrit, English and common Spanish entry points', () => {
  assert.ok(searchLearningAsanas('Bālāsana').some(asana => asana.id === 'balasana'))
  assert.ok(searchLearningAsanas('tree pose').some(asana => asana.id === 'vrksasana'))
  assert.ok(searchLearningAsanas('mariposa').some(asana => asana.id === 'baddha-konasana'))
  assert.equal(searchLearningAsanas('no-existe-una-asana').length, 0)
})

test('contextual links resolve to canonical sourced entries without inferring a dose or fabricating content', () => {
  for (const ids of Object.values(regionAsanas)) {
    for (const id of ids) {
      const asana = getAsana(id)
      assert.ok(asana)
      assert.ok(asana.sources.length)
      assert.ok(asana.cautions.length)
      assert.equal(asana.level, 'Inicial')
    }
  }
  const mixed = relatedAsanas(['lats', 'abdominals', 'glutes'], 12)
  assert.equal(mixed.length, 6)
  assert.equal(new Set(mixed.map(asana => asana.id)).size, mixed.length)
  assert.ok(mixed.every(asana => asana === getAsana(asana.id)))
  assert.equal(relatedAsanas(['quadriceps', 'glutes'])[0]?.id, 'supta-padangusthasana')
  assert.deepEqual(relatedAsanas([]), [])
})
