import type { ExerciseId } from '@klisteniapp/scene-schema'

type PreviewCamera = {
  position: [number, number, number]
  target: [number, number, number]
  height: number
  posterPhase: number
}

/** Fixed for the entire loop: never follow a limb or hide part of a repetition. */
export const previewCameras: Record<ExerciseId, PreviewCamera> = {
  squat: { position: [3, 1.65, 3.6], target: [0, 0.88, 0], height: 2.12, posterPhase: 0.5 },
  'calf-raise': { position: [3.4, 1.6, -3], target: [0, 0.95, 0], height: 2.18, posterPhase: 0.5 },
  pushup: { position: [3.5, 2.0, 1.2], target: [0, 0.34, -0.3], height: 1.85, posterPhase: 0.15 },
  'glute-bridge': { position: [3.8, 1.7, 0.65], target: [0, 0.3, -0.05], height: 1.95, posterPhase: 0.5 },
  'dead-bug': { position: [3.8, 2.6, 0.65], target: [0, 0.3, -0.05], height: 2.45, posterPhase: 0.25 },
  'prone-w': { position: [3.1, 4.8, 1.3], target: [0, 0.2, -0.2], height: 2.15, posterPhase: 0.5 },
  row: { position: [3.8, 1.8, 0.8], target: [0, 0.45, -0.1], height: 2.05, posterPhase: 0.5 },
}
