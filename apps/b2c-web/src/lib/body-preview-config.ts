import { MuscleIdSchema, type MuscleId } from '@klisteniapp/scene-schema'

export const bodyPreviewIds = MuscleIdSchema.options
export const posteriorMuscles: MuscleId[] = ['triceps', 'lats', 'upper-back', 'glutes', 'hamstrings', 'calves']

export interface BodyPreviewConfig {
  side: 'both' | 'left'
  view: 'front' | 'back' | 'anterolateral'
  direction: [number, number, number]
}

/** A representative side keeps long limb regions readable at thumbnail size. */
export const bodyPreviewCameras: Record<MuscleId, BodyPreviewConfig> = {
  pectorals: { side: 'both', view: 'front', direction: [0, 0.06, 1] },
  deltoids: { side: 'left', view: 'anterolateral', direction: [1, 0.1, 0.55] },
  triceps: { side: 'left', view: 'back', direction: [0.28, 0.08, -1] },
  lats: { side: 'both', view: 'back', direction: [0, 0.06, -1] },
  biceps: { side: 'left', view: 'front', direction: [0.18, 0.04, 1] },
  'upper-back': { side: 'both', view: 'back', direction: [0, 0.06, -1] },
  abdominals: { side: 'both', view: 'front', direction: [0, 0.03, 1] },
  obliques: { side: 'both', view: 'anterolateral', direction: [0.55, 0.04, 1] },
  glutes: { side: 'both', view: 'back', direction: [0.13, 0.07, -1] },
  quadriceps: { side: 'left', view: 'front', direction: [0.18, 0.02, 1] },
  hamstrings: { side: 'left', view: 'back', direction: [0.15, 0.02, -1] },
  calves: { side: 'left', view: 'back', direction: [0.16, 0.04, -1] },
}

export const bodyPreviewPadding = 1.14
