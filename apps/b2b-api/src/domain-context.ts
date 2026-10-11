import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';
import type { Config } from './config.ts';
import { HttpError } from './errors.ts';

export type DomainContext = {
  id: string;
  host: string;
  organizationId: string;
  generation: number;
  origin: string;
  primaryHost: string;
  canonicalOrigin: string;
  isPrimary: boolean;
};

/** Registry keys are ASCII hostnames with an optional explicit nonzero port. */
export function normalizeDomainHost(input: string, protocol: 'http' | 'https' = 'https'): string {
  if (input !== input.trim() || !input || input.length > 260 || /[^\x21-\x7e]/.test(input))
    throw new HttpError(421, 'INVALID_DOMAIN', 'Dominio no disponible.');
  const match = /^([a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?$/.exec(input);
  if (!match) throw new HttpError(421, 'INVALID_DOMAIN', 'Dominio no disponible.');
  const hostname = match[1].toLowerCase().replace(/\.$/, '');
  if (
    hostname.length > 253 ||
    hostname.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))
  )
    throw new HttpError(421, 'INVALID_DOMAIN', 'Dominio no disponible.');
  const port = match[2] ? Number(match[2]) : undefined;
  return `${hostname}${port && port !== (protocol === 'https' ? 443 : 80) ? `:${port}` : ''}`;
}

function singleHeader(request: IncomingMessage, key: string): string | undefined {
  const value = request.headers[key];
  if (typeof value !== 'string') return undefined;
  // Node can join duplicates; inspect raw headers as well for auth-bearing values.
  let count = 0;
  for (let i = 0; i < request.rawHeaders.length; i += 2)
    if (request.rawHeaders[i].toLowerCase() === key) count++;
  return count > 1 ? undefined : value;
}

function sameSecret(value: string | undefined, expected: string | undefined): boolean {
  if (!value || !expected || expected.length < 32) return false;
  const actual = Buffer.from(value),
    wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

/** Never resolves a tenant from Host, Forwarded, X-Forwarded-Host or Origin. */
export function trustedDomainHost(request: IncomingMessage, config: Config): string {
  const peer = request.socket.remoteAddress?.replace(/^::ffff:/, '');
  const allowed = config.trustedProxyAddresses ?? ['127.0.0.1', '::1'];
  if (
    !peer ||
    !allowed.includes(peer) ||
    !sameSecret(singleHeader(request, 'x-klisteni-b2b-proxy-secret'), config.proxySecret)
  )
    throw new HttpError(421, 'UNTRUSTED_PROXY', 'Dominio no disponible.');
  const protocol = singleHeader(request, 'x-klisteni-b2b-proto');
  if (protocol !== (config.domainProtocol ?? 'https'))
    throw new HttpError(421, 'INVALID_DOMAIN_PROTOCOL', 'Dominio no disponible.');
  return normalizeDomainHost(
    singleHeader(request, 'x-klisteni-b2b-host') ?? '',
    config.domainProtocol ?? 'https',
  );
}

export async function resolveDomainContext(
  pool: Pick<Pool, 'query'>,
  config: Config,
  request: IncomingMessage,
): Promise<DomainContext | null> {
  if (!config.whiteLabel) return null;
  const host = trustedDomainHost(request, config);
  // Deliberately uncached: pausing/reassigning a host invalidates the next request.
  const row = (
    await pool.query<{
      host: string;
      organization_id: string;
      generation: number;
      primary_host: string;
    }>(
      `SELECT d.host,d.organization_id,d.generation,p.host AS primary_host
     FROM b2b_domain d JOIN b2b_domain p ON p.organization_id=d.organization_id
       AND p.primary_domain AND p.status='active'
     WHERE d.host=$1 AND d.status='active' AND d.verified_at IS NOT NULL
       AND d.dns_verified_at IS NOT NULL AND d.tls_verified_at IS NOT NULL
       AND d.tls_expires_at>now() AND p.verified_at IS NOT NULL
       AND p.dns_verified_at IS NOT NULL AND p.tls_verified_at IS NOT NULL
       AND p.tls_expires_at>now()`,
      [host],
    )
  ).rows[0];
  if (!row) throw new HttpError(421, 'DOMAIN_UNAVAILABLE', 'Dominio no disponible.');
  const protocol = config.domainProtocol ?? 'https';
  return {
    id: row.host,
    host: row.host,
    organizationId: row.organization_id,
    generation: row.generation,
    origin: new URL(`${protocol}://${row.host}`).origin,
    primaryHost: row.primary_host,
    canonicalOrigin: new URL(`${protocol}://${row.primary_host}`).origin,
    isPrimary: row.host === row.primary_host,
  };
}

export function assertRequestOrigin(request: IncomingMessage, origin: string): void {
  if (
    singleHeader(request, 'origin') !== origin ||
    request.headers['sec-fetch-site'] === 'cross-site'
  )
    throw new HttpError(403, 'INVALID_ORIGIN', 'Origen no permitido.');
}

/** A redirect clears fragments and refuses queries/invitations/auth to prevent token transfer. */
export function canonicalRedirect(
  context: DomainContext,
  requestUrl: string,
  method = 'GET',
): string | null {
  if (context.isPrimary) return null;
  if (!['GET', 'HEAD'].includes(method))
    throw new HttpError(421, 'CANONICAL_DOMAIN_REQUIRED', 'Abrí el dominio principal de la marca.');
  if (!requestUrl.startsWith('/') || requestUrl.startsWith('//') || requestUrl.includes('\\'))
    throw new HttpError(400, 'INVALID_REDIRECT', 'Ruta no disponible.');
  const url = new URL(requestUrl, context.canonicalOrigin);
  if (url.search || url.hash || /\/(?:auth|invitations?|invite)(?:\/|$)/i.test(url.pathname))
    throw new HttpError(421, 'CANONICAL_DOMAIN_REQUIRED', 'Abrí el dominio principal de la marca.');
  return `${context.canonicalOrigin}${url.pathname}#`;
}

export async function canonicalOrganizationOrigin(
  pool: Pick<Pool, 'query'>,
  config: Config,
  organizationId: string,
): Promise<string> {
  if (!config.whiteLabel) return config.origin;
  const row = (
    await pool.query<{ host: string }>(
      `SELECT host FROM b2b_domain WHERE organization_id=$1 AND primary_domain
     AND status='active' AND verified_at IS NOT NULL AND dns_verified_at IS NOT NULL
     AND tls_verified_at IS NOT NULL AND tls_expires_at>now()`,
      [organizationId],
    )
  ).rows[0];
  if (!row) throw new HttpError(409, 'DOMAIN_UNAVAILABLE', 'La marca no tiene un dominio activo.');
  return new URL(`${config.domainProtocol ?? 'https'}://${row.host}`).origin;
}
