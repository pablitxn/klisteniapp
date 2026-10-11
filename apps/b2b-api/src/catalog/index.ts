import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { exercises as baseExercises } from '@klisteniapp/catalog-base';
import {
  ExerciseInputSchema,
  MachineInputSchema,
  type ContentStatus,
  type Exercise,
  type Machine,
} from '@klisteniapp/b2b-contracts';
import { conflict, HttpError, missing } from '../errors.ts';
import { admin, audit, staff, type Context, type ValidateAssets } from '../organization-context.ts';
import { exerciseMachineIds } from '@klisteniapp/b2b-domain/catalog';

type ExerciseInput = z.infer<typeof ExerciseInputSchema>;
type MachineInput = z.infer<typeof MachineInputSchema>;
type CatalogRow<T> = {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  data: T;
  status: ContentStatus;
  version: number;
  revision: number;
};
type ExerciseRow = CatalogRow<ExerciseInput>;
type MachineRow = CatalogRow<MachineInput>;
const exerciseDTO = (row: ExerciseRow): Exercise => ({
  ...row.data,
  id: row.id,
  ...(row.branch_id ? { branchId: row.branch_id } : {}),
  scope: row.organization_id ? 'organization' : 'base',
  status: row.status,
  version: row.version,
  revision: row.revision,
});
const machineDTO = (row: MachineRow): Machine => ({
  ...row.data,
  id: row.id,
  ...(row.branch_id ? { branchId: row.branch_id } : {}),
  scope: row.organization_id ? 'organization' : 'base',
  status: row.status,
  version: row.version,
  revision: row.revision,
});

/** Availability is explicit for resources owned by another branch. An optional
 * override can hide shared/base content without mutating its historical snapshots. */
function available(kind: 'machine' | 'exercise', organization: string, branch: string): string {
  const table = `b2b_${kind}`;
  return `(${branch}::text IS NULL OR (
    (${table}.branch_id IS NULL OR ${table}.branch_id=${branch} OR (${table}.status='published' AND EXISTS(
      SELECT 1 FROM b2b_branch_catalog bc WHERE bc.organization_id=${organization}
      AND bc.branch_id=${branch} AND bc.kind='${kind}' AND bc.resource_id=${table}.id AND bc.enabled)))
    AND NOT EXISTS(SELECT 1 FROM b2b_branch_catalog bc WHERE bc.organization_id=${organization}
      AND bc.branch_id=${branch} AND bc.kind='${kind}' AND bc.resource_id=${table}.id AND NOT bc.enabled)))`;
}

/** Reusable definitions, adaptations and editorial transitions. Every mutation
 * stays inside the authorized organization's transaction, including its audit. */
export class CatalogModule {
  private validateAssets: ValidateAssets;

  constructor(validateAssets: ValidateAssets) {
    this.validateAssets = validateAssets;
  }

  async machines(context: Context): Promise<Machine[]> {
    const found = await context.db.query<MachineRow>(
      `SELECT * FROM b2b_machine WHERE (organization_id IS NULL OR organization_id=$1) AND ($2<>'member' OR status='published') AND ${available('machine', '$1', '$3')} ORDER BY id`,
      [context.org.id, context.role, context.branchId ?? null],
    );
    return found.rows.map(machineDTO);
  }

  async createMachine(context: Context, input: MachineInput): Promise<Machine> {
    admin(context);
    await this.validateAssets(context, input.assets);
    await this.validateMachineSource(context, input);
    const id = randomUUID();
    const found = await context.db.query<MachineRow>(
      'INSERT INTO b2b_machine(id,organization_id,data,branch_id) VALUES($1,$2,$3,$4) RETURNING *',
      [id, context.org.id, input, context.branchId ?? null],
    );
    await audit(context, 'machine.create', id);
    return machineDTO(found.rows[0]);
  }

  private async validateMachineSource(context: Context, input: MachineInput) {
    if (Boolean(input.derivedFromId) !== Boolean(input.derivedFromVersion)) {
      throw new HttpError(
        400,
        'INVALID_MODEL_SOURCE',
        'La adaptación requiere modelo y versión de origen.',
      );
    }
    if (
      input.derivedFromId &&
      !(
        await context.db.query(
          `SELECT 1 FROM b2b_machine WHERE id=$1 AND version=$2 AND (organization_id IS NULL OR organization_id=$3) AND ${available('machine', '$3', '$4')}`,
          [input.derivedFromId, input.derivedFromVersion, context.org.id, context.branchId ?? null],
        )
      ).rowCount
    ) {
      throw new HttpError(
        409,
        'MODEL_SOURCE_CHANGED',
        'El modelo de origen no está disponible en esa versión.',
      );
    }
  }

  async updateMachine(
    context: Context,
    id: string,
    input: MachineInput,
    revision: number,
  ): Promise<Machine> {
    admin(context);
    await this.validateAssets(context, input.assets);
    const previous = (
      await context.db.query<MachineRow>(
        'SELECT * FROM b2b_machine WHERE organization_id=$1 AND id=$2 AND ($3::text IS NULL OR branch_id IS NULL OR branch_id=$3)',
        [context.org.id, id, context.branchId ?? null],
      )
    ).rows[0];
    if (!previous || previous.revision !== revision) throw conflict();
    if (
      input.derivedFromId !== previous.data.derivedFromId ||
      input.derivedFromVersion !== previous.data.derivedFromVersion
    ) {
      throw new HttpError(
        400,
        'IMMUTABLE_MODEL_SOURCE',
        'Conservá la referencia de origen de esta adaptación.',
      );
    }
    const found = await context.db.query<MachineRow>(
      "UPDATE b2b_machine SET data=$3,status='draft',version=version+1,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND ($4::text IS NULL OR branch_id IS NULL OR branch_id=$4) RETURNING *",
      [context.org.id, id, input, context.branchId ?? null],
    );
    await audit(context, 'machine.update', id);
    return machineDTO(found.rows[0]);
  }

  async validateMachine(context: Context, id: string) {
    if (
      !(
        await context.db.query(
          `SELECT 1 FROM b2b_machine WHERE id=$1 AND (organization_id IS NULL OR organization_id=$2) AND ${available('machine', '$2', '$3')}`,
          [id, context.org.id, context.branchId ?? null],
        )
      ).rowCount
    )
      throw missing();
  }

  async transitionMachine(
    context: Context,
    id: string,
    revision: number,
    publish: boolean,
  ): Promise<Machine> {
    admin(context);
    const found = await context.db.query<MachineRow>(
      'UPDATE b2b_machine SET status=$4,revision=revision+1,version=version+$5 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status=$6 AND ($7::text IS NULL OR branch_id IS NULL OR branch_id=$7) RETURNING *',
      [
        context.org.id,
        id,
        revision,
        publish ? 'published' : 'reviewed',
        0,
        publish ? 'reviewed' : 'draft',
        context.branchId ?? null,
      ],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, publish ? 'machine.publish' : 'machine.review', id);
    return machineDTO(found.rows[0]);
  }

  async exercises(context: Context): Promise<Exercise[]> {
    const found = await context.db.query<ExerciseRow>(
      `SELECT * FROM b2b_exercise WHERE (organization_id IS NULL OR organization_id=$1) AND ($2 <> 'member' OR status='published') AND ${available('exercise', '$1', '$3')} ORDER BY id`,
      [context.org.id, context.role, context.branchId ?? null],
    );
    return found.rows.map(exerciseDTO);
  }

  private async validateExercise(context: Context, input: ExerciseInput) {
    await this.validateAssets(context, input.assets);
    for (const id of exerciseMachineIds(input)) await this.validateMachine(context, id);
    if (
      input.baseExerciseId &&
      !(
        await context.db.query(
          `SELECT 1 FROM b2b_exercise WHERE id=$1 AND organization_id IS NULL AND ${available('exercise', '$2', '$3')}`,
          [input.baseExerciseId, context.org.id, context.branchId ?? null],
        )
      ).rowCount
    )
      throw missing();
    if (input.animationId && !baseExercises.some((exercise) => exercise.id === input.animationId)) {
      throw new HttpError(400, 'INVALID_ANIMATION', 'La animación no pertenece a la biblioteca.');
    }
  }

  async createExercise(context: Context, input: ExerciseInput): Promise<Exercise> {
    staff(context);
    await this.validateExercise(context, input);
    const id = randomUUID();
    const found = await context.db.query<ExerciseRow>(
      "INSERT INTO b2b_exercise(id,organization_id,data,status,branch_id) VALUES($1,$2,$3,'draft',$4) RETURNING *",
      [id, context.org.id, input, context.branchId ?? null],
    );
    await audit(context, 'exercise.create', id);
    return exerciseDTO(found.rows[0]);
  }

  async updateExercise(
    context: Context,
    id: string,
    input: ExerciseInput,
    revision: number,
  ): Promise<Exercise> {
    staff(context);
    await this.validateExercise(context, input);
    const found = await context.db.query<ExerciseRow>(
      "UPDATE b2b_exercise SET data=$3,status='draft',revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$4 AND ($5::text IS NULL OR branch_id=$5 OR (branch_id IS NULL AND $6='admin')) RETURNING *",
      [context.org.id, id, input, revision, context.branchId ?? null, context.role],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'exercise.update', id);
    return exerciseDTO(found.rows[0]);
  }

  async reviewExercise(context: Context, id: string, revision: number): Promise<Exercise> {
    staff(context);
    const found = await context.db.query<ExerciseRow>(
      "UPDATE b2b_exercise SET status='reviewed',revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status='draft' AND ($4::text IS NULL OR branch_id=$4 OR (branch_id IS NULL AND $5='admin')) RETURNING *",
      [context.org.id, id, revision, context.branchId ?? null, context.role],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'exercise.review', id);
    return exerciseDTO(found.rows[0]);
  }

  async publishExercise(context: Context, id: string, revision: number): Promise<Exercise> {
    staff(context);
    const found = await context.db.query<ExerciseRow>(
      "UPDATE b2b_exercise SET status='published',version=version+1,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status='reviewed' AND ($4::text IS NULL OR branch_id=$4 OR (branch_id IS NULL AND $5='admin')) RETURNING *",
      [context.org.id, id, revision, context.branchId ?? null, context.role],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'exercise.publish', id);
    return exerciseDTO(found.rows[0]);
  }

  /** Resolve catalogue content at publication time; the caller persists the
   * resulting definitions in its immutable routine snapshot. */
  async resolveExercises(context: Context, ids: string[], published: boolean): Promise<Exercise[]> {
    const found = await context.db.query<ExerciseRow>(
      `SELECT * FROM b2b_exercise WHERE id=ANY($1::text[]) AND (organization_id IS NULL OR organization_id=$2) AND (NOT $3::boolean OR status='published') AND ${available('exercise', '$2', '$4')}`,
      [ids, context.org.id, published, context.branchId ?? null],
    );
    if (found.rowCount !== ids.length) {
      throw new HttpError(
        400,
        'EXERCISE_UNAVAILABLE',
        'La rutina contiene ejercicios no disponibles o sin publicar.',
      );
    }
    return found.rows.map(exerciseDTO);
  }

  async resolvePublishedMachines(context: Context, ids: string[]): Promise<Machine[]> {
    const machines = (
      await context.db.query<MachineRow>(
        `SELECT * FROM b2b_machine WHERE id=ANY($1::text[]) AND (organization_id IS NULL OR organization_id=$2) AND status='published' AND ${available('machine', '$2', '$3')}`,
        [ids, context.org.id, context.branchId ?? null],
      )
    ).rows.map(machineDTO);
    if (machines.length !== ids.length) {
      throw new HttpError(409, 'MODEL_UNPUBLISHED', 'Revisá y publicá los modelos de la rutina.');
    }
    return machines;
  }

  /** Public reads never include drafts, even for an authenticated visitor. */
  async publishedCatalog(db: PoolClient, organizationId: string, branchId?: string) {
    const machines = (
      await db.query<MachineRow>(
        `SELECT * FROM b2b_machine WHERE (organization_id IS NULL OR organization_id=$1) AND status='published' AND ${available('machine', '$1', '$2')}`,
        [organizationId, branchId ?? null],
      )
    ).rows.map(machineDTO);
    const publishedModels = new Set(machines.map((machine) => machine.id));
    const exercises = (
      await db.query<ExerciseRow>(
        `SELECT * FROM b2b_exercise WHERE (organization_id IS NULL OR organization_id=$1) AND status='published' AND ${available('exercise', '$1', '$2')}`,
        [organizationId, branchId ?? null],
      )
    ).rows
      .map(exerciseDTO)
      .filter((exercise) => exerciseMachineIds(exercise).every((id) => publishedModels.has(id)));
    return { machines, exercises };
  }
}
