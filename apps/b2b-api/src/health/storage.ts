import { createHash } from 'node:crypto';
import { OwnHealthSchema } from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductIdentityContext } from '../product-context.ts';
import { parseProductHealth } from '../product-health-adapter.ts';
import { HttpError } from '../errors.ts';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const healthHash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

export async function readOwnerHealth(
  context: Pick<AuthorizedProductIdentityContext, 'db'>,
  ownerId: string,
) {
  const row = (
    await context.db.query('SELECT revision,data FROM b2b_health WHERE owner_id=$1', [ownerId])
  ).rows[0];
  const empty = {
    version: 1,
    profile: {},
    measurements: [],
    sleep: [],
    activity: [],
    nutrition: [],
    supplements: [],
    goals: [],
  };
  return OwnHealthSchema.parse({
    schemaVersion: 2,
    ownerId,
    revision: row?.revision ?? 0,
    data: parseProductHealth(row?.data ?? empty),
  });
}

export async function healthReceipt(
  context: AuthorizedProductIdentityContext,
  operationId: string,
  requestHash: string,
): Promise<unknown | undefined> {
  const row = (
    await context.db.query(
      'SELECT request_hash,response FROM b2b_health_operation WHERE owner_id=$1 AND operation_id=$2',
      [context.actorId, operationId],
    )
  ).rows[0];
  if (!row) return undefined;
  if (row.request_hash !== requestHash)
    throw new HttpError(409, 'OPERATION_CONFLICT', 'La operación ya se usó con otro contenido.');
  return row.response;
}

export async function saveHealthReceipt(
  context: AuthorizedProductIdentityContext,
  operationId: string,
  requestHash: string,
  revision: number,
  response: unknown,
) {
  await context.db.query(
    'INSERT INTO b2b_health_operation(owner_id,operation_id,request_hash,revision,response) VALUES($1,$2,$3,$4,$5)',
    [context.actorId, operationId, requestHash, revision, response],
  );
}

export async function writeOwnerHealth(
  context: AuthorizedProductIdentityContext,
  data: unknown,
  revision: number,
) {
  const response = OwnHealthSchema.parse({
    schemaVersion: 2,
    ownerId: context.actorId,
    revision,
    data: parseProductHealth(data),
  });
  await context.db.query(
    `INSERT INTO b2b_health(owner_id,revision,data) VALUES($1,$2,$3)
    ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=clock_timestamp()`,
    [context.actorId, revision, response.data],
  );
  return response;
}
