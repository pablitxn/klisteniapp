import {
  EnrollmentSchema,
  GoalProgramContentSchema,
  GoalProgramSchema,
  PeriodPreviewSchema,
  ProductEndpoints,
  RoutineContinuitySchema,
  RoutineVersionV2Schema,
  checkRoutineAssignable,
  decodeRoutine,
  type AssignableRoutine,
  type Enrollment,
  type ProductEndpoint,
  type ProductInput,
  type ProductOutput,
  type RoutineDraftContent,
  type RoutineVersionV2,
} from '@klisteniapp/b2b-contracts/product-v2';
import { conflict, HttpError, missing } from '../errors.ts';
import type { AuthorizedProductContext, PlanningServices } from '../product-context.ts';
import {
  canonicalJson,
  changedFields,
  planningAudit,
  planningHash,
  planningLock,
  planningOperation,
  requireHistory,
  requirePlanning,
} from './operations.ts';
import { PlanningRepository } from './repository.ts';
import type { PlanningSchedule, ScheduleChange } from './schedule-change.ts';

export type PlanningDependencies = {
  /** Resolve non-null references at draft save without requiring publication. */
  validateDraftResources(
    context: AuthorizedProductContext,
    content: RoutineDraftContent,
  ): Promise<void>;
  /** WP04 freezes available exercises/machines, reviewed provenance and own doses.
   * Current branch publication/equipment eligibility must be checked here. */
  publicationResources(
    context: AuthorizedProductContext,
    content: AssignableRoutine,
  ): Promise<Pick<RoutineVersionV2, 'exercises' | 'machines' | 'relations'>>;
  /** Validate new assignment references against current branch availability.
   * Snapshots are read from immutable versions, including explicit legacy v1. */
  validateAssignment(
    context: AuthorizedProductContext,
    stored: ReturnType<typeof decodeRoutine>,
  ): Promise<void>;
  schedule: PlanningSchedule;
  now?: () => number;
};

function input<K extends ProductEndpoint>(endpoint: K, value: ProductInput<K>): ProductInput<K> {
  const parsed = ProductEndpoints[endpoint].input.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      400,
      'INVALID_INPUT',
      'Revisá los campos indicados.',
      parsed.error.issues.map((issue) => ({
        code: 'invalid',
        path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
        stepId: null,
        message: issue.message,
      })),
    );
  return parsed.data as ProductInput<K>;
}

function assertRevision(previous: { revision: number } | null, revision: number): void {
  if ((previous?.revision ?? 0) !== revision) throw conflict();
}
function notArchived(value: { archivedAt: string | null }): void {
  if (value.archivedAt) throw new HttpError(409, 'REVISION_CONFLICT', 'El recurso está archivado.');
}
function contentOf(goal: ProductOutput<'saveGoal'>) {
  return { name: goal.name, goal: goal.goal, timeZone: goal.timeZone, stages: goal.stages };
}
function localDate(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** All entrypoints consume the frozen ACCESS context, never a payload tenant.
 * No handler opens a connection or commits independently of authorization. */
export class PlanningModule implements PlanningServices {
  private readonly dependencies: PlanningDependencies;
  private readonly now: () => number;
  constructor(dependencies: PlanningDependencies) {
    this.dependencies = dependencies;
    this.now = dependencies.now ?? Date.now;
  }

  async routines(context: AuthorizedProductContext, value: ProductInput<'routines'>) {
    requirePlanning(context);
    input('routines', value);
    return new PlanningRepository(context).routines();
  }
  async routine(context: AuthorizedProductContext, value: ProductInput<'routine'>) {
    requirePlanning(context);
    const request = input('routine', value);
    const routine = await new PlanningRepository(context).routine(request.id);
    if (!routine) throw missing();
    return routine;
  }
  async saveRoutine(context: AuthorizedProductContext, value: ProductInput<'saveRoutine'>) {
    requirePlanning(context);
    const request = input('saveRoutine', value);
    return planningOperation(context, 'routine.save', request.id, request, async () => {
      await planningLock(context, 'routine', request.id);
      const repository = new PlanningRepository(context);
      const previous = await repository.routine(request.id, true);
      assertRevision(previous, request.expectedRevision);
      if (previous) notArchived(previous);
      await this.dependencies.validateDraftResources(context, request.content);
      const saved = await repository.saveRoutine(
        request.id,
        request.content,
        previous?.revision ?? null,
      );
      if (!saved) throw conflict();
      await planningAudit(
        context,
        'routine.save',
        saved.id,
        request.operationId,
        request.expectedRevision,
        saved.revision,
        changedFields(previous, saved),
      );
      return saved;
    });
  }
  async publishRoutine(context: AuthorizedProductContext, value: ProductInput<'publishRoutine'>) {
    requirePlanning(context);
    const request = input('publishRoutine', value);
    return planningOperation(context, 'routine.publish', request.id, request, async () => {
      await planningLock(context, 'routine', request.id);
      const repository = new PlanningRepository(context);
      const previous = await repository.routine(request.id, true);
      if (!previous) throw missing();
      assertRevision(previous, request.expectedRevision);
      notArchived(previous);
      const readiness = checkRoutineAssignable({
        name: previous.name,
        description: previous.description,
        steps: previous.steps,
      });
      if (!readiness.ok)
        throw new HttpError(
          422,
          'INCOMPLETE_PRESCRIPTION',
          'Completá la prescripción antes de publicarla.',
          readiness.issues,
        );
      const resources = await this.dependencies.publicationResources(context, readiness.routine);
      const snapshot = RoutineVersionV2Schema.parse({
        ...readiness.routine,
        ...resources,
        schemaVersion: 2,
        programId: previous.id,
        scope: repository.scope,
        version: (previous.publishedVersion ?? 0) + 1,
        publishedAt: new Date(this.now()).toISOString(),
      });
      if (
        snapshot.steps.some(
          (step) =>
            !snapshot.exercises.some(
              (exercise) => exercise.id === step.exerciseId && exercise.status === 'published',
            ),
        )
      )
        throw new HttpError(409, 'INVALID_INPUT', 'Falta el contenido publicado de un ejercicio.');
      await repository.publishRoutine(snapshot);
      await planningAudit(
        context,
        'routine.publish',
        previous.id,
        request.operationId,
        previous.revision,
        previous.revision + 1,
        ['publishedVersion', 'revision'],
      );
      return snapshot;
    });
  }
  async archiveRoutine(context: AuthorizedProductContext, value: ProductInput<'archiveRoutine'>) {
    requirePlanning(context);
    const request = input('archiveRoutine', value);
    return planningOperation(context, 'routine.archive', request.id, request, async () => {
      await planningLock(context, 'routine', request.id);
      const repository = new PlanningRepository(context);
      const previous = await repository.routine(request.id, true);
      if (!previous) throw missing();
      assertRevision(previous, request.expectedRevision);
      notArchived(previous);
      const saved = await repository.archiveRoutine(request.id, new Date(this.now()).toISOString());
      await planningAudit(
        context,
        'routine.archive',
        saved.id,
        request.operationId,
        previous.revision,
        saved.revision,
        ['archivedAt', 'revision'],
      );
      return saved;
    });
  }

  async goals(context: AuthorizedProductContext, value: ProductInput<'goals'>) {
    const request = input('goals', value);
    requireHistory(context, request.memberId);
    await context.authorizeMember(request.memberId, 'history');
    return new PlanningRepository(context).goals(request.memberId);
  }
  async saveGoal(context: AuthorizedProductContext, value: ProductInput<'saveGoal'>) {
    requirePlanning(context);
    const request = input('saveGoal', value);
    await context.authorizeMember(request.memberId, 'planning');
    return planningOperation(context, 'goal.save', request.id, request, async () => {
      await planningLock(context, 'goal', request.id);
      const repository = new PlanningRepository(context);
      const previous = await repository.goal(request.id, true);
      if (previous && previous.scope.memberId !== request.memberId) throw missing();
      assertRevision(previous, request.expectedRevision);
      if (previous) notArchived(previous);
      const issues = request.content.stages.flatMap((stage, index) => {
        const invalid: {
          code: 'invalid';
          path: (string | number)[];
          stepId: null;
          message: string;
        }[] = [];
        if (new Set(stage.slots.map((slot) => slot.id)).size !== stage.slots.length)
          invalid.push({
            code: 'invalid',
            path: ['stages', index, 'slots'],
            stepId: null,
            message: 'Slot identities must be unique within a stage.',
          });
        if (stage.startDate && stage.endDate && stage.endDate < stage.startDate)
          invalid.push({
            code: 'invalid',
            path: ['stages', index, 'endDate'],
            stepId: null,
            message: 'End precedes start.',
          });
        const priorEnd = request.content.stages[index - 1]?.endDate;
        if (stage.startDate && priorEnd && stage.startDate <= priorEnd)
          invalid.push({
            code: 'invalid',
            path: ['stages', index, 'startDate'],
            stepId: null,
            message: 'Dated stages must remain ordered and nonoverlapping.',
          });
        return invalid;
      });
      if (issues.length)
        throw new HttpError(400, 'INVALID_INPUT', 'Revisá las etapas indicadas.', issues);
      await this.validateGoalReferences(context, request.content.stages, false);
      const saved = GoalProgramSchema.parse({
        ...request.content,
        schemaVersion: 2,
        id: request.id,
        scope: { ...repository.scope, memberId: request.memberId },
        revision: request.expectedRevision + 1,
        status: previous?.status ?? 'draft',
        archivedAt: null,
      });
      await repository.saveGoal(saved);
      await planningAudit(
        context,
        'goal.save',
        saved.id,
        request.operationId,
        request.expectedRevision,
        saved.revision,
        changedFields(previous, saved),
      );
      return saved;
    });
  }
  async archiveGoal(context: AuthorizedProductContext, value: ProductInput<'archiveGoal'>) {
    requirePlanning(context);
    const request = input('archiveGoal', value);
    const repository = new PlanningRepository(context);
    const target = await repository.goal(request.id);
    if (!target) throw missing();
    await context.authorizeMember(target.scope.memberId, 'planning');
    return planningOperation(context, 'goal.archive', request.id, request, async () => {
      await planningLock(context, 'goal', request.id);
      const previous = await repository.goal(request.id, true);
      if (!previous) throw missing();
      assertRevision(previous, request.expectedRevision);
      notArchived(previous);
      const saved = GoalProgramSchema.parse({
        ...previous,
        status: 'archived',
        revision: previous.revision + 1,
        archivedAt: new Date(this.now()).toISOString(),
      });
      await repository.saveGoal(saved);
      await planningAudit(
        context,
        'goal.archive',
        saved.id,
        request.operationId,
        previous.revision,
        saved.revision,
        ['status', 'archivedAt', 'revision'],
      );
      return saved;
    });
  }

  private async validateGoalReferences(
    context: AuthorizedProductContext,
    stages: ProductInput<'saveGoal'>['content']['stages'],
    assignment: boolean,
    previous?: Enrollment,
  ) {
    const repository = new PlanningRepository(context);
    const checked = new Set<string>();
    const existing = new Set(
      previous?.content.stages.flatMap((stage) =>
        stage.slots.map((slot) => canonicalJson([stage.id, slot.id, slot.routine])),
      ) ?? [],
    );
    for (const stage of stages)
      for (const slot of stage.slots) {
        if (!slot.routine) continue;
        const key = canonicalJson([stage.id, slot.id, slot.routine]);
        if (checked.has(key)) continue;
        checked.add(key);
        const version = await repository.version(slot.routine);
        if (assignment && !existing.has(key)) {
          if (version.archived)
            throw new HttpError(
              409,
              'INVALID_INPUT',
              'La rutina está archivada para nuevas asignaciones.',
            );
          await this.dependencies.validateAssignment(context, version.stored);
        }
      }
  }

  async enroll(context: AuthorizedProductContext, value: ProductInput<'enroll'>) {
    requirePlanning(context);
    const request = input('enroll', value);
    await context.authorizeMember(request.memberId, 'planning');
    return planningOperation(context, 'enrollment.create', request.id, request, async () => {
      await planningLock(context, 'enrollment', request.id);
      const repository = new PlanningRepository(context);
      if (await repository.enrollment(request.id, true)) throw conflict();
      assertRevision(null, request.expectedRevision);
      await planningLock(context, 'goal', request.goalProgramId);
      const goal = await repository.goal(request.goalProgramId, true);
      if (!goal || goal.scope.memberId !== request.memberId) throw missing();
      notArchived(goal);
      assertRevision(goal, request.issuedGoalRevision);
      const content = GoalProgramContentSchema.safeParse(contentOf(goal));
      if (!content.success)
        throw new HttpError(
          422,
          'INCOMPLETE_PRESCRIPTION',
          'Completá las etapas antes de asignar el programa.',
        );
      if (canonicalJson(content.data) !== canonicalJson(request.content)) throw conflict();
      await this.validateGoalReferences(context, content.data.stages, true);
      const saved = EnrollmentSchema.parse({
        schemaVersion: 2,
        id: request.id,
        scope: { ...repository.scope, memberId: request.memberId },
        goalProgramId: goal.id,
        issuedGoalRevision: goal.revision,
        revision: 1,
        status: 'active',
        content: content.data,
        createdAt: new Date(this.now()).toISOString(),
      });
      const change: ScheduleChange = {
        reason: 'enroll',
        effectiveAt: saved.createdAt,
        before: null,
        after: saved,
        occurrences: [],
        sessions: [],
      };
      const impacts = this.impacts(change);
      await repository.saveEnrollment(saved);
      await this.dependencies.schedule.apply(context, change, impacts);
      if (goal.status !== 'active') {
        const active = GoalProgramSchema.parse({
          ...goal,
          status: 'active',
          revision: goal.revision + 1,
        });
        await repository.saveGoal(active);
        await planningAudit(
          context,
          'goal.activate',
          goal.id,
          request.operationId,
          goal.revision,
          active.revision,
          ['status', 'revision'],
        );
      }
      await planningAudit(context, 'enrollment.create', saved.id, request.operationId, 0, 1, [
        'goalProgramId',
        'issuedGoalRevision',
        'content',
        'status',
        'revision',
      ]);
      return saved;
    });
  }

  private impacts(change: ScheduleChange) {
    const impacts = PeriodPreviewSchema.shape.impacts.parse(
      this.dependencies.schedule.plan(change),
    );
    const byId = new Map(change.occurrences.map((occurrence) => [occurrence.id, occurrence]));
    const seen = new Set<string>();
    for (const impact of impacts) {
      const occurrence = byId.get(impact.occurrenceId);
      if (
        !occurrence ||
        seen.has(impact.occurrenceId) ||
        occurrence.revision !== impact.expectedRevision ||
        occurrence.scheduledDate !== impact.beforeDate ||
        occurrence.eligibility !== impact.beforeEligibility
      )
        throw new Error('Schedule impact must refer once to a current issued occurrence.');
      seen.add(impact.occurrenceId);
      const sessions = change.sessions
        .filter((session) => session.occurrenceId === occurrence.id)
        .map((session) => session.id)
        .sort();
      if (canonicalJson(sessions) !== canonicalJson([...impact.linkedSessionIds].sort()))
        throw new Error('Schedule impact must preserve all linked actual records.');
    }
    return impacts;
  }
  private async change(
    context: AuthorizedProductContext,
    previous: Enrollment,
    proposed: Enrollment['content'],
    reason: 'period' | 'end',
  ): Promise<ScheduleChange> {
    const state = await new PlanningRepository(context).scheduleState(previous.id);
    const now = this.now();
    return {
      reason,
      before: previous,
      after: EnrollmentSchema.parse({
        ...previous,
        revision: previous.revision + 1,
        status: reason === 'end' ? 'ended' : previous.status,
        content: proposed,
      }),
      ...state,
      // End uses its precise server instant. Period previews bind the existing
      // expiry bucket, so time passing within that bucket cannot change the hash.
      effectiveAt: new Date(
        reason === 'end' ? now : Math.floor(now / 900_000) * 900_000,
      ).toISOString(),
    };
  }
  private preview(context: AuthorizedProductContext, change: ScheduleChange) {
    const impacts = this.impacts(change);
    // Stateless expiry is the end of the current 15-minute server-clock bucket.
    const expiresAt = new Date(Date.parse(change.effectiveAt) + 900_000).toISOString();
    const previewHash = planningHash({
      actorId: context.actorId,
      scope: change.after.scope,
      change,
      impacts,
      expiresAt,
    });
    return PeriodPreviewSchema.parse({
      schemaVersion: 2,
      enrollmentId: change.after.id,
      expectedRevision: change.before!.revision,
      proposed: change.after.content,
      impacts,
      expiresAt,
      previewHash,
    });
  }
  async periodPreview(context: AuthorizedProductContext, value: ProductInput<'periodPreview'>) {
    requirePlanning(context);
    const request = input('periodPreview', value);
    await planningLock(context, 'enrollment', request.id);
    const previous = await new PlanningRepository(context).enrollment(request.id, true);
    if (!previous) throw missing();
    await context.authorizeMember(previous.scope.memberId, 'planning');
    assertRevision(previous, request.expectedRevision);
    if (previous.status !== 'active') throw conflict();
    await this.validateGoalReferences(context, request.proposed.stages, true, previous);
    return this.preview(context, await this.change(context, previous, request.proposed, 'period'));
  }
  async applyPeriod(context: AuthorizedProductContext, value: ProductInput<'applyPeriod'>) {
    requirePlanning(context);
    const request = input('applyPeriod', value);
    const repository = new PlanningRepository(context);
    const target = await repository.enrollment(request.enrollmentId);
    if (!target) throw missing();
    await context.authorizeMember(target.scope.memberId, 'planning');
    return planningOperation(
      context,
      'enrollment.period',
      request.enrollmentId,
      request,
      async () => {
        await planningLock(context, 'enrollment', request.enrollmentId);
        const previous = await repository.enrollment(request.enrollmentId, true);
        if (!previous) throw missing();
        assertRevision(previous, request.expectedRevision);
        if (previous.status !== 'active') throw conflict();
        await this.validateGoalReferences(context, request.proposed.stages, true, previous);
        const change = await this.change(context, previous, request.proposed, 'period');
        const preview = this.preview(context, change);
        if (preview.previewHash !== request.previewHash)
          throw new HttpError(
            409,
            'STALE_PERIOD_PREVIEW',
            'El impacto cambió. Volvé a revisar la vista previa.',
          );
        await repository.saveEnrollment(change.after);
        await this.dependencies.schedule.apply(context, change, preview.impacts);
        await planningAudit(
          context,
          'enrollment.period',
          change.after.id,
          request.operationId,
          previous.revision,
          change.after.revision,
          changedFields(previous, change.after),
        );
        return change.after;
      },
    );
  }
  async endEnrollment(context: AuthorizedProductContext, value: ProductInput<'endEnrollment'>) {
    requirePlanning(context);
    const request = input('endEnrollment', value);
    const repository = new PlanningRepository(context);
    const target = await repository.enrollment(request.id);
    if (!target) throw missing();
    await context.authorizeMember(target.scope.memberId, 'planning');
    return planningOperation(context, 'enrollment.end', request.id, request, async () => {
      await planningLock(context, 'enrollment', request.id);
      const previous = await repository.enrollment(request.id, true);
      if (!previous) throw missing();
      assertRevision(previous, request.expectedRevision);
      if (previous.status !== 'active') throw conflict();
      const change = await this.change(context, previous, previous.content, 'end');
      const impacts = this.impacts(change);
      await repository.saveEnrollment(change.after);
      await this.dependencies.schedule.apply(context, change, impacts);
      await planningAudit(
        context,
        'enrollment.end',
        previous.id,
        request.operationId,
        previous.revision,
        change.after.revision,
        ['status', 'revision'],
      );
      return change.after;
    });
  }
  async continuity(context: AuthorizedProductContext, value: ProductInput<'continuity'>) {
    const request = input('continuity', value);
    requireHistory(context, request.memberId);
    await context.authorizeMember(request.memberId, 'history');
    const repository = new PlanningRepository(context);
    const current: Enrollment[] = [],
      past: Enrollment[] = [],
      future: Enrollment[] = [];
    for (const enrollment of await repository.enrollments(request.memberId)) {
      const today = localDate(this.now(), enrollment.content.timeZone);
      const stages = enrollment.content.stages;
      if (enrollment.status === 'ended' || stages.at(-1)!.endDate < today) past.push(enrollment);
      else if (stages[0]!.startDate > today) future.push(enrollment);
      else current.push(enrollment);
    }
    return RoutineContinuitySchema.parse({
      schemaVersion: 2,
      scope: { ...repository.scope, memberId: request.memberId },
      current,
      past,
      future,
      unscheduledLegacyAssignmentIds: await repository.legacyAssignmentIds(request.memberId),
    });
  }
}

/** Bind methods before spreading this object into ACCESS's shared registry. */
export function createPlanningServices(dependencies: PlanningDependencies): PlanningServices {
  const module = new PlanningModule(dependencies);
  return {
    routines: module.routines.bind(module),
    routine: module.routine.bind(module),
    saveRoutine: module.saveRoutine.bind(module),
    publishRoutine: module.publishRoutine.bind(module),
    archiveRoutine: module.archiveRoutine.bind(module),
    goals: module.goals.bind(module),
    saveGoal: module.saveGoal.bind(module),
    archiveGoal: module.archiveGoal.bind(module),
    enroll: module.enroll.bind(module),
    endEnrollment: module.endEnrollment.bind(module),
    periodPreview: module.periodPreview.bind(module),
    applyPeriod: module.applyPeriod.bind(module),
    continuity: module.continuity.bind(module),
  };
}
