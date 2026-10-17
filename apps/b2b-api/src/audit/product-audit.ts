import { createHash } from 'node:crypto';
import {
  AuditChangeSchema,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';
import { denied, HttpError } from '../errors.ts';

export type ProductAuditMutation = {
  action: string;
  resourceId: string;
  operationId: string;
  beforeRevision: number;
  afterRevision: number;
  changedFields: string[];
};

/** Values live in immutable resource revisions. General audit stores names and
 * revision references only; never pass health or actual measurements here. */
export async function writeProductAudit(c: AuthorizedProductContext, change: ProductAuditMutation) {
  if (
    change.changedFields.length > 100 ||
    change.changedFields.some((field) => !/^[A-Za-z][A-Za-z0-9_.[\]-]{0,99}$/.test(field))
  )
    throw new Error('Audit metadata must contain bounded field names');
  await c.db.query(
    `INSERT INTO b2b_audit(organization_id,branch_id,actor_id,action,resource_id,
       operation_id,before_revision,after_revision,changed_fields)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      c.organizationId,
      c.branchId,
      c.actorId,
      change.action,
      change.resourceId,
      change.operationId,
      change.beforeRevision,
      change.afterRevision,
      JSON.stringify(change.changedFields),
    ],
  );
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const productRequestHash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

/** Caller authorizes the current actor and scope before looking up a receipt.
 * The organization lock serializes acceptance with permission revocation. */
export async function productOperation<T>(
  c: AuthorizedProductContext,
  action: string,
  input: { operationId: string; expectedRevision: number },
  resourceId: string,
  mutate: () => Promise<{ response: T; revision: number }>,
): Promise<T> {
  const requestHash = productRequestHash({ action, input });
  const prior = (
    await c.db.query<{
      branch_id: string;
      resource_id: string;
      request_hash: string;
      response: T;
    }>(
      `SELECT branch_id,resource_id,request_hash,response FROM b2b_operation_receipt
     WHERE organization_id=$1 AND actor_id=$2 AND operation_id=$3`,
      [c.organizationId, c.actorId, input.operationId],
    )
  ).rows[0];
  if (prior) {
    if (
      prior.request_hash !== requestHash ||
      prior.branch_id !== c.branchId ||
      prior.resource_id !== resourceId
    )
      throw new HttpError(409, 'OPERATION_CONFLICT', 'La operación ya se usó con otros datos.');
    return prior.response;
  }
  const { response, revision } = await mutate();
  await c.db.query(
    `INSERT INTO b2b_operation_receipt(organization_id,branch_id,actor_id,operation_id,
       resource_id,revision,request_hash,response) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      c.organizationId,
      c.branchId,
      c.actorId,
      input.operationId,
      resourceId,
      revision,
      requestHash,
      JSON.stringify(response),
    ],
  );
  return response;
}

const planningAction =
  /^(?:program\.|assignment\.|planning\.|routine\.|goal\.|enrollment\.|period\.|schedule\.|occurrence\.)/;
export async function readProductAudit(
  c: AuthorizedProductContext,
  input: ProductInput<'audit'>,
): Promise<ProductOutput<'audit'>> {
  if (!c.capabilities.has('edit-planning')) throw denied();
  const administrator = c.capabilities.has('manage-people');
  const rows = (
    await c.db.query(
      `SELECT * FROM b2b_audit WHERE organization_id=$1 AND resource_id=$2
     AND (branch_id=$3 OR ($4 AND branch_id IS NULL)) ORDER BY created_at,id`,
      [c.organizationId, input.id, c.branchId, administrator],
    )
  ).rows;
  return rows
    .filter((row) => administrator || planningAction.test(row.action))
    .map((row) =>
      AuditChangeSchema.parse({
        id: String(row.id),
        organizationId: row.organization_id,
        branchId: row.branch_id,
        actorId: row.actor_id,
        action: row.action,
        resourceId: row.resource_id,
        operationId: row.operation_id,
        beforeRevision: row.before_revision === null ? null : Number(row.before_revision),
        afterRevision: row.after_revision === null ? null : Number(row.after_revision),
        changedFields: row.changed_fields,
        createdAt: row.created_at.toISOString(),
      }),
    );
}
