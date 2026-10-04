import type { Pool, PoolClient } from 'pg';
import { HttpError } from './errors.ts';

export const TRIAL_DAYS = 15;
export type AccessRow = { trial_ends_at: Date | null; lifetime: boolean; paid_through: Date | null };
export type CloudAccess = {
  status: 'trial' | 'lifetime' | 'active' | 'expired';
  cloudWrite: boolean;
  trialEndsAt: string | null;
  paidThrough: string | null;
};

/** The deadline is exclusive: access expires at exactly the stored instant. */
export function describeAccess(row?: AccessRow, now = new Date()): CloudAccess {
  const status = row?.lifetime ? 'lifetime'
    : row?.paid_through && row.paid_through > now ? 'active'
      : row?.trial_ends_at && row.trial_ends_at > now ? 'trial' : 'expired';
  return { status, cloudWrite: status !== 'expired', trialEndsAt: row?.trial_ends_at?.toISOString() ?? null, paidThrough: row?.paid_through?.toISOString() ?? null };
}

/** Called in the same transaction that creates the account; never renews a trial. */
export async function initializeAccess(client: PoolClient, userId: string, lifetime = false, now = new Date()): Promise<void> {
  await client.query(`INSERT INTO account_access (user_id, trial_ends_at, lifetime)
    VALUES ($1,$2,$3) ON CONFLICT (user_id) DO NOTHING`, [userId, new Date(now.getTime() + TRIAL_DAYS * 86400000), lifetime]);
}

export class AccessRepository {
  pool: Pool;
  now: () => Date;
  constructor(pool: Pool, now = () => new Date()) { this.pool = pool; this.now = now; }
  async get(userId: string): Promise<CloudAccess> {
    const found = await this.pool.query<AccessRow>('SELECT trial_ends_at, lifetime, paid_through FROM account_access WHERE user_id = $1', [userId]);
    return describeAccess(found.rows[0], this.now());
  }
}

/** Run after lockUser, inside the state mutation transaction. */
export async function requireCloudAccess(client: PoolClient, userId: string, now = new Date()): Promise<void> {
  const found = await client.query<AccessRow>('SELECT trial_ends_at, lifetime, paid_through FROM account_access WHERE user_id = $1', [userId]);
  if (!describeAccess(found.rows[0], now).cloudWrite) {
    throw new HttpError(402, 'CLOUD_ACCESS_REQUIRED', 'Tu acceso a la nube venció. Podés descargar tus datos y seguir usando Klisteni gratis en este dispositivo.');
  }
}
