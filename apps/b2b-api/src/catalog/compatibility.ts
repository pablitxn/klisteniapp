import type { Exercise, ProgramVersion, StepAvailability } from '@klisteniapp/b2b-contracts';

type MachineReferences = Pick<Exercise, 'machineId' | 'compatibleMachineIds'>;

/** A model describes compatibility; inventory and publication are separate rules. */
export function exerciseMachineIds(exercise: MachineReferences): string[] {
  return [
    ...new Set([
      ...(exercise.machineId ? [exercise.machineId] : []),
      ...exercise.compatibleMachineIds,
    ]),
  ];
}

export function supportsMachine(exercise: MachineReferences, machineId: string): boolean {
  return exerciseMachineIds(exercise).includes(machineId);
}

export function exerciseAvailability(
  exercise: Pick<Exercise, 'machineId' | 'compatibleMachineIds' | 'equipment'>,
  activeModels: ReadonlySet<string>,
): StepAvailability['exercises'][number]['status'] {
  const models = exerciseMachineIds(exercise);
  if (models.length) return models.some((id) => activeModels.has(id)) ? 'available' : 'unavailable';
  return exercise.equipment && exercise.equipment !== 'none' ? 'equipment-required' : 'available';
}

/** Use the assigned snapshot, even when the live catalogue changes. Active
 * inventory is deliberately current and does not depend on QR visibility. */
export function programAvailability(
  snapshot: Pick<ProgramVersion, 'steps' | 'exercises'>,
  activeModels: ReadonlySet<string>,
): StepAvailability[] {
  const exercises = new Map(snapshot.exercises.map((exercise) => [exercise.id, exercise]));
  return snapshot.steps.map((step) => ({
    stepId: step.id,
    exercises: [step.exerciseId, ...step.alternatives].map((exerciseId) => {
      const exercise = exercises.get(exerciseId);
      return {
        exerciseId,
        status: exercise ? exerciseAvailability(exercise, activeModels) : 'unavailable',
        equipment: exercise?.equipment ?? '',
      };
    }),
  }));
}
