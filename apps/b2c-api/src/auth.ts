import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import type { Pool } from 'pg';
import type { Config } from './config.ts';

export function createAuth(pool: Pool, config: Config) {
  return betterAuth({
    appName: 'Klisteniapp',
    telemetry: { enabled: false },
    // Never emit adapter arguments, credentials, session material, or user data.
    logger: { level: 'error', log: () => { console.error('Authentication operation failed'); } },
    database: pool,
    baseURL: config.origin,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: [config.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      modelName: 'auth_user',
      additionalFields: {
        disabled: { type: 'boolean', defaultValue: false, input: false },
        role: { type: 'string', required: true, defaultValue: 'user', input: false },
      },
    },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    session: {
      modelName: 'auth_session',
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'auth_rate_limit',
      window: 60,
      max: 100,
      customRules: { '/sign-in/email': { window: 60, max: 5 } },
    },
    advanced: {
      cookiePrefix: 'klisteniapp',
      useSecureCookies: config.production,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' },
      ipAddress: { ipAddressHeaders: ['x-klisteniapp-client-ip'] },
      // The server synthesizes request origin and trusted IP; never trust Host/XFF.
      trustedProxyHeaders: false,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await pool.query<{ disabled: boolean }>('SELECT disabled FROM auth_user WHERE id = $1', [session.userId]);
            if (!user.rows[0] || user.rows[0].disabled) throw new APIError('UNAUTHORIZED', { message: 'Invalid email or password' });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
