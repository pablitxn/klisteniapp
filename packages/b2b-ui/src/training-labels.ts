import type { Execution, ProgramStep } from '@klisteniapp/b2b-contracts'

function doseLabel(
  reps: number | null,
  durationSeconds: number | null,
  loadKg: number | null,
  rpe: number | null,
) {
  return [
    durationSeconds !== null ? `${durationSeconds} s` : `${reps ?? 0} reps`,
    loadKg !== null ? `${loadKg} kg` : '',
    rpe !== null ? `RPE ${rpe}/10` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function prescriptionDoseLabel(
  step: Pick<ProgramStep, 'reps' | 'durationSeconds' | 'loadKg' | 'targetRpe'>,
) {
  return doseLabel(step.reps, step.durationSeconds ?? null, step.loadKg, step.targetRpe ?? null)
}

export function executionDoseLabel(
  set: Pick<Execution['sets'][number], 'reps' | 'durationSeconds' | 'loadKg' | 'rpe'>,
) {
  return doseLabel(set.reps, set.durationSeconds ?? null, set.loadKg, set.rpe ?? null)
}

export function prescriptionStepLabel(step: ProgramStep) {
  return `${step.sets} × ${prescriptionDoseLabel(step)} · ${step.restSeconds} s descanso`
}
