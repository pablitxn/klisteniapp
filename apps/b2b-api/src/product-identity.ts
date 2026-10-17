import type { PoolClient } from 'pg';
import type { DomainContext } from './domain-context.ts';
import { requireActiveDomain } from './white-label-access.ts';
import { HttpError } from './errors.ts';

/** Bound identity is sufficient for logout; it grants no gym operation and does
 * not require active membership, product activation or a selected branch. */
export async function requireIdentityRealm(
  db: PoolClient,
  actorId: string,
  sessionId: string,
  domain?: DomainContext | null,
) {
  const session = await db.query(
    `SELECT id FROM b2b_auth_session WHERE id=$1 AND "userId"=$2 AND "expiresAt">clock_timestamp() FOR SHARE`,
    [sessionId, actorId],
  );
  if (!session.rowCount)
    throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
  const binding = (
    await db.query(
      'SELECT organization_id,domain_host,domain_generation FROM b2b_session_context WHERE session_id=$1 FOR SHARE',
      [sessionId],
    )
  ).rows[0];
  if (!domain) {
    if (binding)
      throw new HttpError(401, 'BRAND_SESSION_REQUIRED', 'Iniciá sesión en este espacio.');
    return;
  }
  await requireActiveDomain(db, domain);
  if (
    !binding ||
    binding.organization_id !== domain.organizationId ||
    binding.domain_host !== domain.host ||
    binding.domain_generation !== domain.generation
  )
    throw new HttpError(401, 'BRAND_SESSION_REQUIRED', 'Iniciá sesión en esta marca.');
}

/** An early deny gate only. Operational handlers must still acquire their own
 * current authorization; this result never grants an operational capability. */
export async function selectedMembershipMode(
  db: PoolClient,
  actorId: string,
  organizationId: string,
  sessionId: string,
  domain?: DomainContext | null,
) {
  if (domain && domain.organizationId !== organizationId)
    throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
  await db.query('SELECT id FROM b2b_organization WHERE id=$1 FOR SHARE', [organizationId]);
  await requireIdentityRealm(db, actorId, sessionId, domain);
  const member = (
    await db.query(
      'SELECT active FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 FOR SHARE',
      [organizationId, actorId],
    )
  ).rows[0];
  return member ? (member.active ? 'active' : 'export-only') : null;
}
