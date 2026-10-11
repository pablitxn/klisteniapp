import { createHmac } from 'node:crypto';
import type { AccountAdministration } from './accounts.ts';

export const RECOVERY_COOLDOWN_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_EMAIL_HOUR = 3;
const MAX_PENDING = 32;
const MAX_ACTIVE = 2;
type Reservation = { start(): void; cancel(): void };

/** Public responses reserve uniform email quotas before any account lookup.
 * Work starts only after the HTTP response finishes. The bounded queue lives in
 * this process; persistent quotas survive restarts, queued mail does not.
 */
export class PublicRecovery {
  private readonly administration: AccountAdministration;
  private accepting = true;
  private reserved = 0;
  private active = 0;
  private readonly pending: string[] = [];
  private readonly idleWaiters = new Set<() => void>();

  constructor(administration: AccountAdministration) { this.administration = administration; }

  async reserve(email: string): Promise<Reservation | undefined> {
    // Capacity is claimed synchronously, before spending the persistent email
    // quota. Concurrent HTTP requests cannot oversubscribe pending reservations.
    if (!this.accepting || this.reserved + this.pending.length >= MAX_PENDING) return;
    this.reserved += 1;
    try {
      if (!await this.claimEmail(email)) {
        this.reserved -= 1;
        this.notifyIdle();
        return;
      }
    } catch (error) {
      this.reserved -= 1;
      this.notifyIdle();
      throw error;
    }
    let released = false;
    return {
      start: () => {
        if (released) return;
        released = true;
        this.reserved -= 1;
        this.pending.push(email);
        // No account query or mail work runs inside the response's finish event.
        setImmediate(() => this.drain());
      },
      cancel: () => {
        if (released) return;
        released = true;
        this.reserved -= 1;
        this.notifyIdle();
      },
    };
  }

  private async claimEmail(email: string): Promise<boolean> {
    const { pool, config } = this.administration;
    const now = this.administration.now();
    const key = (scope: string) => createHmac('sha256', config.secret).update(`public-recovery:${scope}:${email}`).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // A rolling cooldown, not a fixed time bucket: adjacent requests cannot
      // bypass it at a minute boundary. Repeats never extend its expiry.
      const cooldown = await client.query<{ count: number }>(`INSERT INTO account_rate_limit (key, count, expires_at) VALUES ($1,1,$2)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN account_rate_limit.expires_at <= $3 THEN 1 ELSE account_rate_limit.count + 1 END,
          expires_at = CASE WHEN account_rate_limit.expires_at <= $3 THEN EXCLUDED.expires_at ELSE account_rate_limit.expires_at END
        RETURNING count`, [key('cooldown'), new Date(now.getTime() + RECOVERY_COOLDOWN_MS), now]);
      let accepted = cooldown.rows[0].count === 1;
      if (accepted) {
        const hour = Math.floor(now.getTime() / HOUR_MS);
        const hourly = await client.query<{ count: number }>(`INSERT INTO account_rate_limit (key, count, expires_at) VALUES ($1,1,$2)
          ON CONFLICT (key) DO UPDATE SET count = account_rate_limit.count + 1 RETURNING count`, [key(`hour:${hour}`), new Date((hour + 2) * HOUR_MS)]);
        accepted = hourly.rows[0].count <= MAX_PER_EMAIL_HOUR;
      }
      await client.query('COMMIT');
      return accepted;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private drain(): void {
    while (this.active < MAX_ACTIVE && this.pending.length) {
      const email = this.pending.shift()!;
      this.active += 1;
      void this.deliver(email).catch(() => {
        // No address, token, SQL, SMTP response or error object in the log.
        console.error('Public password recovery operation failed');
      }).finally(() => { this.active -= 1; this.drain(); });
    }
    this.notifyIdle();
  }

  private async deliver(email: string): Promise<void> {
    const service = this.administration;
    // Missing transport produces the same public answer and never invalidates
    // a link that an administrator has already shared with the person.
    if (!service.mailer) return;
    const issued = await service.transaction(async client => {
      const found = await client.query<{ id: string }>('SELECT id FROM auth_user WHERE email = $1', [email]);
      if (!found.rows[0]) return null;
      const user = await service.findTarget(client, found.rows[0].id);
      if (user.disabled) return null;
      const now = service.now();
      const recent = await client.query(`SELECT id FROM account_token WHERE email = $1 AND kind = 'recovery'
        AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2 AND created_at > $3 LIMIT 1`,
      [email, now, new Date(now.getTime() - RECOVERY_COOLDOWN_MS)]);
      if (recent.rowCount) return null;
      return service.createToken(client, { email: user.email, name: user.name, kind: 'recovery', role: user.role, userId: user.id });
    });
    if (issued) await service.finishIssue(issued, true);
  }

  /** Tests and graceful shutdown can wait without exposing account outcomes. */
  idle(): Promise<void> {
    if (!this.active && !this.pending.length && !this.reserved) return Promise.resolve();
    return new Promise(resolve => this.idleWaiters.add(resolve));
  }
  close(): Promise<void> { this.accepting = false; return this.idle(); }
  private notifyIdle(): void {
    if (this.active || this.pending.length || this.reserved) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }
}
