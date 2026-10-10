import type {
  Assignment,
  Execution,
  ExecutionInput,
  Member,
  Program,
  ProgramVersion,
  Report,
  StepAvailability,
} from '@klisteniapp/b2b-contracts';
import { HttpError } from '../errors.ts';

export type ProgramInput = Omit<Program, 'id' | 'publishedVersion' | 'revision'>;

export function programExerciseIds(program: ProgramInput): string[] {
  return [...new Set(program.steps.flatMap((step) => [step.exerciseId, ...step.alternatives]))];
}

export function validateAlternatives(program: ProgramInput): void {
  for (const step of program.steps) {
    const duplicates = new Set(step.alternatives).size !== step.alternatives.length;
    if (duplicates || step.alternatives.includes(step.exerciseId)) {
      throw new HttpError(
        400,
        'INVALID_ALTERNATIVE',
        'Las alternativas deben ser distintas del ejercicio principal y entre sí.',
      );
    }
  }
}

export function requireAssignableEquipment(
  program: ProgramVersion,
  availability: StepAvailability[],
): void {
  const unavailable = availability.find((step) =>
    step.exercises.every((exercise) => exercise.status === 'unavailable'),
  );
  if (!unavailable) return;

  const step = program.steps.find((candidate) => candidate.id === unavailable.stepId);
  const name =
    program.exercises.find((exercise) => exercise.id === step?.exerciseId)?.name ??
    unavailable.stepId;
  throw new HttpError(
    409,
    'EQUIPMENT_UNAVAILABLE',
    `No hay un equipo activo para “${name}” ni para sus alternativas permitidas. Revisá el inventario o publicá otra versión.`,
  );
}

/** Validate against the assigned version, never the current editable catalogue.
 * Shape validation (positive set numbers, unique sets, dates) belongs to the
 * input schema; these rules cover the relationship to that immutable version. */
export function validateExecution(
  program: ProgramVersion,
  input: ExecutionInput,
  now = Date.now(),
): void {
  if (new Date(input.completedAt).getTime() > now + 5 * 60_000) {
    throw new HttpError(400, 'FUTURE_EXECUTION', 'La actividad no puede estar en el futuro.');
  }

  const steps = new Map(program.steps.map((step) => [step.id, step]));
  const completedSets = new Map<string, Set<number>>();
  for (const set of input.sets) {
    const step = steps.get(set.stepId);
    if (!step || set.set > step.sets) {
      throw new HttpError(400, 'INVALID_SET', 'La serie no pertenece a la rutina asignada.');
    }
    const substituted = set.exerciseId !== step.exerciseId;
    if (substituted && (!step.alternatives.includes(set.exerciseId) || !set.reason.trim())) {
      throw new HttpError(
        400,
        'INVALID_SUBSTITUTION',
        'La sustitución debe estar permitida y explicar el motivo.',
      );
    }
    if (set.reps > 0) {
      const numbers = completedSets.get(step.id) ?? new Set<number>();
      numbers.add(set.set);
      completedSets.set(step.id, numbers);
    }
  }

  if (input.status !== 'completed') return;
  for (const step of program.steps) {
    const numbers = completedSets.get(step.id);
    for (let number = 1; number <= step.sets; number += 1) {
      if (!numbers?.has(number)) {
        throw new HttpError(
          400,
          'INCOMPLETE_EXECUTION',
          'Completá todas las series o guardá la sesión como parcial.',
        );
      }
    }
  }
}

/** Only new records require current inventory. Exact retries must remain valid
 * after a machine is archived, without changing their historical snapshot. */
export function requireExecutionEquipment(assignment: Assignment, input: ExecutionInput): void {
  const availability = new Map(
    assignment.availability.map((step) => [
      step.stepId,
      new Map(step.exercises.map((exercise) => [exercise.exerciseId, exercise.status])),
    ]),
  );
  const unavailable = input.sets.find(
    (set) => availability.get(set.stepId)?.get(set.exerciseId) === 'unavailable',
  );
  if (!unavailable) return;

  const name =
    assignment.program.exercises.find((exercise) => exercise.id === unavailable.exerciseId)?.name ??
    unavailable.exerciseId;
  throw new HttpError(
    409,
    'EQUIPMENT_UNAVAILABLE',
    `El equipo para “${name}” ya no está activo. Elegí una alternativa permitida o consultá a tu instructor.`,
  );
}

/** Inputs have already been filtered by authorization. Aggregate in one pass
 * per collection rather than rescanning the entire history for each member. */
export function trainingReport(
  members: Member[],
  assignments: Assignment[],
  executions: Execution[],
): Report {
  const summaries = new Map<string, Report['members'][number]>();
  for (const member of members) {
    if (member.role !== 'member' || !member.active) continue;
    summaries.set(member.userId, {
      userId: member.userId,
      name: member.name,
      assignments: 0,
      completed: 0,
      partial: 0,
      lastActivityAt: null,
    });
  }
  for (const assignment of assignments) {
    const summary = summaries.get(assignment.memberId);
    if (summary) summary.assignments += 1;
  }
  for (const execution of executions) {
    const summary = summaries.get(execution.memberId);
    if (!summary) continue;
    summary[execution.status] += 1;
    if (summary.lastActivityAt === null || execution.completedAt > summary.lastActivityAt) {
      summary.lastActivityAt = execution.completedAt;
    }
  }
  return { members: [...summaries.values()], executions };
}
