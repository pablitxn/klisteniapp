import type { PoolClient } from 'pg';
import type { Asset, Brand, Role } from '@klisteniapp/b2b-contracts';
import { denied } from './errors.ts';
import type { DomainContext } from './domain-context.ts';

export type OrgRow = {
  id: string;
  slug: string;
  brand: Brand;
  service_enabled: boolean;
  service_ends_at: Date | null;
};

/** Supplied by B2BService.organization after locking and validating the session,
 * membership and (for writes) service contract. Modules reuse this transaction;
 * they must never open another connection or accept a tenant from request data. */
export type Context = {
  db: PoolClient;
  actorId: string;
  org: OrgRow;
  role: Role;
  branchId?: string;
  domain?: DomainContext;
  /** Own historical records only; this never grants operational branch access. */
  history?: boolean;
};
export type ValidateAssets = (context: Context, assets: Asset[]) => Promise<void>;

export function staff(context: Context) {
  if (context.role === 'member') throw denied();
}

export function admin(context: Context) {
  if (context.role !== 'admin') throw denied();
}

export async function audit(context: Context, action: string, resourceId: string) {
  await context.db.query(
    'INSERT INTO b2b_audit(organization_id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)',
    [context.org.id, context.actorId, action, resourceId],
  );
}
