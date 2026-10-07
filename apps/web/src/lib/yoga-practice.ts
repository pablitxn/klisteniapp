import type { YogaCompletedStep, YogaPractice, YogaPracticeStep } from '@klisteniapp/scene-schema'
import { getAsana, type Asana } from '../data/yoga.ts'

export function yogaDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function yogaSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim()
}

export function yogaStepsForAsana(asana: Asana): YogaPracticeStep[] {
  const sides: YogaPracticeStep['side'][] = asana.bilateral ? ['both'] : ['left', 'right']
  return sides.map(side => ({ id: crypto.randomUUID(), asanaId: asana.id, durationSeconds: asana.defaultHoldSeconds, side }))
}

// Each side has its own timer and immutable completion entry, including imported
// and starter practices that express a unilateral posture as "both".
export function expandYogaSides(practice: YogaPractice): YogaPractice {
  return {
    ...structuredClone(practice),
    steps: practice.steps.flatMap(step => !getAsana(step.asanaId)?.bilateral && step.side === 'both'
      ? [{ ...step, side: 'left' as const }, { ...step, id: crypto.randomUUID(), side: 'right' as const }]
      : [{ ...step }]),
  }
}

export function yogaPracticeSeconds(practice: YogaPractice) {
  return practice.steps.reduce((sum, step) => sum + step.durationSeconds * (!getAsana(step.asanaId)?.bilateral && step.side === 'both' ? 2 : 1), 0)
}

export function yogaCompletedStep(step: YogaPracticeStep, remainingMs: number): YogaCompletedStep | null {
  const elapsed = Math.min(step.durationSeconds, Math.floor(Math.max(0, step.durationSeconds * 1000 - remainingMs) / 1000))
  return elapsed > 0 ? { stepId: step.id, asanaId: step.asanaId, durationSeconds: elapsed, side: step.side } : null
}
