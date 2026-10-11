import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createAuth } from './auth.ts';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { HttpError } from './errors.ts';
import { lockUser } from './state.ts';
import { initializeAccess } from './access.ts';

export const PasswordSchema = z.string().min(12).max(128);
export const EmailSchema = z.email().max(254).transform((email) => email.toLowerCase());

/** Provision credentials and the fixed trial atomically, using Better Auth's hasher. */
export async function createProvisionedUser(pool: Pool, config: Config, input: { email: string; name: string; password: string }) {
  const data = z.object({ email: EmailSchema, name: z.string().trim().min(1).max(100), password: PasswordSchema }).strict().parse(input);
  const runtimeAuth = createAuth(pool, config);
  const password = await (await runtimeAuth.$context).password.hash(data.password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteniapp:account-administration', 0))");
    if ((await client.query('SELECT id FROM auth_user WHERE email = $1', [data.email])).rowCount) throw new HttpError(409, 'USER_EXISTS', 'Ya existe una cuenta con ese email.');
    const id = randomUUID();
    await client.query(`INSERT INTO auth_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt", disabled, role)
      VALUES ($1,$2,$3,false,NULL,now(),now(),false,'user')`, [id, data.name, data.email]);
    await client.query(`INSERT INTO auth_account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
      VALUES ($1,$2,$2,'credential',$3,now(),now())`, [randomUUID(), id, password]);
    await initializeAccess(client, id);
    await client.query('COMMIT');
    return { id, name: data.name, email: data.email };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function operateUser(pool: Pool, auth: Auth, email: string, action: 'reset-password' | 'disable' | 'enable' | 'revoke-sessions', password?: string): Promise<string> {
  const normalizedEmail = EmailSchema.parse(email);
  // Use Better Auth's configured hasher and canonical credential account lookup.
  const context = await auth.$context;
  const hash = action === 'reset-password' ? await context.password.hash(PasswordSchema.parse(password)) : undefined;
  const found = await context.internalAdapter.findUserByEmail(normalizedEmail);
  if (!found) throw new HttpError(404, 'USER_NOT_FOUND', 'No existe ese usuario.');
  const id = found.user.id;
  const credential = action === 'reset-password' ? await context.internalAdapter.findCredentialAccount(id) : null;
  if (action === 'reset-password' && !credential) throw new HttpError(409, 'ACCOUNT_MISSING', 'El usuario no tiene cuenta de contraseña.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('klisteniapp:account-administration', 0))");
    await lockUser(client, id);
    if (action === 'reset-password') {
      const updated = await client.query('UPDATE auth_account SET password = $2, "updatedAt" = now() WHERE id = $1 AND "userId" = $3', [credential!.id, hash, id]);
      if (updated.rowCount !== 1) throw new Error('Credential account changed during operator action');
    }
    if (action === 'disable') {
      const current = await client.query('SELECT role, disabled FROM auth_user WHERE id = $1', [id]);
      if (current.rows[0]?.role === 'admin' && !current.rows[0].disabled
        && (await client.query("SELECT id FROM auth_user WHERE role = 'admin' AND NOT disabled")).rowCount === 1) {
        throw new HttpError(409, 'LAST_ADMIN', 'No se puede deshabilitar al último administrador.');
      }
    }
    if (action === 'disable' || action === 'enable') {
      await client.query('UPDATE auth_user SET disabled = $2, "updatedAt" = now() WHERE id = $1', [id, action === 'disable']);
    }
    // Re-enabling an account never revives its old sessions.
    await client.query('DELETE FROM auth_session WHERE "userId" = $1', [id]);
    if (action === 'disable' || action === 'reset-password') await client.query('UPDATE account_token SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1 AND used_at IS NULL', [id]);
    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
