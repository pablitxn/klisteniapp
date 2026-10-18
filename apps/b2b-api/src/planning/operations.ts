import { createHash } from 'node:crypto';
import { HttpError, denied } from '../errors.ts';
import type { AuthorizedProductContext } from '../product-context.ts';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const planningHash = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');

export function requirePlanning(context: AuthorizedProductContext): void {
  if (
    context.accessMode !== 'active' ||
    !context.branchId ||
    context.role === 'member' ||
    !context.capabilities.has('edit-planning')
  )
    throw denied();
}

export function requireHistory(context: AuthorizedProductContext, memberId: string): void {
  if (
    context.accessMode !== 'active' ||
    !context.branchId ||
    !context.capabilities.has('read-training-history') ||
    (context.role === 'member' && context.actorId !== memberId)
  )
    throw denied();
}

export async function planningLock(
  context: AuthorizedProductContext,
  family: string,
  id: string,
): Promise<void> {
  await context.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    canonicalJson([context.organizationId, context.branchId, family, id]),
  ]);
}

/** Authorization runs before this helper, including before an exact replay.
 * Lock the actor/operation across branches, then the resource; concurrent creates
 * cannot both observe revision zero. Outer ACCESS owns BEGIN/COMMIT/ROLLBACK. */
export async function planningOperation<T>(
  context: AuthorizedProductContext,
  action: string,
  resourceId: string,
  input: { operationId: string; expectedRevision: number },
  perform: () => Promise<T>,
): Promise<T> {
  await context.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    canonicalJson([context.organizationId, context.actorId, 'operation', input.operationId]),
  ]);
  const requestHash = planningHash({ action, branchId: context.branchId, resourceId, input });
  const previous = (
    await context.db.query<{ request_hash: string; response: T }>(
      'SELECT request_hash,response FROM b2b_operation_receipt WHERE organization_id=$1 AND actor_id=$2 AND operation_id=$3',
      [context.organizationId, context.actorId, input.operationId],
    )
  ).rows[0];
  if (previous) {
    if (previous.request_hash !== requestHash)
      throw new HttpError(409, 'OPERATION_CONFLICT', 'Ese envío ya contiene otros cambios.');
    return previous.response;
  }
  const result = await perform();
  const revision = input.expectedRevision + 1;
  await context.db.query(
    'INSERT INTO b2b_operation_receipt(organization_id,branch_id,actor_id,operation_id,resource_id,revision,request_hash,response) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      context.organizationId,
      context.branchId,
      context.actorId,
      input.operationId,
      resourceId,
      revision,
      requestHash,
      result,
    ],
  );
  return result;
}

export async function planningAudit(
  context: AuthorizedProductContext,
  action: string,
  resourceId: string,
  operationId: string,
  before: number,
  after: number,
  changedFields: readonly string[],
): Promise<void> {
  await context.db.query(
    'INSERT INTO b2b_audit(organization_id,branch_id,actor_id,action,resource_id,operation_id,before_revision,after_revision,changed_fields) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [
      context.organizationId,
      context.branchId,
      context.actorId,
      action,
      resourceId,
      operationId,
      before,
      after,
      JSON.stringify(changedFields),
    ],
  );
}

export function changedFields(before: object | null, after: object): string[] {
  const old = before as Record<string, unknown> | null;
  return Object.entries(after)
    .filter(([key, value]) => !old || canonicalJson(old[key]) !== canonicalJson(value))
    .map(([key]) => key);
}
