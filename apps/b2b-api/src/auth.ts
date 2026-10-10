import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import type { Config } from './config.ts';

export function createAuth(pool: Pool, config: Config, options: { migrating?: boolean } = {}) {
  return betterAuth({
    appName: 'Klisteni Business', telemetry: { enabled: false },
    logger: { level: 'error', log: () => console.error('B2B authentication failed') },
    database: pool, baseURL: config.origin, basePath: '/api/b2b/auth', secret: config.secret, trustedOrigins: [config.origin],
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: false },
    user: { modelName: 'b2b_auth_user' }, account: { modelName: 'b2b_auth_account' }, verification: { modelName: 'b2b_auth_verification' },
    session: { modelName: 'b2b_auth_session', expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database', modelName: 'b2b_auth_rate_limit', window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 10 } } },
    // Migration owns schema validation explicitly through getMigrations. Avoid
    // launching runtime's asynchronous check against a not-yet-created schema.
    advanced: { database: { validateSchema: !options.migrating }, cookiePrefix: 'klisteni-b2b', useSecureCookies: config.production, defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' }, trustedProxyHeaders: false },
  });
}
export type Auth = ReturnType<typeof createAuth>;
