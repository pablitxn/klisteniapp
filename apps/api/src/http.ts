import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { ZodError, z } from 'zod';
import type { Pool } from 'pg';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { createPool } from './database.ts';
import { AccountAdministration, ActivationInputSchema, RecoveryInputSchema, RequestRecoveryInputSchema, TokenInputSchema, InvitationInputSchema, DeliveryInputSchema, EmptyInputSchema } from './accounts.ts';
import { HttpError } from './errors.ts';
import { PublicRecovery } from './public-recovery.ts';
import { ImportRequestSchema, LogRequestSchema, SettingsRequestSchema, StateRepository, lockUser } from './state.ts';

const authRoutes = new Map([
  ['/api/auth/sign-in/email', 'POST'],
  ['/api/auth/sign-out', 'POST'],
  ['/api/auth/get-session', 'GET'],
  ['/api/auth/change-password', 'POST'],
  ['/api/auth/list-sessions', 'GET'],
  ['/api/auth/revoke-session', 'POST'],
  ['/api/auth/revoke-other-sessions', 'POST'],
]);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  if (Number(request.headers['content-length']) > limit) {
    request.resume();
    throw new HttpError(413, 'BODY_TOO_LARGE', 'El archivo supera el tamaño permitido.');
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) { chunks.length = 0; reject(new HttpError(413, 'BODY_TOO_LARGE', 'El archivo supera el tamaño permitido.')); }
      else chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
    request.on('aborted', () => reject(new HttpError(400, 'INVALID_INPUT', 'Solicitud interrumpida.')));
  });
}

function parseBody(body: Buffer): unknown {
  try { return JSON.parse(body.toString('utf8')); }
  catch { throw new HttpError(400, 'INVALID_INPUT', 'JSON inválido.'); }
}

function requestHeaders(request: IncomingMessage, config: Config): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined && key !== 'host' && !key.startsWith('x-forwarded-') && key !== 'cf-connecting-ip' && key !== 'x-klisteniapp-client-ip') {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  // A configured proxy must overwrite the header and restrict direct API ingress.
  const forwarded = config.trustedClientIpHeader ? request.headers[config.trustedClientIpHeader] : undefined;
  const ip = typeof forwarded === 'string' && isIP(forwarded) ? forwarded : request.socket.remoteAddress;
  if (ip) headers.set('x-klisteniapp-client-ip', ip);
  return headers;
}

async function forwardResponse(response: ServerResponse, result: Response): Promise<void> {
  for (const [key, value] of result.headers) if (key !== 'set-cookie') response.setHeader(key, value);
  response.setHeader('cache-control', 'no-store');
  const cookies = result.headers.getSetCookie();
  if (cookies.length) response.setHeader('set-cookie', cookies);
  response.statusCode = result.status;
  response.end(Buffer.from(await result.arrayBuffer()));
}

export function createApiServer({ auth, pool, config, repository = new StateRepository(pool), administration = new AccountAdministration(pool, auth, config), publicRecovery = new PublicRecovery(administration) }: {
  auth: Auth; pool: Pool; config: Config; repository?: StateRepository; administration?: AccountAdministration; publicRecovery?: PublicRecovery;
}) {
  // Separate connections prevent lock waiters from exhausting the pool that
  // Better Auth needs while validating credentials and creating sessions.
  const authLockPool = createPool(config, 2);
  async function lockedAuth(userId: string | undefined, operation: () => Promise<Response>): Promise<Response> {
    if (!userId) return operation();
    const client = await authLockPool.connect();
    try {
      await client.query('BEGIN');
      await lockUser(client, userId);
      const result = await operation();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  const server = createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    try {
      const url = new URL(request.url ?? '/', config.origin);
      const method = request.method ?? 'GET';
      if (method === 'GET' && url.pathname === '/api/healthz') return json(response, 200, { status: 'ok' });
      if (method === 'GET' && url.pathname === '/api/readyz') {
        try {
          await pool.query('SELECT user_id, settings, revision FROM personal_state LIMIT 0');
          await pool.query('SELECT id, payload, deleted FROM personal_log LIMIT 0');
          await pool.query('SELECT id, disabled, role FROM auth_user LIMIT 0');
          await pool.query('SELECT id, "expiresAt" FROM auth_session LIMIT 0');
          await pool.query('SELECT id, password FROM auth_account LIMIT 0');
          await pool.query('SELECT id FROM auth_verification LIMIT 0');
          await pool.query('SELECT key FROM auth_rate_limit LIMIT 0');
          await pool.query('SELECT id, token_hash, delivery_status FROM account_token LIMIT 0');
          await pool.query('SELECT id, token_id FROM account_bootstrap LIMIT 0');
          await pool.query('SELECT key, count FROM account_rate_limit LIMIT 0');
          return json(response, 200, { status: 'ready' });
        }
        catch { return json(response, 503, { status: 'unavailable' }); }
      }
      if (!url.pathname.startsWith('/api/')) throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      if (mutation) {
        if (request.headers.origin !== config.origin || request.headers['sec-fetch-site'] === 'cross-site') {
          throw new HttpError(403, 'INVALID_ORIGIN', 'Origen de solicitud no permitido.');
        }
        if (method !== 'DELETE' && request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
          throw new HttpError(415, 'INVALID_CONTENT_TYPE', 'La solicitud debe usar JSON.');
        }
      }
      const headers = requestHeaders(request, config);
      if (url.pathname.startsWith('/api/account/')) {
        if (method !== 'POST' || !['/api/account/token-info', '/api/account/activate', '/api/account/reset-password', '/api/account/request-recovery'].includes(url.pathname)) {
          throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        }
        await administration.rateLimit(url.pathname, headers.get('x-klisteniapp-client-ip') ?? 'unknown', 10);
        const body = parseBody(await readBody(request, 16 * 1024));
        if (url.pathname === '/api/account/request-recovery') {
          const { email } = RequestRecoveryInputSchema.parse(body);
          const reservation = await publicRecovery.reserve(email);
          if (reservation) {
            if (response.destroyed) reservation.cancel();
            else {
              response.once('finish', reservation.start);
              response.once('close', reservation.cancel);
            }
          }
          return json(response, 202, { ok: true });
        }
        if (url.pathname === '/api/account/token-info') return json(response, 200, await administration.tokenInfo(TokenInputSchema.parse(body).token));
        if (url.pathname === '/api/account/activate') return json(response, 201, await administration.activate(ActivationInputSchema.parse(body)));
        return json(response, 200, await administration.resetPassword(RecoveryInputSchema.parse(body)));
      }
      if (url.pathname.startsWith('/api/auth/')) {
        if (authRoutes.get(url.pathname) !== method) throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        let authUserId: string | undefined;
        if (url.pathname !== '/api/auth/sign-in/email') {
          const session = await auth.api.getSession({ headers });
          authUserId = session?.user.id;
          if (session?.user.disabled && url.pathname !== '/api/auth/sign-out') {
            if (url.pathname === '/api/auth/get-session') return json(response, 200, null);
            throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
          }
          if (!['/api/auth/get-session', '/api/auth/sign-out'].includes(url.pathname)) {
            if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
            if (request.headers['x-klisteni-account'] !== session.user.id) {
              throw new HttpError(401, 'ACCOUNT_CHANGED', 'La cuenta cambió en otra pestaña. Volvé a iniciar sesión.');
            }
          }
          if (url.pathname === '/api/auth/sign-out' && request.headers['x-klisteni-account'] && session && request.headers['x-klisteni-account'] !== session.user.id) {
            throw new HttpError(401, 'ACCOUNT_CHANGED', 'La cuenta cambió en otra pestaña. Volvé a iniciar sesión.');
          }
        }
        const body = mutation ? await readBody(request, 16 * 1024) : undefined;
        if (url.pathname === '/api/auth/sign-in/email') {
          const candidate = z.object({ email: z.string() }).safeParse(parseBody(body!));
          if (candidate.success) {
            const found = await pool.query<{ id: string }>('SELECT id FROM auth_user WHERE email = $1', [candidate.data.email.toLowerCase()]);
            authUserId = found.rows[0]?.id;
          }
        }
        const operation = async () => {
          const result = await auth.handler(new Request(`${config.origin}${url.pathname}${url.search}`, { method, headers, body: body?.toString('utf8') }));
          if (url.pathname === '/api/auth/change-password' && result.ok && authUserId) {
            await pool.query('UPDATE account_token SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1 AND used_at IS NULL', [authUserId]);
          }
          return result;
        };
        // Login and credential/session mutations share the operator's account lock.
        const result = mutation ? await lockedAuth(authUserId, operation) : await operation();
        return await forwardResponse(response, result);
      }
      const session = await auth.api.getSession({ headers });
      if (!session || session.user.disabled) throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
      if ((url.pathname.startsWith('/api/me/') || url.pathname.startsWith('/api/admin/')) && request.headers['x-klisteni-account'] !== session.user.id) {
        throw new HttpError(401, 'ACCOUNT_CHANGED', 'La cuenta cambió en otra pestaña. Volvé a iniciar sesión.');
      }
      if (url.pathname.startsWith('/api/admin/')) {
        const actor = { id: session.user.id, sessionId: session.session.id };
        await administration.requireAdmin(pool, actor);
        if (method === 'GET' && url.pathname === '/api/admin/users') return json(response, 200, await administration.users(actor));
        if (method === 'GET' && url.pathname === '/api/admin/invitations') return json(response, 200, await administration.invitations(actor));
        if (method !== 'POST') throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        await administration.rateLimit(`admin:${actor.id}`, headers.get('x-klisteniapp-client-ip') ?? 'unknown', 30);
        const body = parseBody(await readBody(request, 16 * 1024));
        if (url.pathname === '/api/admin/invitations') return json(response, 201, await administration.invite(actor, InvitationInputSchema.parse(body)));
        const invitation = /^\/api\/admin\/invitations\/([A-Za-z0-9_-]+)\/(reissue|revoke)$/.exec(url.pathname);
        if (invitation) {
          if (invitation[2] === 'reissue') return json(response, 201, await administration.reissue(actor, invitation[1], DeliveryInputSchema.parse(body).sendEmail));
          EmptyInputSchema.parse(body);
          return json(response, 200, await administration.revoke(actor, invitation[1]));
        }
        const management = /^\/api\/admin\/users\/([A-Za-z0-9_-]+)\/(disable|enable|revoke-sessions|recovery)$/.exec(url.pathname);
        if (management) {
          if (management[2] === 'recovery') return json(response, 201, await administration.recovery(actor, management[1], DeliveryInputSchema.parse(body).sendEmail));
          EmptyInputSchema.parse(body);
          return json(response, 200, await administration.operate(actor, management[1], management[2] as 'disable' | 'enable' | 'revoke-sessions'));
        }
        throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      }
      const owner = { id: session.user.id, name: session.user.name };
      if (method === 'GET' && url.pathname === '/api/me/state') return json(response, 200, await repository.get(owner));
      if (method === 'PUT' && url.pathname === '/api/me/settings') {
        return json(response, 200, await repository.settings(owner, SettingsRequestSchema.parse(parseBody(await readBody(request, 512 * 1024)))));
      }
      if (method === 'POST' && url.pathname === '/api/me/logs') {
        return json(response, 200, await repository.addLog(owner, LogRequestSchema.parse(parseBody(await readBody(request, 32 * 1024)))));
      }
      if (method === 'POST' && url.pathname === '/api/me/import') {
        return json(response, 200, await repository.import(owner, ImportRequestSchema.parse(parseBody(await readBody(request, 5 * 1024 * 1024)))));
      }
      const logPath = url.pathname.match(/^\/api\/me\/logs\/([^/]+)$/);
      if (method === 'DELETE' && logPath) {
        let id: string;
        try { id = decodeURIComponent(logPath[1]); } catch { throw new HttpError(400, 'INVALID_INPUT', 'Identificador inválido.'); }
        return json(response, 200, await repository.deleteLog(owner, z.string().min(1).max(200).parse(id)));
      }
      throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      if (error instanceof HttpError) return json(response, error.status, { error: error.message, code: error.code });
      if (error instanceof ZodError) return json(response, 400, { error: 'Datos inválidos. Revisá los campos y los límites del archivo.', code: 'INVALID_INPUT' });
      // Logs omit headers, cookies, database errors, request bodies, and private data.
      console.error('API request failed');
      json(response, 500, { error: 'No pudimos completar la solicitud.', code: 'INTERNAL_ERROR' });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.once('close', () => { void authLockPool.end(); });
  return Object.assign(server, { closeRecovery: () => publicRecovery.close() });
}
