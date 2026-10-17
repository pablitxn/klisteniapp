import {
  ConsentedHealthSchema,
  HealthConsentSchema,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type {
  AuthorizedProductContext,
  AuthorizedProductIdentityContext,
} from '../product-context.ts';
import { conflict, HttpError, missing } from '../errors.ts';
import { currentHealthContext, currentHealthTarget, lockHealthOwner } from './access.ts';
import { healthHash, healthReceipt, readOwnerHealth, saveHealthReceipt } from './storage.ts';

type Consent = ProductOutput<'grantHealthConsent'>;
type Row = {
  organization_id: string;
  branch_id: string;
  owner_id: string;
  id: string;
  revision: number;
  categories: Consent['categories'];
  audience: Consent['audience'];
  disclosure_version: number;
  granted_at: Date;
  revoked_at: Date | null;
};
export function consentDto(row: Row): Consent {
  return HealthConsentSchema.parse({
    schemaVersion: 2,
    id: row.id,
    ownerId: row.owner_id,
    scope: { organizationId: row.organization_id, branchId: row.branch_id },
    revision: row.revision,
    status: row.revoked_at ? 'revoked' : 'active',
    categories: row.categories,
    audience: row.audience,
    disclosureVersion: row.disclosure_version,
    grantedAt: row.granted_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
  });
}

async function recordConsent(
  context: Pick<AuthorizedProductIdentityContext, 'db' | 'actorId' | 'organizationId'>,
  consent: Consent,
  reason: string,
  beforeRevision: number,
  operationId: string,
) {
  await context.db.query(
    `INSERT INTO b2b_health_consent_revision(organization_id,branch_id,owner_id,consent_id,revision,snapshot,actor_id,reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      context.organizationId,
      consent.scope.branchId,
      consent.ownerId,
      consent.id,
      consent.revision,
      consent,
      context.actorId,
      reason,
    ],
  );
  // Only revision references and field names; never health values or import data.
  await context.db.query(
    `INSERT INTO b2b_audit(organization_id,branch_id,actor_id,operation_id,action,resource_id,before_revision,after_revision,changed_fields)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      context.organizationId,
      consent.scope.branchId,
      context.actorId,
      operationId,
      `health.consent.${reason}`,
      consent.id,
      beforeRevision,
      consent.revision,
      JSON.stringify(['status', 'categories', 'audience', 'disclosureVersion']),
    ],
  );
}

export async function listHealthConsents(context: AuthorizedProductContext) {
  await currentHealthContext(context, 'manage-own-health');
  // Settings may show all this owner's branches in this brand; never other owners/brands.
  return (
    await context.db.query<Row>(
      'SELECT * FROM b2b_health_consent WHERE organization_id=$1 AND owner_id=$2 ORDER BY branch_id,id',
      [context.organizationId, context.actorId],
    )
  ).rows.map(consentDto);
}

export async function grantHealthConsent(
  context: AuthorizedProductContext,
  input: ProductInput<'grantHealthConsent'>,
) {
  await currentHealthContext(context, 'manage-own-health');
  await lockHealthOwner(context, context.actorId);
  const hash = healthHash({
    kind: 'consent.grant',
    scope: [context.organizationId, context.branchId],
    input,
  });
  const receipt = await healthReceipt(context, input.operationId, hash);
  if (receipt) {
    const accepted = HealthConsentSchema.parse(receipt);
    const current = (
      await context.db.query<Row>(
        'SELECT * FROM b2b_health_consent WHERE organization_id=$1 AND branch_id=$2 AND owner_id=$3 AND id=$4',
        [context.organizationId, context.branchId, context.actorId, input.id],
      )
    ).rows[0];
    // Replaying a grant after revoke must never resurrect an active UI response.
    if (!current || current.revoked_at || current.revision !== accepted.revision) throw conflict();
    return accepted;
  }
  const prior = (
    await context.db.query<Row>(
      'SELECT * FROM b2b_health_consent WHERE organization_id=$1 AND branch_id=$2 AND id=$3 FOR UPDATE',
      [context.organizationId, context.branchId, input.id],
    )
  ).rows[0];
  if (prior && prior.owner_id !== context.actorId) throw missing();
  if ((prior?.revision ?? 0) !== input.expectedRevision) throw conflict();
  const active = (
    await context.db.query(
      'SELECT id FROM b2b_health_consent WHERE organization_id=$1 AND branch_id=$2 AND owner_id=$3 AND revoked_at IS NULL AND id<>$4',
      [context.organizationId, context.branchId, context.actorId, input.id],
    )
  ).rowCount;
  if (active) throw conflict();
  // Reusing a revoked ID is an explicit new grant, with a new revision and time.
  const row = (
    await context.db.query<Row>(
      `INSERT INTO b2b_health_consent(organization_id,branch_id,owner_id,id,revision,categories,audience,disclosure_version)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(organization_id,branch_id,id) DO UPDATE SET revision=excluded.revision,categories=excluded.categories,audience=excluded.audience,
    disclosure_version=excluded.disclosure_version,granted_at=clock_timestamp(),revoked_at=NULL
    WHERE b2b_health_consent.owner_id=excluded.owner_id AND b2b_health_consent.revision=$9 RETURNING *`,
      [
        context.organizationId,
        context.branchId,
        context.actorId,
        input.id,
        input.expectedRevision + 1,
        JSON.stringify(input.categories),
        input.audience,
        input.disclosureVersion,
        input.expectedRevision,
      ],
    )
  ).rows[0];
  // Two different owners may race on a previously absent caller-selected ID.
  // The unique-key conflict must never update the other owner's grant.
  if (!row) throw conflict();
  const response = consentDto(row);
  await recordConsent(context, response, 'granted', input.expectedRevision, input.operationId);
  await saveHealthReceipt(context, input.operationId, hash, response.revision, response);
  return response;
}

export async function revokeHealthConsent(
  context: AuthorizedProductContext,
  input: ProductInput<'revokeHealthConsent'>,
) {
  await currentHealthContext(context, 'manage-own-health');
  await lockHealthOwner(context, context.actorId);
  const hash = healthHash({
    kind: 'consent.revoke',
    scope: [context.organizationId, context.branchId],
    input,
  });
  const receipt = await healthReceipt(context, input.operationId, hash);
  if (receipt) return HealthConsentSchema.parse(receipt);
  const row = (
    await context.db.query<Row>(
      'SELECT * FROM b2b_health_consent WHERE organization_id=$1 AND branch_id=$2 AND owner_id=$3 AND id=$4 FOR UPDATE',
      [context.organizationId, context.branchId, context.actorId, input.id],
    )
  ).rows[0];
  if (!row) throw missing();
  if (row.revision !== input.expectedRevision) throw conflict();
  let response = consentDto(row);
  if (!row.revoked_at) {
    const updated = (
      await context.db.query<Row>(
        `UPDATE b2b_health_consent SET revision=revision+1,revoked_at=clock_timestamp()
      WHERE organization_id=$1 AND branch_id=$2 AND owner_id=$3 AND id=$4 RETURNING *`,
        [context.organizationId, context.branchId, context.actorId, input.id],
      )
    ).rows[0]!;
    response = consentDto(updated);
    await recordConsent(context, response, 'revoked', row.revision, input.operationId);
  }
  await saveHealthReceipt(context, input.operationId, hash, response.revision, response);
  return response;
}

export const HEALTH_RESPONSE_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, private, max-age=0',
  Pragma: 'no-cache',
  'Surrogate-Control': 'no-store',
});
export const healthDisclosureGeneration = (view: ProductOutput<'consentedHealth'>) =>
  `${view.scope.organizationId}:${view.scope.branchId}:${view.ownerId}:${view.consentId}:${view.consentRevision}`;

/** Stream maintenance authorizes metadata only; it never reads health records. */
export async function authorizeHealthDisclosure(
  context: AuthorizedProductContext,
  memberId: string,
) {
  await currentHealthContext(context, 'read-consented-health');
  await currentHealthTarget(context, memberId);
  await lockHealthOwner(context, memberId);
  const row = (
    await context.db.query<Row>(
      `SELECT * FROM b2b_health_consent WHERE organization_id=$1 AND branch_id=$2 AND owner_id=$3 AND revoked_at IS NULL FOR SHARE`,
      [context.organizationId, context.branchId, memberId],
    )
  ).rows[0];
  if (!row)
    throw new HttpError(
      403,
      'CONSENT_REQUIRED',
      'Se necesita consentimiento vigente para ver estos datos.',
    );
  return consentDto(row);
}

export async function consentedHealth(
  context: AuthorizedProductContext,
  memberId: string,
  now: Date,
) {
  const consent = await authorizeHealthDisclosure(context, memberId);
  const own = await readOwnerHealth(context, memberId);
  return ConsentedHealthSchema.parse({
    schemaVersion: 2,
    ownerId: memberId,
    consentId: consent.id,
    consentRevision: consent.revision,
    scope: consent.scope,
    viewedAt: now.toISOString(),
    categories: consent.categories.map((category) => ({ category, records: own.data[category] })),
  });
}

/** ACCESS must call this in a fresh authorized transaction immediately before
 * dispatching a previously queued projection. Serialize the refreshed result,
 * never the captured bytes. A revoked/replaced generation is discarded. */
export async function revalidateHealthDisclosure(
  context: AuthorizedProductContext,
  prepared: ProductOutput<'consentedHealth'>,
  now = new Date(),
) {
  if (
    prepared.scope.organizationId !== context.organizationId ||
    prepared.scope.branchId !== context.branchId
  )
    throw new HttpError(403, 'CONSENT_REQUIRED', 'El permiso de salud cambió.');
  const current = await consentedHealth(context, prepared.ownerId, now);
  if (healthDisclosureGeneration(current) !== healthDisclosureGeneration(prepared))
    throw new HttpError(403, 'CONSENT_REQUIRED', 'El permiso de salud cambió.');
  return current;
}

/** Trusted WP06 hook: run after its authorized inactive transition, before
 * committing that SAME transaction. Repeated calls append nothing twice. */
export async function revokeHealthForInactiveMembership(
  context: Pick<AuthorizedProductIdentityContext, 'db' | 'organizationId' | 'actorId'>,
  ownerId: string,
  operationId: string,
) {
  const membership = (
    await context.db.query(
      'SELECT active FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 FOR UPDATE',
      [context.organizationId, ownerId],
    )
  ).rows[0];
  if (!membership || membership.active) throw conflict();
  await lockHealthOwner(context, ownerId);
  const rows = (
    await context.db.query<Row>(
      `UPDATE b2b_health_consent SET revision=revision+1,revoked_at=clock_timestamp()
    WHERE organization_id=$1 AND owner_id=$2 AND revoked_at IS NULL RETURNING *`,
      [context.organizationId, ownerId],
    )
  ).rows;
  const consents = rows.map(consentDto);
  for (const consent of consents)
    await recordConsent(context, consent, 'membership-inactive', consent.revision - 1, operationId);
  return consents;
}
