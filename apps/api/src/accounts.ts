import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { HttpError } from './errors.ts';
import { createAccountMailer, type AccountMailer } from './mail.ts';
import { EmailSchema, PasswordSchema } from './operator-service.ts';
import { lockUser } from './state.ts';

export const TokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const InvitationInputSchema = z.object({ email: EmailSchema, name: z.string().trim().min(1).max(100).optional(), sendEmail: z.boolean() }).strict();
export const DeliveryInputSchema = z.object({ sendEmail: z.boolean() }).strict();
export const ActivationInputSchema = z.object({ token: TokenSchema, name: z.string().trim().min(1).max(100), password: PasswordSchema }).strict();
export const RequestRecoveryInputSchema = z.object({ email: EmailSchema }).strict();
export const RecoveryInputSchema = z.object({ token: TokenSchema, password: PasswordSchema }).strict();
export const TokenInputSchema = z.object({ token: TokenSchema }).strict();
export const EmptyInputSchema = z.object({}).strict();
export type AdminActor = { id: string; sessionId: string };
type DeliveryStatus = 'not_requested' | 'smtp_accepted' | 'unavailable' | 'failed';
type TokenRow = {
  id: string; token_hash: string; email: string; name: string; kind: 'activation' | 'recovery'; role: 'admin' | 'user';
  user_id: string | null; created_by: string | null; created_at: Date; expires_at: Date;
  used_at: Date | null; revoked_at: Date | null; delivery_status: DeliveryStatus; smtp_accepted_at: Date | null;
};
type UserRow = { id: string; email: string; name: string; role: 'admin' | 'user'; disabled: boolean; createdAt: Date };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const invalidToken = () => new HttpError(400, 'INVALID_TOKEN', 'El enlace no es válido, venció o ya fue utilizado.');

export class AccountAdministration {
  pool: Pool;
  auth: Auth;
  config: Config;
  mailer: AccountMailer | null;
  now: () => Date;
  constructor(pool: Pool, auth: Auth, config: Config, mailer = createAccountMailer(config), now = () => new Date()) {
    this.pool = pool; this.auth = auth; this.config = config; this.mailer = mailer; this.now = now;
  }
  async transaction<T>(operation: (client: PoolClient) => Promise<T>, actor?: AdminActor): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serializes bootstrap, issuance, reissue, consumption and administrative
      // mutations. Existing account locks additionally coordinate login/passwords.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteniapp:account-administration', 0))");
      if (actor) {
        await lockUser(client, actor.id);
        await this.requireAdmin(client, actor);
      }
      const value = await operation(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async requireAdmin(client: Pool | PoolClient, actor: AdminActor): Promise<void> {
    const found = await client.query(`SELECT u.role, u.disabled FROM auth_user u
      JOIN auth_session s ON s."userId" = u.id
      WHERE u.id = $1 AND s.id = $2 AND s."expiresAt" > now()`, [actor.id, actor.sessionId]);
    if (!found.rows[0] || found.rows[0].disabled) throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
    if (found.rows[0].role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Esta acción está reservada al administrador.');
  }
  metadata(row: TokenRow) {
    const status = row.used_at ? 'used' : row.revoked_at ? 'revoked' : row.expires_at <= this.now() ? 'expired' : 'pending';
    return {
      id: row.id, email: row.email, name: row.name, kind: row.kind, role: row.role,
      createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(),
      status, deliveryStatus: row.delivery_status, smtpAcceptedAt: row.smtp_accepted_at?.toISOString() ?? null,
    };
  }
  async users(actor: AdminActor) {
    await this.requireAdmin(this.pool, actor);
    const result = await this.pool.query<UserRow>('SELECT id, email, name, role, disabled, "createdAt" FROM auth_user ORDER BY "createdAt", id LIMIT 1000');
    return { users: result.rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  }
  async invitations(actor: AdminActor) {
    await this.requireAdmin(this.pool, actor);
    const result = await this.pool.query<TokenRow>('SELECT * FROM account_token ORDER BY created_at DESC, id DESC LIMIT 200');
    return { invitations: result.rows.map(row => this.metadata(row)), mailConfigured: this.mailer !== null };
  }
  async createToken(client: PoolClient, input: { email: string; name: string; kind: TokenRow['kind']; role: TokenRow['role']; userId?: string; actorId?: string }) {
    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    const expires = new Date(now.getTime() + (input.kind === 'activation' ? 24 : 1) * 60 * 60 * 1000);
    // Replacing a link invalidates every older unused link of that purpose.
    await client.query('UPDATE account_token SET revoked_at = $3 WHERE email = $1 AND kind = $2 AND used_at IS NULL AND revoked_at IS NULL', [input.email, input.kind, now]);
    const result = await client.query<TokenRow>(`INSERT INTO account_token
      (id, token_hash, email, name, kind, role, user_id, created_by, created_at, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [randomUUID(), digest(token), input.email, input.name, input.kind, input.role, input.userId ?? null, input.actorId ?? null, now, expires]);
    return { row: result.rows[0], token };
  }
  async finishIssue(issued: { row: TokenRow; token: string }, sendEmail: boolean) {
    const path = issued.row.kind === 'activation' ? '/account/activate' : '/account/recover';
    const url = `${this.config.origin}${path}#token=${issued.token}`;
    let status: DeliveryStatus = 'not_requested';
    if (sendEmail) {
      if (!this.mailer) status = 'unavailable';
      else {
        try {
          const activation = issued.row.kind === 'activation';
          await this.mailer.send({
            to: issued.row.email,
            subject: activation ? 'Tu invitación a Klisteni' : 'Recuperá tu acceso a Klisteni',
            text: `${activation ? 'Te invitamos a usar Klisteni. Elegí tu nombre y una contraseña propia.' : 'Se solicitó restablecer tu contraseña de Klisteni. Al hacerlo se cerrarán tus sesiones anteriores.'}\n\n${url}\n\nEste enlace puede usarse una sola vez y vence el ${issued.row.expires_at.toISOString()}. Abrirlo no cambia tu cuenta: completá el formulario para continuar.\n\nSi no esperabas este correo, podés ignorarlo y contactar al administrador.`,
          });
          status = 'smtp_accepted';
        } catch { status = 'failed'; }
      }
    }
    const saved = await this.pool.query<TokenRow>(`UPDATE account_token SET delivery_status = $2,
      smtp_accepted_at = CASE WHEN $2 = 'smtp_accepted' THEN now() ELSE NULL END WHERE id = $1 RETURNING *`, [issued.row.id, status]);
    return { invitation: this.metadata(saved.rows[0]), url, delivery: { status } };
  }
  async invite(actor: AdminActor, input: z.infer<typeof InvitationInputSchema>) {
    const issued = await this.transaction(async client => {
      const existing = await client.query('SELECT id FROM auth_user WHERE email = $1', [input.email]);
      if (existing.rowCount) throw new HttpError(409, 'USER_EXISTS', 'Esa persona ya tiene una cuenta. Usá recuperación de acceso.');
      return this.createToken(client, { email: input.email, name: input.name ?? '', kind: 'activation', role: 'user', actorId: actor.id });
    }, actor);
    return this.finishIssue(issued, input.sendEmail);
  }
  async bootstrap(input: { email: string; name: string; sendEmail: boolean; reissue?: boolean }) {
    const email = EmailSchema.parse(input.email);
    const name = z.string().trim().min(1).max(100).parse(input.name);
    const issued = await this.transaction(async client => {
      if ((await client.query("SELECT id FROM auth_user WHERE role = 'admin' LIMIT 1")).rowCount) {
        throw new HttpError(409, 'BOOTSTRAP_CLOSED', 'Ya existe un administrador. El bootstrap está cerrado.');
      }
      if ((await client.query('SELECT id FROM auth_user WHERE email = $1', [email])).rowCount) {
        throw new HttpError(409, 'USER_EXISTS', 'El email ya pertenece a una cuenta. No se cambió su rol.');
      }
      const previous = await client.query<TokenRow>("SELECT t.* FROM account_bootstrap b JOIN account_token t ON t.id = b.token_id WHERE b.id = 'first-admin'");
      if (previous.rows[0]) {
        const row = previous.rows[0];
        if (row.used_at) throw new HttpError(409, 'BOOTSTRAP_CLOSED', 'El bootstrap ya fue utilizado.');
        if (row.email !== email) throw new HttpError(409, 'BOOTSTRAP_EMAIL_CONFLICT', 'El bootstrap inicial pertenece a otro email.');
        if (!input.reissue && !row.revoked_at && row.expires_at > this.now()) throw new HttpError(409, 'BOOTSTRAP_PENDING', 'La invitación inicial sigue vigente. Usá --reissue para invalidarla y emitir otra.');
      }
      const issued = await this.createToken(client, { email, name, kind: 'activation', role: 'admin' });
      await client.query("INSERT INTO account_bootstrap (id, token_id) VALUES ('first-admin', $1) ON CONFLICT (id) DO UPDATE SET token_id = EXCLUDED.token_id", [issued.row.id]);
      return issued;
    });
    return this.finishIssue(issued, input.sendEmail);
  }
  async findTarget(client: PoolClient, id: string): Promise<UserRow> {
    await lockUser(client, id);
    const found = await client.query<UserRow>('SELECT id, email, name, role, disabled, "createdAt" FROM auth_user WHERE id = $1', [id]);
    if (!found.rows[0]) throw new HttpError(404, 'USER_NOT_FOUND', 'No existe ese usuario.');
    return found.rows[0];
  }
  async recovery(actor: AdminActor | undefined, userId: string, sendEmail: boolean) {
    const issued = await this.transaction(async client => {
      const user = await this.findTarget(client, userId);
      if (user.disabled) throw new HttpError(409, 'USER_DISABLED', 'Habilitá la cuenta antes de emitir una recuperación.');
      return this.createToken(client, { email: user.email, name: user.name, kind: 'recovery', role: user.role, userId, actorId: actor?.id });
    }, actor);
    return this.finishIssue(issued, sendEmail);
  }
  async reissue(actor: AdminActor, id: string, sendEmail: boolean) {
    const issued = await this.transaction(async client => {
      const found = await client.query<TokenRow>('SELECT * FROM account_token WHERE id = $1', [id]);
      const old = found.rows[0];
      if (!old) throw new HttpError(404, 'INVITATION_NOT_FOUND', 'No existe ese enlace.');
      if (old.kind === 'activation') {
        if (old.role === 'admin') throw new HttpError(403, 'BOOTSTRAP_ONLY', 'Las invitaciones de administrador se gestionan mediante bootstrap.');
        if ((await client.query('SELECT id FROM auth_user WHERE email = $1', [old.email])).rowCount) throw new HttpError(409, 'USER_EXISTS', 'La cuenta ya existe. Usá recuperación de acceso.');
      } else {
        const user = await this.findTarget(client, old.user_id!);
        if (user.disabled) throw new HttpError(409, 'USER_DISABLED', 'La cuenta está deshabilitada.');
      }
      return this.createToken(client, { email: old.email, name: old.name, kind: old.kind, role: old.role, userId: old.user_id ?? undefined, actorId: actor.id });
    }, actor);
    return this.finishIssue(issued, sendEmail);
  }
  async revoke(actor: AdminActor, id: string) {
    await this.transaction(async client => {
      const found = await client.query('UPDATE account_token SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1 AND used_at IS NULL RETURNING id', [id, this.now()]);
      if (!found.rowCount && !(await client.query('SELECT id FROM account_token WHERE id = $1', [id])).rowCount) throw new HttpError(404, 'INVITATION_NOT_FOUND', 'No existe ese enlace.');
    }, actor);
    return { ok: true };
  }
  async operate(actor: AdminActor, id: string, action: 'disable' | 'enable' | 'revoke-sessions') {
    await this.transaction(async client => {
      const user = await this.findTarget(client, id);
      if (action === 'disable' && user.role === 'admin' && !user.disabled) {
        const active = await client.query("SELECT id FROM auth_user WHERE role = 'admin' AND NOT disabled");
        if ((active.rowCount ?? 0) <= 1) throw new HttpError(409, 'LAST_ADMIN', 'No se puede deshabilitar al último administrador.');
      }
      if (action !== 'revoke-sessions') await client.query('UPDATE auth_user SET disabled = $2, "updatedAt" = now() WHERE id = $1', [id, action === 'disable']);
      await client.query('DELETE FROM auth_session WHERE "userId" = $1', [id]);
      if (action === 'disable') await client.query('UPDATE account_token SET revoked_at = COALESCE(revoked_at, $2) WHERE user_id = $1 AND used_at IS NULL', [id, this.now()]);
    }, actor);
    return { ok: true };
  }
  valid(row?: TokenRow, kind?: TokenRow['kind']): TokenRow {
    if (!row || row.used_at || row.revoked_at || row.expires_at <= this.now() || (kind && row.kind !== kind)) throw invalidToken();
    return row;
  }
  async tokenInfo(token: string) {
    const row = this.valid((await this.pool.query<TokenRow>('SELECT * FROM account_token WHERE token_hash = $1', [digest(token)])).rows[0]);
    if (row.user_id) {
      const user = await this.pool.query('SELECT disabled FROM auth_user WHERE id = $1', [row.user_id]);
      if (!user.rows[0] || user.rows[0].disabled) throw invalidToken();
    }
    return { kind: row.kind, email: row.email, name: row.name, expiresAt: row.expires_at.toISOString() };
  }
  async activate(input: z.infer<typeof ActivationInputSchema>) {
    const tokenHash = digest(input.token);
    this.valid((await this.pool.query<TokenRow>('SELECT * FROM account_token WHERE token_hash = $1', [tokenHash])).rows[0], 'activation');
    const password = await (await this.auth.$context).password.hash(input.password);
    return this.transaction(async client => {
      const row = this.valid((await client.query<TokenRow>('SELECT * FROM account_token WHERE token_hash = $1 FOR UPDATE', [tokenHash])).rows[0], 'activation');
      if ((await client.query('SELECT id FROM auth_user WHERE email = $1', [row.email])).rowCount) throw new HttpError(409, 'USER_EXISTS', 'La cuenta ya existe.');
      if (row.role === 'admin' && (await client.query("SELECT id FROM auth_user WHERE role = 'admin' LIMIT 1")).rowCount) throw new HttpError(409, 'BOOTSTRAP_CLOSED', 'Ya existe un administrador.');
      const id = randomUUID();
      await client.query(`INSERT INTO auth_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt", disabled, role)
        VALUES ($1,$2,$3,true,NULL,now(),now(),false,$4)`, [id, input.name, row.email, row.role]);
      await client.query(`INSERT INTO auth_account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
        VALUES ($1,$2,$2,'credential',$3,now(),now())`, [randomUUID(), id, password]);
      await client.query('UPDATE account_token SET used_at = $2, user_id = $3 WHERE id = $1', [row.id, this.now(), id]);
      return { ok: true, user: { id, email: row.email, name: input.name, role: row.role } };
    });
  }
  async resetPassword(input: z.infer<typeof RecoveryInputSchema>) {
    const tokenHash = digest(input.token);
    const pending = this.valid((await this.pool.query<TokenRow>('SELECT * FROM account_token WHERE token_hash = $1', [tokenHash])).rows[0], 'recovery');
    const password = await (await this.auth.$context).password.hash(input.password);
    await this.transaction(async client => {
      const user = await this.findTarget(client, pending.user_id!);
      const row = this.valid((await client.query<TokenRow>('SELECT * FROM account_token WHERE token_hash = $1 FOR UPDATE', [tokenHash])).rows[0], 'recovery');
      if (user.disabled) throw invalidToken();
      const updated = await client.query(`UPDATE auth_account SET password = $2, "updatedAt" = now()
        WHERE "userId" = $1 AND "providerId" = 'credential' RETURNING id`, [user.id, password]);
      if (updated.rowCount !== 1) throw new HttpError(409, 'ACCOUNT_MISSING', 'La cuenta no tiene un acceso con contraseña disponible.');
      await client.query('DELETE FROM auth_session WHERE "userId" = $1', [user.id]);
      await client.query('UPDATE account_token SET used_at = $2 WHERE id = $1', [row.id, this.now()]);
      await client.query('UPDATE account_token SET revoked_at = COALESCE(revoked_at, $2) WHERE user_id = $1 AND used_at IS NULL', [user.id, this.now()]);
    });
    return { ok: true };
  }
  async rateLimit(scope: string, ip: string, max: number) {
    const now = this.now();
    const key = digest(`${scope}:${ip}:${Math.floor(now.getTime() / 60000)}`);
    const result = await this.pool.query<{ count: number }>(`INSERT INTO account_rate_limit (key, count, expires_at) VALUES ($1,1,$2)
      ON CONFLICT (key) DO UPDATE SET count = account_rate_limit.count + 1 RETURNING count`, [key, new Date(now.getTime() + 120000)]);
    await this.pool.query('DELETE FROM account_rate_limit WHERE expires_at < $1', [now]);
    if (result.rows[0].count > max) throw new HttpError(429, 'RATE_LIMITED', 'Demasiados intentos. Esperá un minuto antes de reintentar.');
  }
}
