import { getExercise } from '@klisteniapp/catalog-base'
import { EXERCISE_PHASES } from '@klisteniapp/geometry'
import { previewCameras } from './exercise-preview-config.ts'
import type { ExerciseId } from '@klisteniapp/scene-schema'

export const movementLibraryManifest = {
  schemaVersion: 1,
  version: '1.0.0',
  modelResourceId: 'anatomical-atlas',
  motionSource: '@klisteniapp/geometry',
  provenancePath: 'models/anatomy-manifest.json',
  noticePath: 'models/NOTICE.md',
  equipment: [{ resourceId: 'low-row-bar', exerciseIds: ['row', 'bent-knee-row'] }],
} as const

/** A catalog entry alone never implies that an authored movement exists. */
export function getMovementDefinition(id: string) {
  if (!Object.hasOwn(previewCameras, id) || !Object.hasOwn(EXERCISE_PHASES, id)) return undefined
  const exercise = getExercise(id)
  if (!exercise) return undefined
  return { exercise, camera: previewCameras[id as ExerciseId], modelResourceId: movementLibraryManifest.modelResourceId }
}

/** The existing B2C anatomy inspector has an explicit neutral pose outside the exercise catalog. */
export function isSupportedAnatomyPose(id: string) {
  return id === 'anatomy' || getMovementDefinition(id) !== undefined
}
