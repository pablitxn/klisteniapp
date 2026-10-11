import { z } from 'zod';
import { isIP } from 'node:net';

const Environment = z.object({
  B2B_DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:/.test(v)),
  B2B_AUTH_SECRET: z
    .string()
    .min(32)
    .refine((v) => !v.startsWith('replace-')),
  B2B_APP_ORIGIN: z.url(),
  B2B_HOST: z.string().default('127.0.0.1'),
  B2B_PORT: z.coerce.number().int().min(1).max(65535).default(4201),
  B2B_MEDIA_ROOT: z.string().startsWith('/').optional(),
  B2B_MEDIA_QUOTA_MB: z.coerce.number().int().min(32).max(10240).default(256),
  B2B_DEMO_MODE: z.enum(['true', 'false']).default('false'),
  B2B_WHITE_LABEL: z.enum(['true', 'false']).default('false'),
  B2B_PROXY_SECRET: z.string().regex(/^[a-zA-Z0-9_-]{32,256}$/).optional(),
  B2B_TRUSTED_PROXY_ADDRESSES: z.string().default('127.0.0.1,::1'),
  B2B_DOMAIN_PROTOCOL: z.enum(['http', 'https']).default('https'),
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
});
export type Config = {
  databaseUrl: string;
  secret: string;
  origin: string;
  host: string;
  port: number;
  production: boolean;
  demoMode: boolean;
  mediaRoot?: string;
  mediaQuotaMb?: number;
  /** Omitted/false preserves the explicit single-origin legacy deployment. */
  whiteLabel?: boolean;
  proxySecret?: string;
  trustedProxyAddresses?: string[];
  domainProtocol?: 'http' | 'https';
};
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = Environment.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid B2B configuration: ${[...new Set(result.error.issues.map((i) => i.path[0]))].join(', ')}`,
    );
  const input = result.data;
  const origin = new URL(input.B2B_APP_ORIGIN);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== input.B2B_APP_ORIGIN ||
    origin.username ||
    origin.password
  )
    throw new Error('B2B_APP_ORIGIN must be an exact HTTP(S) origin');
  if (input.NODE_ENV === 'production' && origin.protocol !== 'https:')
    throw new Error('Production B2B origin requires HTTPS');
  const trustedProxyAddresses = input.B2B_TRUSTED_PROXY_ADDRESSES.split(',').map((v) => v.trim());
  if (!trustedProxyAddresses.length || trustedProxyAddresses.some((v) => !isIP(v)))
    throw new Error('B2B_TRUSTED_PROXY_ADDRESSES requires exact IP addresses');
  if (input.B2B_WHITE_LABEL === 'true') {
    if (!input.B2B_PROXY_SECRET || input.B2B_PROXY_SECRET.startsWith('replace-'))
      throw new Error('White-label B2B requires an independent B2B_PROXY_SECRET');
    if (input.B2B_PROXY_SECRET === input.B2B_AUTH_SECRET)
      throw new Error('B2B proxy and auth secrets must be independent');
    if (input.NODE_ENV === 'production' && input.B2B_DOMAIN_PROTOCOL !== 'https')
      throw new Error('Production white-label domains require HTTPS');
  }
  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET === input.B2B_AUTH_SECRET)
    throw new Error('B2B must use an independent auth secret');
  if (env.DATABASE_URL) {
    const consumer = new URL(env.DATABASE_URL),
      business = new URL(input.B2B_DATABASE_URL);
    if (
      consumer.hostname === business.hostname &&
      consumer.port === business.port &&
      consumer.pathname === business.pathname
    )
      throw new Error('B2B must use an independent database');
  }
  return {
    databaseUrl: input.B2B_DATABASE_URL,
    secret: input.B2B_AUTH_SECRET,
    origin: origin.origin,
    host: input.B2B_HOST,
    port: input.B2B_PORT,
    production: input.NODE_ENV === 'production',
    demoMode: input.B2B_DEMO_MODE === 'true',
    ...(input.B2B_MEDIA_ROOT ? { mediaRoot: input.B2B_MEDIA_ROOT } : {}),
    mediaQuotaMb: input.B2B_MEDIA_QUOTA_MB,
    whiteLabel: input.B2B_WHITE_LABEL === 'true',
    proxySecret: input.B2B_PROXY_SECRET,
    trustedProxyAddresses,
    domainProtocol: input.B2B_DOMAIN_PROTOCOL,
  };
}
