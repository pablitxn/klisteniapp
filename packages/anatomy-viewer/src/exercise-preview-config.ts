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
  'full-pushup': { position: [3.8, 2.0, 1.2], target: [0, 0.35, -0.15], height: 2.25, posterPhase: 0.15 },
  'pike-pushup': { position: [3.8, 1.8, 1.1], target: [0, 0.65, -0.1], height: 2.2, posterPhase: 0.5 },
  'reverse-lunge': { position: [3.2, 1.8, 3.6], target: [0, 0.8, -0.15], height: 2.25, posterPhase: 0.25 },
  'lateral-lunge': { position: [1.5, 1.7, 4.8], target: [0, 0.8, 0], height: 2.35, posterPhase: 0.25 },
  'good-morning': { position: [3.8, 1.6, 1.4], target: [0, 0.85, 0], height: 2.12, posterPhase: 0.5 },
  'bird-dog': { position: [3.6, 2.5, 1.4], target: [0, 0.45, -0.05], height: 2.65, posterPhase: 0.25 },
  'mountain-climber': { position: [3.8, 2.3, 1.4], target: [0, 0.4, -0.15], height: 2.3, posterPhase: 0.25 },
  crunch: { position: [3.8, 2.0, 0.8], target: [0, 0.25, -0.05], height: 2.05, posterPhase: 0.5 },
  'quarter-squat': { position: [3, 1.65, 3.6], target: [0, 0.88, 0], height: 2.12, posterPhase: 0.5 },
  'paused-squat': { position: [3, 1.65, 3.6], target: [0, 0.88, 0], height: 2.12, posterPhase: 0.5 },
  'knee-narrow-pushup': { position: [3.5, 2.0, 1.2], target: [0, 0.34, -0.3], height: 1.85, posterPhase: 0.15 },
  'narrow-pushup': { position: [3.8, 2.0, 1.2], target: [0, 0.35, -0.15], height: 2.25, posterPhase: 0.15 },
  'dead-bug-heel-tap': { position: [3.8, 2.6, 0.65], target: [0, 0.3, -0.05], height: 2.45, posterPhase: 0.25 },
  'quadruped-leg-extension': { position: [3.6, 2.5, 1.4], target: [0, 0.45, -0.05], height: 2.65, posterPhase: 0.25 },
  'prone-t-raise': { position: [3.1, 4.8, 1.3], target: [0, 0.2, -0.2], height: 2.8, posterPhase: 0.5 },
  'prone-y-raise': { position: [3.1, 4.8, 1.3], target: [0, 0.2, 0], height: 2.95, posterPhase: 0.5 },
  'split-squat': { position: [3.8, 1.8, 1.8], target: [0, 0.8, -0.15], height: 2.35, posterPhase: 0.5 },
  'single-leg-calf-raise': { position: [3.4, 1.6, -3], target: [0, 0.95, 0], height: 2.18, posterPhase: 0.5 },
  'bridge-march': { position: [3.8, 2.3, 0.65], target: [0, 0.3, -0.05], height: 2.4, posterPhase: 0.25 },
  'single-leg-glute-bridge': { position: [3.8, 2.3, 0.65], target: [0, 0.3, -0.05], height: 2.4, posterPhase: 0.5 },
  'bent-knee-row': { position: [3.8, 1.8, 0.8], target: [0, 0.5, -0.36], height: 2.3, posterPhase: 0.5 },
  'dead-bug-arm-only': { position: [3.8, 2.6, 0.65], target: [0, 0.3, -0.15], height: 2.55, posterPhase: 0.25 },
  'sumo-squat': { position: [2.8, 1.65, 3.8], target: [0, 0.85, 0], height: 2.18, posterPhase: 0.5 },
  'single-leg-deadlift': { position: [3.8, 1.9, 1.4], target: [0, 0.85, -0.1], height: 2.45, posterPhase: 0.5 },
  'forward-lunge': { position: [3.2, 1.8, 3.6], target: [0, 0.8, 0.2], height: 2.4, posterPhase: 0.25 },
  'quadruped-arm-raise': { position: [3.6, 2.5, 1.4], target: [0, 0.45, 0.05], height: 2.6, posterPhase: 0.25 },
  'prone-hip-extension': { position: [3.6, 2.4, 1.2], target: [0, 0.3, -0.15], height: 2.6, posterPhase: 0.5 },
  'supine-march': { position: [3.8, 2.6, 0.65], target: [0, 0.3, -0.05], height: 2.4, posterPhase: 0.25 },
  'supine-heel-slide': { position: [3.8, 2.6, 0.65], target: [0, 0.3, 0.05], height: 2.5, posterPhase: 0.25 },
  'plank-shoulder-tap': { position: [3.8, 2.3, 1.4], target: [0, 0.4, -0.15], height: 2.3, posterPhase: 0.25 },
}
