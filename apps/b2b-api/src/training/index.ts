import { programExerciseIds } from '@klisteniapp/b2b-domain/training';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type {
  Assignment,
  Execution,
  ExecutionInput,
  Exercise,
  Member,
  Program,
  ProgramVersion,
  Report,
  StepAvailability,
} from '@klisteniapp/b2b-contracts';
import type { CatalogModule } from '../catalog/index.ts';
import { exerciseMachineIds, programAvailability } from '@klisteniapp/b2b-domain/catalog';
import type { EquipmentModule } from '../equipment/index.ts';
import { conflict, denied, HttpError, missing } from '../errors.ts';
import { audit, staff, type Context } from '../organization-context.ts';
import { TrainingRepository } from './repository.ts';
import { ExecutionInputSchema } from '@klisteniapp/b2b-contracts';
import {
  requireAssignableEquipment,
  requireExecutionEquipment,
  trainingReport,
  validateAlternatives,
  validateExecution,
  type ProgramInput,
} from './rules.ts';

type TrainingDependencies = {
  catalog: Pick<CatalogModule, 'resolveExercises' | 'resolvePublishedMachines'>;
  equipment: Pick<EquipmentModule, 'activeModels'>;
  memberAccess: (context: Context, memberId: string) => Promise<void>;
  members: (context: Context) => Promise<Member[]>;
};

/** Routine authoring, immutable prescriptions and member training history.
 * Public methods run inside B2BService.organization's locked transaction. */
export class TrainingModule {
  private readonly dependencies: TrainingDependencies;

  constructor(dependencies: TrainingDependencies) {
    this.dependencies = dependencies;
  }

  async programs(context: Context): Promise<Program[]> {
    staff(context);
    return new TrainingRepository(context).programs();
  }

  async validateProgram(
    context: Context,
    input: ProgramInput,
    published: boolean,
  ): Promise<Exercise[]> {
    const exercises = await this.dependencies.catalog.resolveExercises(
      context,
      programExerciseIds(input),
      published,
    );
    validateAlternatives(input);
    return exercises;
  }

  async createProgram(context: Context, input: ProgramInput, requestId?: string): Promise<Program> {
    staff(context);
    const repository = new TrainingRepository(context);
    if (requestId) {
      const prior = await repository.program(requestId);
      if (prior) {
        const content = { name: prior.name, description: prior.description, steps: prior.steps };
        if (
          !isDeepStrictEqual(content, input) ||
          !(await repository.createdByActor('program.create', requestId))
        )
          throw new HttpError(
            409,
            'PROGRAM_CREATE_CONFLICT',
            'Ese envío ya creó una rutina con otros datos. Revisá la lista antes de volver a guardar.',
          );
        return prior;
      }
    }
    await this.validateProgram(context, input, false);
    const id = requestId ?? randomUUID();
    const program = await repository.createProgram(id, input);
    if (!program)
      throw new HttpError(409, 'PROGRAM_CREATE_CONFLICT', 'Ese envío ya pertenece a otra rutina.');
    await audit(context, 'program.create', id);
    return program;
  }

  async updateProgram(
    context: Context,
    id: string,
    input: ProgramInput,
    revision: number,
  ): Promise<Program> {
    staff(context);
    await this.validateProgram(context, input, false);
    const program = await new TrainingRepository(context).updateProgram(id, input, revision);
    if (!program) throw conflict();
    await audit(context, 'program.update', id);
    return program;
  }

  async publishProgram(context: Context, id: string, revision: number): Promise<ProgramVersion> {
    staff(context);
    const repository = new TrainingRepository(context);
    const program = await repository.program(id);
    if (!program) throw missing();
    if (program.revision !== revision) throw conflict();

    const exercises = await this.validateProgram(context, program, true);
    const machineIds = [...new Set(exercises.flatMap(exerciseMachineIds))];
    const machines = await this.dependencies.catalog.resolvePublishedMachines(context, machineIds);
    const snapshot: ProgramVersion = {
      name: program.name,
      description: program.description,
      steps: program.steps,
      programId: id,
      ...(program.branchId ? { branchId: program.branchId } : {}),
      version: (program.publishedVersion ?? 0) + 1,
      exercises,
      machines,
      publishedAt: new Date().toISOString(),
    };
    await repository.publishProgram(snapshot);
    await audit(context, 'program.publish', id);
    return snapshot;
  }

  async programVersion(context: Context, id: string, version: number): Promise<ProgramVersion> {
    staff(context);
    const snapshot = await new TrainingRepository(context).programVersion(id, version);
    if (!snapshot) throw missing();
    return snapshot;
  }

  availability(snapshot: ProgramVersion, activeModels: ReadonlySet<string>): StepAvailability[] {
    return programAvailability(snapshot, activeModels);
  }

  async assignments(context: Context, memberId?: string): Promise<Assignment[]> {
    if (memberId) await this.dependencies.memberAccess(context, memberId);
    const rows = await new TrainingRepository(context).assignments(memberId);
    const models = await this.dependencies.equipment.activeModels(context);
    return rows.map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      active: row.active,
      memberId: row.member_id,
      memberName: row.name,
      assignedBy: row.assigned_by,
      createdAt: row.created_at.toISOString(),
      program: row.snapshot,
      availability: this.availability(row.snapshot, models),
    }));
  }

  async assignProgram(
    context: Context,
    input: { memberId: string; programId: string; version: number },
    requestId?: string,
  ): Promise<Assignment> {
    staff(context);
    await this.dependencies.memberAccess(context, input.memberId);
    const repository = new TrainingRepository(context);
    if (requestId) {
      const prior = (await this.assignments(context, input.memberId)).find(
        (item) => item.id === requestId,
      );
      if (prior) {
        if (
          prior.assignedBy !== context.actorId ||
          prior.program.programId !== input.programId ||
          prior.program.version !== input.version
        )
          throw new HttpError(
            409,
            'ASSIGNMENT_CONFLICT',
            'Ese envío ya pertenece a otra asignación.',
          );
        return prior;
      }
    }
    const snapshot = await repository.programVersion(input.programId, input.version);
    if (!snapshot) throw missing();
    // Availability changes affect new prescriptions, never the immutable version.
    await this.dependencies.catalog.resolveExercises(context, programExerciseIds(snapshot), true);
    const models = await this.dependencies.equipment.activeModels(context);
    requireAssignableEquipment(snapshot, this.availability(snapshot, models));

    const id = requestId ?? randomUUID();
    if (!(await repository.assignProgram(id, input)))
      throw new HttpError(409, 'ASSIGNMENT_CONFLICT', 'Ese envío ya pertenece a otra asignación.');
    await audit(context, 'program.assign', id);
    const assignment = (await this.assignments(context, input.memberId)).find(
      (item) => item.id === id,
    );
    if (!assignment)
      throw new Error('The created assignment was not readable in its organization transaction.');
    return assignment;
  }

  async executions(context: Context, memberId?: string): Promise<Execution[]> {
    if (context.history && memberId && memberId !== context.actorId) throw denied();
    if (memberId && !context.history) await this.dependencies.memberAccess(context, memberId);
    return new TrainingRepository(context).executions(memberId);
  }

  async recordExecution(context: Context, input: ExecutionInput): Promise<Execution> {
    if (context.role !== 'member' || context.history) throw denied();
    const assignment = (await this.assignments(context)).find(
      (item) => item.id === input.assignmentId,
    );
    if (!assignment) throw missing();
    validateExecution(assignment.program, input);

    const repository = new TrainingRepository(context);
    const prior = await repository.priorExecution(input.id);
    if (prior) {
      if (
        prior.member_id !== context.actorId ||
        !isDeepStrictEqual(ExecutionInputSchema.parse(prior.data), input)
      ) {
        throw new HttpError(
          409,
          'EXECUTION_CONFLICT',
          'Ese identificador ya pertenece a otro registro.',
        );
      }
    } else {
      if (assignment.active === false)
        throw new HttpError(
          409,
          'ASSIGNMENT_INACTIVE',
          'Esta asignación finalizó. Consultá a tu instructor.',
        );
      // Check live inventory only after replay detection, so retries of an
      // accepted record survive later inventory changes.
      requireExecutionEquipment(assignment, input);
      await repository.recordExecution(input);
      await audit(context, 'execution.create', input.id);
    }
    const execution = (await this.executions(context)).find((item) => item.id === input.id);
    if (!execution)
      throw new Error('The recorded execution was not readable in its organization transaction.');
    return execution;
  }

  async report(context: Context): Promise<Report> {
    staff(context);
    const members = await this.dependencies.members(context);
    const assignments = await this.assignments(context);
    const executions = await this.executions(context);
    return trainingReport(members, assignments, executions);
  }
}
