import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { AnatomicalModelVariantSchema, ExerciseIdSchema } from '@klisteniapp/scene-schema'
import { exercisePreviewFiles, exercisePreviewUrls } from '../src/lib/exercise-preview-assets.ts'

test('all anatomical representations have complete, isolated preview paths in every format', () => {
  const paths = new Set<string>()
  for (const model of AnatomicalModelVariantSchema.options) {
    for (const id of ExerciseIdSchema.options) {
      const files = exercisePreviewFiles(id, model)
      const urls = exercisePreviewUrls(id, model)
      for (const format of ['poster', 'animation', 'gif'] as const) {
        assert.equal(urls[format], `/previews/${files[format]}`)
        assert.equal(paths.has(urls[format]), false, `duplicate preview: ${urls[format]}`)
        paths.add(urls[format])
        assert.equal(files[format].startsWith('female/'), model === 'female')
      }
    }
  }
  assert.equal(paths.size, ExerciseIdSchema.options.length * AnatomicalModelVariantSchema.options.length * 3)
})

test('legacy preview URLs remain masculine and optional GIFs use the same selected model', () => {
  assert.deepEqual(exercisePreviewUrls('squat'), {
    poster: '/previews/squat-poster.webp', animation: '/previews/squat.webp', gif: '/previews/squat.gif',
  })
  assert.deepEqual(exercisePreviewUrls('squat', 'female'), {
    poster: '/previews/female/squat-poster.webp', animation: '/previews/female/squat.webp', gif: '/previews/female/squat.gif',
  })
})
