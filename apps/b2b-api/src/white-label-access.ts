import type { PoolClient } from 'pg';
import type { Role } from '@klisteniapp/b2b-contracts';
import type { DomainContext } from './domain-context.ts';
import { denied, HttpError, missing } from './errors.ts';

export type WorkContext = {
  domain?: DomainContext | null;
  branchId?: string;
  role?: string;
  history?: boolean;
};

/** Invitation acceptance precedes brand membership but still requires a live domain binding. */
export async function requireActiveDomain(db: PoolClient, domain: DomainContext) {
  if (
    !(
      await db.query(
        `SELECT host FROM b2b_domain WHERE host=$1 AND organization_id=$2 AND generation=$3
    AND status='active' AND verified_at IS NOT NULL AND dns_verified_at IS NOT NULL
    AND tls_verified_at IS NOT NULL AND tls_expires_at>clock_timestamp() FOR SHARE`,
        [domain.host, domain.organizationId, domain.generation],
      )
    ).rowCount
  )
    throw new HttpError(421, 'DOMAIN_UNAVAILABLE', 'Dominio no disponible.');
}

/** Called again inside the organization transaction after acquiring its lock.
 * A request that waited behind revocation must not use its earlier resolution. */
export async function requireBrandSession(
  db: PoolClient,
  actorId: string,
  sessionId: string,
  domain: DomainContext,
) {
  const result = await db.query(
    `SELECT s.session_id FROM b2b_session_context s
     JOIN b2b_domain d ON d.host=s.domain_host AND d.organization_id=s.organization_id
     JOIN b2b_membership m ON m.organization_id=s.organization_id AND m.user_id=$2 AND m.active
     WHERE s.session_id=$1 AND s.organization_id=$3 AND s.domain_host=$4
       AND s.domain_generation=$5 AND d.generation=s.domain_generation
       AND d.status='active' AND d.verified_at IS NOT NULL AND d.dns_verified_at IS NOT NULL
       AND d.tls_verified_at IS NOT NULL AND d.tls_expires_at>clock_timestamp()
     FOR SHARE OF d,m`,
    [sessionId, actorId, domain.organizationId, domain.host, domain.generation],
  );
  if (!result.rowCount)
    throw new HttpError(
      401,
      'BRAND_SESSION_REQUIRED',
      'Iniciá sesión en esta marca para continuar.',
    );
}

export async function authorizeWorkContext(
  db: PoolClient,
  actorId: string,
  organizationId: string,
  membershipRole: Role,
  write: boolean,
  work: WorkContext,
): Promise<{ role: Role; branchId?: string; domain?: DomainContext; history?: boolean }> {
  if (!work.domain) return { role: membershipRole };
  if (work.domain.organizationId !== organizationId) throw missing();
  if (work.history) {
    if (write) throw denied();
    return { role: 'member', domain: work.domain, history: true };
  }
  if (!work.branchId) {
    if (membershipRole !== 'admin') throw denied();
    return { role: 'admin', domain: work.domain };
  }
  const branch = await db.query<{ status: string }>(
    'SELECT status FROM b2b_branch WHERE organization_id=$1 AND id=$2 FOR SHARE',
    [organizationId, work.branchId],
  );
  if (!branch.rows[0]) throw missing();
  if (branch.rows[0].status !== 'active')
    throw new HttpError(403, 'BRANCH_ARCHIVED', 'Esta sede está archivada. Consultá el historial.');
  if (membershipRole === 'admin' && (!work.role || work.role === 'admin'))
    return { role: 'admin', branchId: work.branchId, domain: work.domain };
  if (!['coach', 'member'].includes(work.role ?? ''))
    throw new HttpError(400, 'ROLE_REQUIRED', 'Elegí la función con la que vas a trabajar.');
  const grant = await db.query(
    `SELECT 1 FROM b2b_branch_grant WHERE organization_id=$1 AND branch_id=$2
     AND user_id=$3 AND role=$4 AND active FOR SHARE`,
    [organizationId, work.branchId, actorId, work.role],
  );
  if (!grant.rowCount)
    throw new HttpError(
      403,
      'BRANCH_FORBIDDEN',
      'Ya no tenés acceso a esta sede con la función seleccionada.',
    );
  return { role: work.role as Role, branchId: work.branchId, domain: work.domain };
}
