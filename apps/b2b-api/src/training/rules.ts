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
import {
  checkExecution,
  checkProgramAlternatives,
  type ExecutionIssue,
} from '@klisteniapp/b2b-domain/training';
import { HttpError } from '../errors.ts';

export type ProgramInput = Omit<Program, 'id' | 'publishedVersion' | 'revision'>;

export function validateAlternatives(program: ProgramInput): void {
  const result = checkProgramAlternatives(program);
  if (!result.ok) {
    throw new HttpError(
      400,
      result.code,
      'Las alternativas deben ser distintas del ejercicio principal y entre sí.',
    );
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

const executionMessages: Record<ExecutionIssue, string> = {
  INVALID_MEASUREMENT:
    'Registrá la serie en la misma unidad de la prescripción: repeticiones o segundos.',
  INVALID_SET: 'La serie no pertenece a la rutina asignada.',
  INVALID_SUBSTITUTION: 'La sustitución debe estar permitida y explicar el motivo.',
  INCOMPLETE_EXECUTION: 'Completá todas las series o guardá la sesión como parcial.',
};

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

  const result = checkExecution(program, input);
  if (!result.ok) throw new HttpError(400, result.code, executionMessages[result.code]);
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
