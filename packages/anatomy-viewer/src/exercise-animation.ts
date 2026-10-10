import type { ExerciseId } from '@klisteniapp/scene-schema'
import { exercisePlanning } from '@klisteniapp/catalog-base/exercise-planning'

/** Alternation is catalog metadata, shared by the live captions and capture timing. */
export const isAlternatingExercise = (id: string) =>
  Object.hasOwn(exercisePlanning, id) && exercisePlanning[id as ExerciseId].laterality === 'alternating'

/** One complete cycle, including both sides for alternating movements. */
export const exerciseCycleSeconds = (id: string) => isAlternatingExercise(id) ? 10 : 6
