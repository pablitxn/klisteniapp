import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import {
  PersonalDataSchema, PersonalSettingsSchema, ProgressDataSchema,
  WorkoutLogSchema, CardioLogSchema, createDefaultPersonalData,
  dateInTimeZone, isPlanHistoryPreserved,
  type PersonalData, type PersonalSettings, type ServerState,
  type WorkoutLog, type CardioLog,
} from '@klisteniapp/scene-schema';
import { z } from 'zod';
import { HttpError } from './errors.ts';

export const SettingsRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  settings: PersonalSettingsSchema,
}).strict();
export const LogRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('workout'), log: WorkoutLogSchema }).strict(),
  z.object({ kind: z.literal('cardio'), log: CardioLogSchema }).strict(),
]);
export const ImportRequestSchema = z.object({
  data: z.union([PersonalDataSchema, ProgressDataSchema]),
  includeSettings: z.boolean().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
}).strict();
type LogInput = z.infer<typeof LogRequestSchema>;
type ImportInput = z.infer<typeof ImportRequestSchema>;
type Owner = { id: string; name: string };
type LogRow = { id: string; kind: 'workout' | 'cardio'; payload: WorkoutLog | CardioLog | null; deleted: boolean };
type StateRow = { settings: PersonalSettings; revision: number };

/** Account-wide serialization covers devices, import, deletion, and operator actions. */
export async function lockUser(client: PoolClient, userId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`klisteniapp:user:${userId}`]);
}

export class StateRepository {
  pool: Pool;
  now: () => Date;
  constructor(pool: Pool, now = () => new Date()) { this.pool = pool; this.now = now; }

  async transaction(owner: Owner, operation: (client: PoolClient, row: StateRow) => Promise<boolean>): Promise<ServerState> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await lockUser(client, owner.id);
      const user = await client.query<{ disabled: boolean }>('SELECT disabled FROM auth_user WHERE id = $1', [owner.id]);
      if (!user.rows[0] || user.rows[0].disabled) throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
      const defaults = createDefaultPersonalData(owner.name);
      await client.query('INSERT INTO personal_state (user_id, settings) VALUES ($1, $2) ON CONFLICT DO NOTHING', [owner.id, defaults.settings]);
      const result = await client.query<StateRow>('SELECT settings, revision FROM personal_state WHERE user_id = $1', [owner.id]);
      const row = result.rows[0];
      if (!row) throw new Error('Missing account state');
      row.settings = PersonalSettingsSchema.parse(row.settings);
      if (await operation(client, row)) {
        await client.query('UPDATE personal_state SET settings = $2, revision = revision + 1, updated_at = now() WHERE user_id = $1', [owner.id, row.settings]);
        row.revision += 1;
      }
      const logs = await client.query<LogRow>('SELECT id, kind, payload, deleted FROM personal_log WHERE user_id = $1 AND NOT deleted ORDER BY created_at, id', [owner.id]);
      const data = PersonalDataSchema.parse({
        version: 2,
        settings: row.settings,
        progress: {
          version: 1,
          workouts: logs.rows.filter((log) => log.kind === 'workout').map((log) => log.payload),
          cardio: logs.rows.filter((log) => log.kind === 'cardio').map((log) => log.payload),
        },
      });
      await client.query('COMMIT');
      return { data, revision: row.revision };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  get(owner: Owner): Promise<ServerState> {
    return this.transaction(owner, async () => false);
  }

  replaceSettings(row: StateRow, settings: PersonalSettings, expectedRevision?: number, restoreEmptyAccount = false): boolean {
    if (expectedRevision !== row.revision) throw new HttpError(409, 'REVISION_CONFLICT', 'Tus datos cambiaron en otro dispositivo. Actualizá antes de guardar.');
    const today = dateInTimeZone(this.now(), row.settings.profile.timeZone);
    if (!restoreEmptyAccount && !isPlanHistoryPreserved(row.settings.plans, settings.plans, today)) {
      throw new HttpError(409, 'PLAN_HISTORY_CONFLICT', 'El historial del plan es inmutable. Los cambios empiezan el próximo lunes.');
    }
    if (isDeepStrictEqual(row.settings, settings)) return false;
    row.settings = settings;
    return true;
  }

  settings(owner: Owner, input: z.infer<typeof SettingsRequestSchema>): Promise<ServerState> {
    return this.transaction(owner, async (_client, row) => this.replaceSettings(row, input.settings, input.expectedRevision));
  }

  async insertLogs(client: PoolClient, owner: Owner, inputs: LogInput[]): Promise<boolean> {
    if (!inputs.length) return false;
    const existing = await client.query<LogRow>('SELECT id, kind, payload, deleted FROM personal_log WHERE user_id = $1 AND id = ANY($2::text[])', [owner.id, inputs.map(({ log }) => log.id)]);
    const byId = new Map(existing.rows.map((row) => [row.id, row]));
    const additions = [];
    for (const input of inputs) {
      const previous = byId.get(input.log.id);
      if (previous?.deleted) throw new HttpError(409, 'LOG_DELETED', 'Un registro de esta importación ya fue eliminado. No se restauró.');
      if (previous && (previous.kind !== input.kind || !isDeepStrictEqual(previous.payload, input.log))) {
        throw new HttpError(409, 'LOG_CONFLICT', 'Hay un registro con el mismo identificador y otro contenido.');
      }
      if (!previous) additions.push({ id: input.log.id, kind: input.kind, payload: input.log });
    }
    if (!additions.length) return false;
    await client.query(`INSERT INTO personal_log (user_id, id, kind, payload)
      SELECT $1, logs.id, logs.kind, logs.payload FROM jsonb_to_recordset($2::jsonb) AS logs(id text, kind text, payload jsonb)`, [owner.id, JSON.stringify(additions)]);
    return true;
  }

  addLog(owner: Owner, input: LogInput): Promise<ServerState> {
    return this.transaction(owner, async (client) => this.insertLogs(client, owner, [input]));
  }

  deleteLog(owner: Owner, id: string): Promise<ServerState> {
    return this.transaction(owner, async (client) => {
      // Unknown IDs also get tombstones, so a delayed create cannot resurrect them.
      const changed = await client.query(`INSERT INTO personal_log (user_id, id, kind, payload, deleted)
        VALUES ($1, $2, 'workout', NULL, true)
        ON CONFLICT (user_id, id) DO UPDATE SET payload = NULL, deleted = true WHERE NOT personal_log.deleted
        RETURNING id`, [owner.id, id]);
      return Boolean(changed.rowCount);
    });
  }

  import(owner: Owner, input: ImportInput): Promise<ServerState> {
    return this.transaction(owner, async (client, row) => {
      let changed = false;
      if (input.includeSettings) {
        if (input.data.version !== 2) throw new HttpError(400, 'INVALID_INPUT', 'El archivo no contiene ajustes personales.');
        const existingLogs = await client.query('SELECT 1 FROM personal_log WHERE user_id = $1 LIMIT 1', [owner.id]);
        // Explicit full restore on a pristine account preserves a portable history.
        // Any prior edit or tombstone makes the ordinary immutable-history rule apply.
        const restoreEmptyAccount = row.revision === 0 && existingLogs.rowCount === 0;
        changed = this.replaceSettings(row, input.data.settings, input.expectedRevision, restoreEmptyAccount);
      }
      const progress = input.data.version === 2 ? (input.data as PersonalData).progress : input.data;
      const inputs: LogInput[] = [
        ...progress.workouts.map((log) => ({ kind: 'workout' as const, log })),
        ...progress.cardio.map((log) => ({ kind: 'cardio' as const, log })),
      ];
      return await this.insertLogs(client, owner, inputs) || changed;
    });
  }
}
