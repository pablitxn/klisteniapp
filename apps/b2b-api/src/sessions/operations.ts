import { createHash } from 'node:crypto';
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions';
import type { AuthorizedProductContext } from '../product-context.ts';
import { denied, HttpError } from '../errors.ts';

export async function authorizeRecords(
  context: AuthorizedProductContext,
  memberId: string,
  write = false,
) {
  if (context.accessMode !== 'active')
    throw new HttpError(403, 'CONTEXT_REVOKED', 'Current active access is required.');
  if (write && (context.actorId !== memberId || !context.capabilities.has('edit-own-sessions')))
    throw denied();
  if (!write && !context.capabilities.has('read-training-history') && context.actorId !== memberId)
    throw denied();
  await context.authorizeMember(memberId, write ? 'planning' : 'history');
}
export function requestHash(context: AuthorizedProductContext, action: string, input: unknown) {
  return createHash('sha256')
    .update(
      canonicalJson({
        organizationId: context.organizationId,
        branchId: context.branchId,
        actorId: context.actorId,
        action,
        input,
      }),
    )
    .digest('hex');
}
export async function lockKey(context: AuthorizedProductContext, key: string) {
  await context.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    canonicalJson([context.organizationId, context.branchId, key]),
  ]);
}
export async function replayOperation(
  context: AuthorizedProductContext,
  operationId: string,
  hash: string,
): Promise<unknown | undefined> {
  // The primary receipt identity excludes branch. Include no branch in this lock,
  // so accidental operation reuse on another branch serializes and conflicts.
  await context.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    canonicalJson([context.organizationId, context.actorId, operationId]),
  ]);
  const result = await context.db.query(
    'SELECT request_hash,response FROM b2b_operation_receipt WHERE organization_id=$1 AND actor_id=$2 AND operation_id=$3',
    [context.organizationId, context.actorId, operationId],
  );
  if (!result.rows[0]) return undefined;
  if (result.rows[0].request_hash !== hash)
    throw new HttpError(
      409,
      'OPERATION_CONFLICT',
      'Operation ID was already used for different content.',
    );
  return result.rows[0].response;
}
export async function recordOperation(
  context: AuthorizedProductContext,
  input: { operationId: string },
  resourceId: string,
  beforeRevision: number,
  revision: number,
  hash: string,
  response: unknown,
  action: string,
  changedFields: string[],
  acceptedAt: string,
) {
  await context.db.query(
    `INSERT INTO b2b_operation_receipt(organization_id,branch_id,actor_id,operation_id,resource_id,revision,request_hash,response,accepted_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      context.organizationId,
      context.branchId,
      context.actorId,
      input.operationId,
      resourceId,
      revision,
      hash,
      response,
      acceptedAt,
    ],
  );
  await context.db.query(
    `INSERT INTO b2b_audit(organization_id,branch_id,actor_id,operation_id,resource_id,action,before_revision,after_revision,changed_fields,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      context.organizationId,
      context.branchId,
      context.actorId,
      input.operationId,
      resourceId,
      action,
      beforeRevision,
      revision,
      JSON.stringify(changedFields),
      acceptedAt,
    ],
  );
}
