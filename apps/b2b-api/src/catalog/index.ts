import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { exercises as baseExercises } from '@klisteniapp/catalog-base';
import {
  ExerciseInputSchema, MachineInputSchema,
  type ContentStatus, type Exercise, type Machine,
} from '@klisteniapp/b2b-contracts';
import { conflict, HttpError, missing } from '../errors.ts';
import { admin, audit, staff, type Context, type ValidateAssets } from '../organization-context.ts';
import { exerciseMachineIds } from './compatibility.ts';

type ExerciseInput = z.infer<typeof ExerciseInputSchema>;
type MachineInput = z.infer<typeof MachineInputSchema>;
type CatalogRow<T> = {
  id: string;
  organization_id: string | null;
  data: T;
  status: ContentStatus;
  version: number;
  revision: number;
};
type ExerciseRow = CatalogRow<ExerciseInput>;
type MachineRow = CatalogRow<MachineInput>;
const exerciseDTO = (row: ExerciseRow): Exercise => ({
  ...row.data, id: row.id, scope: row.organization_id ? 'organization' : 'base',
  status: row.status, version: row.version, revision: row.revision,
});
const machineDTO = (row: MachineRow): Machine => ({
  ...row.data, id: row.id, scope: row.organization_id ? 'organization' : 'base',
  status: row.status, version: row.version, revision: row.revision,
});

/** Reusable definitions, adaptations and editorial transitions. Every mutation
 * stays inside the authorized organization's transaction, including its audit. */
export class CatalogModule {
  private validateAssets: ValidateAssets;

  constructor(validateAssets: ValidateAssets) {
    this.validateAssets = validateAssets;
  }

  async machines(context: Context): Promise<Machine[]> {
    const found = await context.db.query<MachineRow>(
      "SELECT * FROM b2b_machine WHERE (organization_id IS NULL OR organization_id=$1) AND ($2<>'member' OR status='published') ORDER BY id",
      [context.org.id, context.role],
    );
    return found.rows.map(machineDTO);
  }

  async createMachine(context: Context, input: MachineInput): Promise<Machine> {
    admin(context);
    await this.validateAssets(context, input.assets);
    await this.validateMachineSource(context, input);
    const id = randomUUID();
    const found = await context.db.query<MachineRow>(
      'INSERT INTO b2b_machine(id,organization_id,data) VALUES($1,$2,$3) RETURNING *',
      [id, context.org.id, input],
    );
    await audit(context, 'machine.create', id);
    return machineDTO(found.rows[0]);
  }

  private async validateMachineSource(context: Context, input: MachineInput) {
    if (Boolean(input.derivedFromId) !== Boolean(input.derivedFromVersion)) {
      throw new HttpError(400, 'INVALID_MODEL_SOURCE', 'La adaptación requiere modelo y versión de origen.');
    }
    if (input.derivedFromId && !(await context.db.query(
      'SELECT 1 FROM b2b_machine WHERE id=$1 AND version=$2 AND (organization_id IS NULL OR organization_id=$3)',
      [input.derivedFromId, input.derivedFromVersion, context.org.id],
    )).rowCount) {
      throw new HttpError(409, 'MODEL_SOURCE_CHANGED', 'El modelo de origen no está disponible en esa versión.');
    }
  }

  async updateMachine(context: Context, id: string, input: MachineInput, revision: number): Promise<Machine> {
    admin(context);
    await this.validateAssets(context, input.assets);
    const previous = (await context.db.query<MachineRow>(
      'SELECT * FROM b2b_machine WHERE organization_id=$1 AND id=$2', [context.org.id, id],
    )).rows[0];
    if (!previous || previous.revision !== revision) throw conflict();
    if (input.derivedFromId !== previous.data.derivedFromId || input.derivedFromVersion !== previous.data.derivedFromVersion) {
      throw new HttpError(400, 'IMMUTABLE_MODEL_SOURCE', 'Conservá la referencia de origen de esta adaptación.');
    }
    const found = await context.db.query<MachineRow>(
      "UPDATE b2b_machine SET data=$3,status='draft',version=version+1,revision=revision+1 WHERE organization_id=$1 AND id=$2 RETURNING *",
      [context.org.id, id, input],
    );
    await audit(context, 'machine.update', id);
    return machineDTO(found.rows[0]);
  }

  async validateMachine(context: Context, id: string) {
    if (!(await context.db.query(
      'SELECT 1 FROM b2b_machine WHERE id=$1 AND (organization_id IS NULL OR organization_id=$2)',
      [id, context.org.id],
    )).rowCount) throw missing();
  }

  async transitionMachine(context: Context, id: string, revision: number, publish: boolean): Promise<Machine> {
    admin(context);
    const found = await context.db.query<MachineRow>(
      'UPDATE b2b_machine SET status=$4,revision=revision+1,version=version+$5 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status=$6 RETURNING *',
      [context.org.id, id, revision, publish ? 'published' : 'reviewed', 0, publish ? 'reviewed' : 'draft'],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, publish ? 'machine.publish' : 'machine.review', id);
    return machineDTO(found.rows[0]);
  }

  async exercises(context: Context): Promise<Exercise[]> {
    const found = await context.db.query<ExerciseRow>(
      "SELECT * FROM b2b_exercise WHERE (organization_id IS NULL OR organization_id=$1) AND ($2 <> 'member' OR status='published') ORDER BY id",
      [context.org.id, context.role],
    );
    return found.rows.map(exerciseDTO);
  }

  private async validateExercise(context: Context, input: ExerciseInput) {
    await this.validateAssets(context, input.assets);
    for (const id of exerciseMachineIds(input)) await this.validateMachine(context, id);
    if (input.baseExerciseId && !(await context.db.query(
      'SELECT 1 FROM b2b_exercise WHERE id=$1 AND organization_id IS NULL', [input.baseExerciseId],
    )).rowCount) throw missing();
    if (input.animationId && !baseExercises.some(exercise => exercise.id === input.animationId)) {
      throw new HttpError(400, 'INVALID_ANIMATION', 'La animación no pertenece a la biblioteca.');
    }
  }

  async createExercise(context: Context, input: ExerciseInput): Promise<Exercise> {
    staff(context);
    await this.validateExercise(context, input);
    const id = randomUUID();
    const found = await context.db.query<ExerciseRow>(
      "INSERT INTO b2b_exercise(id,organization_id,data,status) VALUES($1,$2,$3,'draft') RETURNING *",
      [id, context.org.id, input],
    );
    await audit(context, 'exercise.create', id);
    return exerciseDTO(found.rows[0]);
  }

  async updateExercise(context: Context, id: string, input: ExerciseInput, revision: number): Promise<Exercise> {
    staff(context);
    await this.validateExercise(context, input);
    const found = await context.db.query<ExerciseRow>(
      "UPDATE b2b_exercise SET data=$3,status='draft',revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$4 RETURNING *",
      [context.org.id, id, input, revision],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'exercise.update', id);
    return exerciseDTO(found.rows[0]);
  }

  async reviewExercise(context: Context, id: string, revision: number): Promise<Exercise> {
    staff(context);
    const found = await context.db.query<ExerciseRow>(
      "UPDATE b2b_exercise SET status='reviewed',revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status='draft' RETURNING *",
      [context.org.id, id, revision],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'exercise.review', id);
    return exerciseDTO(found.rows[0]);
  }

  async publishExercise(context: Context, id: string, revision: number): Promise<Exercise> {
    staff(context);
    const found = await context.db.query<ExerciseRow>(
      "UPDATE b2b_exercise SET status='published',version=version+1,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status='reviewed' RETURNING *",
      [context.org.id, id, revision],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'exercise.publish', id);
    return exerciseDTO(found.rows[0]);
  }

  /** Resolve catalogue content at publication time; the caller persists the
   * resulting definitions in its immutable routine snapshot. */
  async resolveExercises(context: Context, ids: string[], published: boolean): Promise<Exercise[]> {
    const found = await context.db.query<ExerciseRow>(
      "SELECT * FROM b2b_exercise WHERE id=ANY($1::text[]) AND (organization_id IS NULL OR organization_id=$2) AND (NOT $3::boolean OR status='published')",
      [ids, context.org.id, published],
    );
    if (found.rowCount !== ids.length) {
      throw new HttpError(400, 'EXERCISE_UNAVAILABLE', 'La rutina contiene ejercicios no disponibles o sin publicar.');
    }
    return found.rows.map(exerciseDTO);
  }

  async resolvePublishedMachines(context: Context, ids: string[]): Promise<Machine[]> {
    const machines = (await context.db.query<MachineRow>(
      "SELECT * FROM b2b_machine WHERE id=ANY($1::text[]) AND (organization_id IS NULL OR organization_id=$2) AND status='published'",
      [ids, context.org.id],
    )).rows.map(machineDTO);
    if (machines.length !== ids.length) {
      throw new HttpError(409, 'MODEL_UNPUBLISHED', 'Revisá y publicá los modelos de la rutina.');
    }
    return machines;
  }

  /** Public reads never include drafts, even for an authenticated visitor. */
  async publishedCatalog(db: PoolClient, organizationId: string) {
    const machines = (await db.query<MachineRow>(
      "SELECT * FROM b2b_machine WHERE (organization_id IS NULL OR organization_id=$1) AND status='published'",
      [organizationId],
    )).rows.map(machineDTO);
    const publishedModels = new Set(machines.map(machine => machine.id));
    const exercises = (await db.query<ExerciseRow>(
      "SELECT * FROM b2b_exercise WHERE (organization_id IS NULL OR organization_id=$1) AND status='published'",
      [organizationId],
    )).rows.map(exerciseDTO).filter(exercise => exerciseMachineIds(exercise).every(id => publishedModels.has(id)));
    return { machines, exercises };
  }
}
