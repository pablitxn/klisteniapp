import { z } from 'zod';

const EnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => /^postgres(ql)?:/.test(value)),
  BETTER_AUTH_SECRET: z.string().min(32).refine((value) => !value.startsWith('replace-'), 'Use a random secret'),
  APP_ORIGIN: z.url(),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TRUSTED_CLIENT_IP_HEADER: z.string().regex(/^[a-z0-9-]+$/).optional(),
  SMTP_HOST: z.string().min(1).max(253).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.email().max(254).optional(),
});

export type Config = {
  databaseUrl: string;
  secret: string;
  origin: string;
  host: string;
  port: number;
  production: boolean;
  trustedClientIpHeader?: string;
  smtp?: { host: string; port: number; secure: boolean; user?: string; password?: string; from: string };

};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    // Do not include input values: database URLs and auth secrets are private.
    throw new Error(`Invalid configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`);
  }
  const env = parsed.data;
  if (Boolean(env.SMTP_HOST) !== Boolean(env.SMTP_FROM) || Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)
    || (!env.SMTP_HOST && (env.SMTP_USER || env.SMTP_PASSWORD))) {
    throw new Error('SMTP configuration requires HOST/FROM and both USER/PASSWORD when authentication is used');
  }
  const url = new URL(env.APP_ORIGIN);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== env.APP_ORIGIN || url.username || url.password) {
    throw new Error('APP_ORIGIN must be an exact HTTP(S) origin with no path or trailing slash');
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production APP_ORIGIN requires HTTPS');
  return {
    databaseUrl: env.DATABASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    origin: url.origin,
    host: env.HOST,
    port: env.PORT,
    production: env.NODE_ENV === 'production',
    trustedClientIpHeader: env.TRUSTED_CLIENT_IP_HEADER,
    ...(env.SMTP_HOST && env.SMTP_FROM ? { smtp: {
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.SMTP_FROM,
    } } : {}),
  };
}
