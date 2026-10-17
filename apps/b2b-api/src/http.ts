import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { z, ZodError } from 'zod';
import type { Pool } from 'pg';
import {
  API_PREFIX,
  AcceptInvitationSchema,
  BrandInputSchema,
  CoachAssignmentSchema,
  ExerciseInputSchema,
  ExerciseUpdateSchema,
  ExecutionInputSchema,
  InvitationInputSchema,
  MachineInputSchema,
  MachineUpdateSchema,
  MembershipUpdateSchema,
  ProgramAssignmentSchema,
  ProgramInputSchema,
  ProgramUpdateSchema,
  PublishSchema,
  UnitInputSchema,
  UnitUpdateSchema,
  UnitBatchSchema,
  WebsiteUpdateSchema,
  MediaUploadSchema,
  BranchInputSchema,
  BranchUpdateSchema,
  BranchGrantInputSchema,
  ThemeUpdateSchema,
  ModuleUpdateSchema,
  BranchCatalogSchema,
} from '@klisteniapp/b2b-contracts';
import { createAuth, type Auth } from './auth.ts';
import { resolveDomainContext, assertRequestOrigin, canonicalRedirect } from './domain-context.ts';
import { requireBrandSession, type WorkContext } from './white-label-access.ts';
import type { Config } from './config.ts';
import { B2BService } from './service.ts';
import { HttpError } from './errors.ts';
import { createMediaStore, MEDIA_LIMITS } from './media.ts';
import { ProductEndpoints, type ProductEndpoint } from '@klisteniapp/b2b-contracts/product-v2';
import { productPeople, updateProductMember, inviteProductMember } from './auth/product-people.ts';
import { readProductAudit } from './audit/product-audit.ts';
import { HEALTH_RESPONSE_HEADERS } from './health/index.ts';
import { assertProductMigrations } from './product-readiness.ts';
import { bindInactiveBrandSession, inactiveRouteAllowed } from './membership/access.ts';
import { PERSONAL_EXPORT_HEADERS } from './exports/index.ts';
import { requireIdentityRealm, selectedMembershipMode } from './product-identity.ts';

const TOKEN = z.object({ token: z.string().min(32).max(200) }).strict();
async function body(request: IncomingMessage, maximum = 1024 * 1024): Promise<unknown> {
  if (Number(request.headers['content-length']) > maximum) {
    request.resume();
    throw new HttpError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximum)
      throw new HttpError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'JSON inválido.');
  }
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}
function headers(request: IncomingMessage): Headers {
  const result = new Headers();
  // Proxy headers are not accepted as a source of identity, origin or tenant.
  for (const [key, value] of Object.entries(request.headers))
    if (
      value !== undefined &&
      key !== 'host' &&
      !key.startsWith('x-forwarded-') &&
      key !== 'cf-connecting-ip' &&
      !['x-klisteni-b2b-proxy-secret', 'x-klisteni-b2b-host', 'x-klisteni-b2b-proto'].includes(key)
    )
      result.set(key, Array.isArray(value) ? value.join(', ') : value);
  return result;
}
export function createApiServer({
  config,
  pool,
  auth,
  service = new B2BService(pool, auth, config),
}: {
  config: Config;
  pool: Pool;
  auth: Auth;
  service?: B2BService;
}) {
  const mediaStore = config.mediaRoot ? createMediaStore(config.mediaRoot) : undefined;
  let uploads = 0;
  const domainAuth = new Map<string, Auth>();
  const server = createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    try {
      const url = new URL(request.url ?? '/', config.origin),
        method = request.method ?? 'GET';
      // Apply private-cache policy before authentication/body parsing too.
      if (
        url.pathname === `${API_PREFIX}/self/exports` ||
        url.pathname === `${API_PREFIX}/self/b2c-invitation` ||
        /^\/api\/b2b\/orgs\/[a-zA-Z0-9_-]+\/(?:product\/v2\/(?:health(?:\/.*)?|members\/[a-zA-Z0-9_-]+\/health)|self\/exports)$/.test(
          url.pathname,
        )
      )
        for (const [name, value] of Object.entries(HEALTH_RESPONSE_HEADERS))
          response.setHeader(name, value);
      if (url.pathname === `${API_PREFIX}/self/exports`)
        for (const [name, value] of Object.entries(PERSONAL_EXPORT_HEADERS))
          response.setHeader(name, value);
      if (url.pathname === `${API_PREFIX}/healthz` && method === 'GET')
        return json(response, 200, { status: 'ok' });
      if (url.pathname === `${API_PREFIX}/readyz` && method === 'GET') {
        try {
          await pool.query(
            'SELECT organization_id,member_id,assignment_id,data FROM b2b_execution LIMIT 0',
          );
          await pool.query('SELECT id FROM b2b_auth_user LIMIT 0');
          await assertProductMigrations(pool);
          if (
            !(await pool.query("SELECT id FROM b2b_migration WHERE id='006-product-foundation'"))
              .rowCount
          )
            throw new Error('Missing migration');
          // Auth retains schema mismatches from startup until this process is
          // restarted. Existing tables alone must not advertise usable sessions.
          await (await auth.$context).checkSchema?.();
          return json(response, 200, { status: 'ready' });
        } catch {
          return json(response, 503, { status: 'unavailable' });
        }
      }
      if (!url.pathname.startsWith(`${API_PREFIX}/`))
        throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      const domain = await resolveDomainContext(pool, config, request);
      if (
        !domain &&
        (
          await pool.query(`SELECT 1 WHERE EXISTS(SELECT 1 FROM b2b_domain WHERE status IN ('active','verified'))
        OR EXISTS(SELECT 1 FROM b2b_branch GROUP BY organization_id HAVING count(*)>1)`)
        ).rowCount
      )
        throw new HttpError(
          503,
          'WHITE_LABEL_REQUIRED',
          'Esta instalación requiere acceso por el dominio de la marca.',
        );
      const origin = domain?.origin ?? config.origin;
      let requestAuth = auth;
      if (domain) {
        const key = `${domain.host}:${domain.generation}`;
        requestAuth =
          domainAuth.get(key) ??
          createAuth(pool, { ...config, origin, production: origin.startsWith('https:') });
        if (!domainAuth.has(key)) {
          // Bounded cache; registry and session association are still checked per request.
          if (domainAuth.size >= 100) domainAuth.delete(domainAuth.keys().next().value!);
          domainAuth.set(key, requestAuth);
        }
      }
      const work: WorkContext = {
        domain,
        branchId:
          typeof request.headers['x-klisteni-b2b-branch'] === 'string'
            ? request.headers['x-klisteni-b2b-branch']
            : undefined,
        role:
          typeof request.headers['x-klisteni-b2b-role'] === 'string'
            ? request.headers['x-klisteni-b2b-role']
            : undefined,
      };
      const path = url.pathname.slice(API_PREFIX.length);
      if (path === '/domain-entry' && method === 'GET') {
        if (!domain) {
          response.writeHead(204);
          response.end();
          return;
        }
        const entry = request.headers['x-klisteni-b2b-entry-path'];
        if (typeof entry !== 'string')
          throw new HttpError(400, 'INVALID_REDIRECT', 'Ruta no disponible.');
        const location = canonicalRedirect(domain, entry);
        response.writeHead(
          location ? (request.headers['x-klisteni-b2b-entry-mode'] === 'nginx' ? 403 : 308) : 204,
          location ? { location } : {},
        );
        response.end();
        return;
      }
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const upload =
        method === 'POST' && /^\/orgs\/[a-zA-Z0-9_-]+\/(?:media|brand-media)$/.test(path);
      if (mutation) {
        assertRequestOrigin(request, origin);
        if (
          !upload &&
          request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json'
        )
          throw new HttpError(415, 'INVALID_CONTENT_TYPE', 'La solicitud debe usar JSON.');
      }
      const requestHeaders = headers(request);
      const contractHeader =
        typeof request.headers['x-klisteni-b2b-contract'] === 'string'
          ? request.headers['x-klisteni-b2b-contract']
          : undefined;
      const currentSession = await requestAuth.api.getSession({ headers: requestHeaders });
      const selfRoute = path === '/self/exports' || path === '/self/b2c-invitation';
      const selectedOrganization =
        domain?.organizationId ??
        /^\/orgs\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(path)?.[1] ??
        (selfRoute ? (url.searchParams.get('organizationId') ?? undefined) : undefined);
      let inactiveRequest = false;
      if (
        currentSession &&
        selectedOrganization &&
        path !== '/auth/sign-in/email' &&
        path !== '/invitations/sign-in'
      ) {
        const mode = await service.transaction((db) =>
          selectedMembershipMode(
            db,
            currentSession.user.id,
            selectedOrganization,
            currentSession.session.id,
            domain,
          ),
        );
        inactiveRequest = mode === 'export-only';
        if (
          inactiveRequest &&
          !inactiveRouteAllowed(
            method,
            url.pathname,
            selectedOrganization,
            contractHeader,
            request.headers.range,
          )
        )
          throw new HttpError(403, 'CONTEXT_REVOKED', 'Tu cuenta permite descargar tus registros.');
      }
      if (path === '/context' && method === 'GET') {
        if (!domain)
          throw new HttpError(404, 'WHITE_LABEL_DISABLED', 'Contexto por dominio no habilitado.');
        return json(response, 200, await service.whiteLabel.context(domain));
      }
      if (path.startsWith('/auth/') || (path === '/invitations/sign-in' && domain)) {
        const routes = new Map([
          ['/auth/sign-in/email', 'POST'],
          ['/invitations/sign-in', 'POST'],
          ['/auth/sign-out', 'POST'],
          ['/auth/get-session', 'GET'],
          ['/auth/change-password', 'POST'],
        ]);
        if (routes.get(path) !== method)
          throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        if (domain && path !== '/auth/sign-in/email' && path !== '/invitations/sign-in') {
          const identity = currentSession;
          if (!identity)
            throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
          await service.transaction(async (db) => {
            await service.requireSession(db, identity.user.id, identity.session.id);
            if (path === '/auth/sign-out')
              await requireIdentityRealm(db, identity.user.id, identity.session.id, domain);
            else await requireBrandSession(db, identity.user.id, identity.session.id, domain);
          });
        }
        const value = mutation ? await body(request) : undefined;
        const invitationLogin =
          path === '/invitations/sign-in'
            ? z
                .object({
                  email: z.email(),
                  password: z.string().min(12).max(128),
                  token: z.string().min(32).max(200),
                  consent: z.literal(true),
                })
                .strict()
                .parse(value)
            : undefined;
        const result = await requestAuth.handler(
          new Request(
            `${origin}${invitationLogin ? `${API_PREFIX}/auth/sign-in/email` : url.pathname}`,
            {
              method,
              headers: requestHeaders,
              ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
            },
          ),
        );
        if (domain && (path === '/auth/sign-in/email' || invitationLogin) && result.ok) {
          const payload = (await result.clone().json()) as {
            token?: string;
            user?: { id?: string };
          };
          if (invitationLogin) {
            const identity = (
              await pool.query<{ id: string }>('SELECT id FROM b2b_auth_session WHERE token=$1', [
                payload.token,
              ])
            ).rows[0];
            try {
              if (!identity || !payload.user?.id)
                throw new HttpError(401, 'INVALID_INVITATION', 'Invitación inválida o vencida.');
              await service.acceptInvitation(
                invitationLogin.token,
                undefined,
                { userId: payload.user.id, sessionId: identity.id },
                domain,
              );
            } catch (error) {
              await pool.query('DELETE FROM b2b_auth_session WHERE token=$1', [payload.token]);
              throw error;
            }
          }
          let admitted = false;
          try {
            admitted = await service.transaction(async (db) => {
              await db.query('SELECT id FROM b2b_organization WHERE id=$1 FOR SHARE', [
                domain.organizationId,
              ]);
              const member = await db.query<{ active: boolean }>(
                'SELECT active FROM b2b_membership WHERE organization_id=$1 AND user_id=$2 FOR SHARE',
                [domain.organizationId, payload.user?.id],
              );
              const identity = (
                await db.query<{ id: string }>(
                  'SELECT id FROM b2b_auth_session WHERE token=$1 AND "userId"=$2',
                  [payload.token, payload.user?.id],
                )
              ).rows[0];
              const current = await db.query(
                `SELECT host FROM b2b_domain WHERE host=$1 AND organization_id=$2 AND generation=$3 AND status='active' AND tls_expires_at>now() FOR SHARE`,
                [domain.host, domain.organizationId, domain.generation],
              );
              if (!member.rowCount || !current.rowCount || !identity || !payload.user?.id)
                return false;
              if (!member.rows[0].active) {
                await bindInactiveBrandSession(
                  db,
                  payload.user.id,
                  identity.id,
                  domain,
                  contractHeader,
                );
                return true;
              }
              await db.query(
                `INSERT INTO b2b_session_context(session_id,organization_id,domain_host,domain_generation)
              SELECT id,$2,$3,$4 FROM b2b_auth_session WHERE token=$1`,
                [payload.token, domain.organizationId, domain.host, domain.generation],
              );
              return true;
            });
          } catch (error) {
            // Admission rolled back; cleanup must commit separately or the fresh
            // password session would survive a failed inactive/domain binding.
            await pool.query('DELETE FROM b2b_auth_session WHERE token=$1', [payload.token]);
            throw error;
          }
          if (!admitted)
            await pool.query('DELETE FROM b2b_auth_session WHERE token=$1', [payload.token]);
          if (!admitted)
            throw new HttpError(
              401,
              'INVALID_CREDENTIALS',
              'No pudimos iniciar sesión con esas credenciales en esta marca.',
            );
        }
        for (const [key, value] of result.headers)
          if (key !== 'set-cookie') response.setHeader(key, value);
        response.setHeader('set-cookie', result.headers.getSetCookie());
        response.statusCode = result.status;
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      const publicPath = /^\/public\/([a-z0-9-]+)(?:\/units\/([a-zA-Z0-9_-]+))?$/.exec(path);
      if (publicPath && method === 'GET')
        return json(
          response,
          200,
          await service.publicSite(
            publicPath[1],
            publicPath[2],
            domain,
            url.searchParams.get('branch') ?? undefined,
          ),
        );
      if (path === '/invitations/accept' && method === 'POST') {
        await service.limit(`invitation:${request.socket.remoteAddress ?? 'unknown'}`);
        const input = AcceptInvitationSchema.parse(await body(request));
        return json(
          response,
          201,
          await service.acceptInvitation(input.token, input, undefined, domain),
        );
      }
      const session = currentSession;
      if (session && domain && !inactiveRequest)
        await service.transaction(async (db) => {
          await service.requireSession(db, session.user.id, session.session.id);
          await requireBrandSession(db, session.user.id, session.session.id, domain);
        });
      const mediaPath = /^\/media\/([a-zA-Z0-9_-]+)$/.exec(path);
      if (mediaPath && ['GET', 'HEAD'].includes(method)) {
        if (!mediaStore)
          throw new HttpError(
            503,
            'MEDIA_NOT_CONFIGURED',
            'El almacenamiento de medios no está configurado.',
          );
        if (
          request.headers['x-klisteni-b2b-account'] &&
          request.headers['x-klisteni-b2b-account'] !== session?.user.id
        )
          throw new HttpError(401, 'ACCOUNT_CHANGED', 'La cuenta cambió. Actualizá la página.');
        const row = await service.mediaAccess(
          mediaPath[1],
          session ? { userId: session.user.id, sessionId: session.session.id } : undefined,
          work,
        );
        const file = await mediaStore.open(
          { id: row.id, relativePath: row.relative_path, mime: row.mime, bytes: Number(row.bytes) },
          request.headers.range,
        );
        response.writeHead(file.status, {
          ...file.headers,
          'cache-control': 'no-store',
          'content-security-policy': "default-src 'none'; sandbox",
          'cross-origin-resource-policy': 'same-origin',
        });
        if (method === 'HEAD') {
          file.stream.destroy();
          response.end();
        } else await pipeline(file.stream, response);
        return;
      }
      if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
      if (
        request.headers['x-klisteni-b2b-account'] &&
        request.headers['x-klisteni-b2b-account'] !== session.user.id
      )
        throw new HttpError(401, 'ACCOUNT_CHANGED', 'La cuenta cambió. Actualizá la página.');
      if (
        mutation &&
        (path.startsWith('/orgs/') || path === '/invitations/join') &&
        request.headers['x-klisteni-b2b-account'] !== session.user.id
      )
        throw new HttpError(401, 'ACCOUNT_CHANGED', 'Actualizá tu sesión antes de guardar.');
      const actor = session.user.id;
      if (selfRoute) {
        if (method !== 'GET' || request.headers.range !== undefined)
          throw new HttpError(
            403,
            'CONTEXT_REVOKED',
            'Descargá el archivo completo desde tu cuenta.',
          );
        const selectors = url.searchParams.getAll('organizationId');
        if (
          selectors.length !== 1 ||
          !/^[a-zA-Z0-9_-]+$/.test(selectors[0]) ||
          [...url.searchParams.keys()].some((key) => key !== 'organizationId')
        )
          throw new HttpError(
            400,
            'INVALID_INPUT',
            'Elegí un único gimnasio para descargar tus registros.',
          );
        const key = path === '/self/exports' ? 'personalExport' : 'b2cInvitation';
        const endpoint = ProductEndpoints[key];
        await service.productIdentity(
          actor,
          selectors[0],
          session.session.id,
          contractHeader,
          async (context) => {
            const output = endpoint.output.parse(
              await service.productSelfServices[key](context, endpoint.input.parse({})),
            );
            json(response, 200, output);
          },
          work,
        );
        return;
      }
      if (path === '/me' && method === 'GET')
        return json(
          response,
          200,
          await service.me(
            { id: actor, name: session.user.name, email: session.user.email },
            domain,
          ),
        );
      if (path === '/invitations/join' && method === 'POST')
        return json(
          response,
          200,
          await service.acceptInvitation(
            TOKEN.parse(await body(request)).token,
            undefined,
            {
              userId: actor,
              sessionId: session.session.id,
            },
            domain,
          ),
        );
      if (domain && path === '/history/executions' && method === 'GET')
        return json(
          response,
          200,
          await service.organization(
            actor,
            domain.organizationId,
            session.session.id,
            false,
            async (c) => ({ executions: await service.executions(c) }),
            { domain, history: true },
          ),
        );
      const orgPath = /^\/orgs\/([a-zA-Z0-9_-]+)(\/.*)$/.exec(path);
      if (!orgPath) throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      const orgId = orgPath[1],
        route = orgPath[2];
      // Only ACCESS-owned, complete handlers are registered here. Producer
      // endpoints remain unavailable until their owner supplies reviewed wiring.
      if (route.startsWith('/product/v2/')) {
        const owned: ProductEndpoint[] = [
          'capabilities',
          'access',
          'people',
          'updateMember',
          'inviteMember',
          'audit',
          ...(Object.keys(service.productProducers) as ProductEndpoint[]).filter(
            (name) => ProductEndpoints[name].scope === 'organization',
          ),
        ];
        for (const key of owned) {
          const endpoint = ProductEndpoints[key];
          if (method !== endpoint.method) continue;
          const names: string[] = [];
          const pattern = endpoint.path.replace(/:([a-zA-Z]+)/g, (_match, name: string) => {
            names.push(name);
            return '([a-zA-Z0-9_-]+)';
          });
          const match = new RegExp(`^${pattern}$`).exec(route);
          if (!match) continue;
          const parameters = Object.fromEntries(
            names.map((name, index) => [name, match[index + 1]]),
          );
          const healthRoute = [
            'ownHealth',
            'saveOwnHealth',
            'previewHealthImport',
            'applyHealthImport',
            'healthConsents',
            'grantHealthConsent',
            'revokeHealthConsent',
            'consentedHealth',
          ].includes(key);
          if (healthRoute)
            for (const [name, value] of Object.entries(HEALTH_RESPONSE_HEADERS))
              response.setHeader(name, value);
          const raw = mutation
            ? await body(request, healthRoute ? 5 * 1024 * 1024 : 1024 * 1024)
            : Object.fromEntries(url.searchParams);
          if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw new HttpError(400, 'INVALID_INPUT', 'Revisá los datos de la solicitud.');
          for (const [name, value] of Object.entries(parameters)) {
            if (name in raw && (raw as Record<string, unknown>)[name] !== value)
              throw new HttpError(400, 'INVALID_INPUT', 'La identidad de la ruta no coincide.');
          }
          const data: Record<string, unknown> = { ...raw, ...parameters };
          if (key === 'alternatives' || key === 'routineVersion') {
            if (typeof data.version !== 'string' || !/^[1-9][0-9]*$/.test(data.version))
              throw new HttpError(400, 'INVALID_INPUT', 'La versión debe ser un entero positivo.');
            data.version = Number(data.version);
          }
          const contract =
            typeof request.headers['x-klisteni-b2b-contract'] === 'string'
              ? request.headers['x-klisteni-b2b-contract']
              : undefined;
          const parsed = endpoint.input.parse(data);
          if (inactiveRequest && (key === 'access' || key === 'capabilities')) {
            await service.productIdentity(
              actor,
              orgId,
              session.session.id,
              contract,
              async (context) => {
                const output =
                  key === 'access'
                    ? await service.restrictedProductAccess(context)
                    : {
                        schemaVersion: 2,
                        minimumClientVersion: 2,
                        activated: true,
                        migration: '006-product-foundation',
                      };
                json(response, 200, endpoint.output.parse(output));
              },
              work,
            );
            return;
          }
          if (key === 'capabilities')
            return json(
              response,
              200,
              endpoint.output.parse(
                await service.productDiscovery(actor, orgId, session.session.id, contract, work),
              ),
            );
          const result = await service.productOrganization(
            actor,
            orgId,
            session.session.id,
            mutation,
            contract,
            async (context) => {
              const result = await (async () => {
                switch (key) {
                  case 'access':
                    return service.productAccess(context);
                  case 'people':
                    return productPeople(context);
                  case 'updateMember':
                    return updateProductMember(
                      context,
                      ProductEndpoints.updateMember.input.parse(parsed),
                    );
                  case 'inviteMember':
                    return inviteProductMember(
                      context,
                      ProductEndpoints.inviteMember.input.parse(parsed),
                      domain?.canonicalOrigin ?? config.origin,
                    );
                  case 'audit':
                    return readProductAudit(context, ProductEndpoints.audit.input.parse(parsed));
                  default:
                    return service.productProducer(context, key, parsed);
                }
              })();
              const output = endpoint.output.parse(result);
              // Queue authorized health-read bytes while authority/consent locks
              // are held; never dispatch a captured, delayed projection here.
              if (healthRoute && method === 'GET') json(response, 200, output);
              return output;
            },
            work,
          );
          if (response.headersSent) return;
          return json(response, 200, result);
        }
        throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      }
      const brandRoute =
        /^\/(branches(?:\/[^/]+)?|grants|theme(?:\/(?:publish|restore|versions))?|modules\/brand|members(?:\/[^/]+)?|history\/executions|brand-media|brand)$/.test(
          route,
        );
      if (domain && !work.branchId && !brandRoute)
        throw new HttpError(400, 'BRANCH_REQUIRED', 'Elegí una sede para continuar.');
      if (domain && route === '/history/executions' && method === 'GET')
        return json(
          response,
          200,
          await service.organization(
            actor,
            orgId,
            session.session.id,
            false,
            async (c) => {
              service.admin(c);
              return { executions: await service.executions(c) };
            },
            { domain },
          ),
        );
      if (route === '/brand-media') {
        if (!domain) throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        work.branchId = undefined;
        work.role = 'admin';
      }
      if (upload) {
        if (!mediaStore)
          throw new HttpError(
            503,
            'MEDIA_NOT_CONFIGURED',
            'El almacenamiento de medios no está configurado.',
          );
        const metadata = MediaUploadSchema.parse(Object.fromEntries(url.searchParams));
        const bytes = Number(request.headers['content-length'] ?? 0);
        if (bytes > MEDIA_LIMITS[metadata.kind])
          throw new HttpError(413, 'MEDIA_TOO_LARGE', 'El archivo supera el tamaño permitido.');
        if (uploads >= 2)
          throw new HttpError(
            429,
            'UPLOAD_BUSY',
            'Hay otras cargas en curso. Probá nuevamente en un momento.',
          );
        uploads++;
        try {
          await service.organization(
            actor,
            orgId,
            session.session.id,
            true,
            (c) => {
              if (route === '/brand-media') service.admin(c);
              return service.whiteLabel
                .requireModule(c, 'media')
                .then(() => service.uploadAllowance(c, bytes));
            },
            work,
          );
          const stored = await mediaStore.ingest({
            body: request.iterator({ destroyOnReturn: false }),
            contentType: request.headers['content-type'] ?? '',
            kind: metadata.kind,
          });
          try {
            const media = await service.organization(
              actor,
              orgId,
              session.session.id,
              true,
              (c) => {
                if (route === '/brand-media') service.admin(c);
                return service.whiteLabel
                  .requireModule(c, 'media')
                  .then(() => service.saveMedia(c, stored, metadata));
              },
              work,
            );
            return json(response, 201, { media });
          } catch (error) {
            // A lost COMMIT acknowledgement is ambiguous. Never delete bytes
            // when a committed row may already reference this immutable file.
            const committed = await pool
              .query('SELECT id FROM b2b_media WHERE id=$1', [stored.id])
              .catch(() => undefined);
            if (committed?.rowCount === 0) await mediaStore.remove(stored);
            throw error;
          }
        } finally {
          uploads--;
          request.resume();
        }
      }
      const input = mutation ? await body(request) : undefined;
      const output = await service.organization(
        actor,
        orgId,
        session.session.id,
        mutation,
        async (context) => {
          if (domain) {
            if (route === '/branches' && method === 'GET')
              return service.whiteLabel.branches(context);
            if (route === '/branches' && method === 'POST')
              return service.whiteLabel.createBranch(context, BranchInputSchema.parse(input));
            const branch = /^\/branches\/([a-zA-Z0-9_-]+)$/.exec(route);
            if (branch && method === 'PUT') {
              const { expectedRevision, ...data } = BranchUpdateSchema.parse(input);
              return service.whiteLabel.updateBranch(context, branch[1], data, expectedRevision);
            }
            if (route === '/grants' && method === 'GET') return service.whiteLabel.grants(context);
            if (route === '/grants' && method === 'PUT')
              return service.updateBranchGrant(context, BranchGrantInputSchema.parse(input));
            if (route === '/theme' && method === 'GET')
              return { theme: await service.whiteLabel.theme(context) };
            if (route === '/theme' && method === 'PUT') {
              const { expectedRevision, ...data } = ThemeUpdateSchema.parse(input);
              await service.validateThemeMedia(context, data);
              return service.whiteLabel.updateTheme(context, data, expectedRevision);
            }
            if (route === '/theme/versions' && method === 'GET')
              return service.whiteLabel.themeVersions(context);
            if (route === '/theme/publish' && method === 'POST') {
              const current = await service.whiteLabel.theme(context);
              await service.validateThemeMedia(context, current.draft);
              return service.whiteLabel.publishTheme(
                context,
                PublishSchema.parse(input).expectedRevision,
              );
            }
            if (route === '/theme/restore' && method === 'POST') {
              const data = z
                .object({
                  expectedRevision: z.number().int().nonnegative(),
                  version: z.number().int().positive(),
                })
                .strict()
                .parse(input);
              return service.whiteLabel.publishTheme(context, data.expectedRevision, data.version);
            }
            if (route === '/modules' && method === 'GET')
              return service.whiteLabel.modules(context);
            if (['/modules', '/modules/brand'].includes(route) && method === 'PUT') {
              const data = ModuleUpdateSchema.parse(input);
              return service.whiteLabel.setModule(
                context,
                data.module,
                data.enabled,
                route.endsWith('/brand'),
              );
            }
            if (route === '/availability' && method === 'GET')
              return service.whiteLabel.catalog(context);
            if (route === '/availability' && method === 'PUT')
              return service.whiteLabel.setCatalog(context, BranchCatalogSchema.parse(input));
            const retire = /^\/assignments\/([a-zA-Z0-9_-]+)\/retire$/.exec(route);
            if (retire && method === 'POST')
              return service.whiteLabel.retireAssignment(context, retire[1]);
            const transfer = /^\/units\/([a-zA-Z0-9_-]+)\/transfer$/.exec(route);
            if (transfer && method === 'POST') {
              const data = z
                .object({
                  branchId: z.string().min(1),
                  expectedRevision: z.number().int().nonnegative(),
                })
                .strict()
                .parse(input);
              await service.whiteLabel.requireModule(context, 'equipment');
              await service.whiteLabel.transferUnit(
                context,
                transfer[1],
                data.branchId,
                data.expectedRevision,
              );
              return {
                unit: (await service.units({ ...context, branchId: data.branchId })).find(
                  (u) => u.id === transfer[1],
                ),
              };
            }
            if (mutation && /^\/(units|machines)(?:\/|$)/.test(route))
              await service.whiteLabel.requireModule(context, 'equipment');
            if (mutation && route.startsWith('/website'))
              await service.whiteLabel.requireModule(context, 'website');
          }
          if (route === '/members' && method === 'GET')
            return { members: await service.members(context) };
          const membership = /^\/members\/([a-zA-Z0-9_-]+)$/.exec(route);
          if (membership && method === 'PATCH')
            return service.updateMembership(
              context,
              membership[1],
              MembershipUpdateSchema.parse(input),
            );
          if (route === '/coach-assignments' && method === 'POST')
            return service.assignCoach(context, CoachAssignmentSchema.parse(input));
          if (route === '/invitations' && method === 'POST')
            return service.invite(context, InvitationInputSchema.parse(input));
          if (route === '/brand' && method === 'PUT')
            return { organization: await service.brand(context, BrandInputSchema.parse(input)) };
          if (route === '/brand-media' && method === 'GET') {
            service.admin(context);
            return service.media(context, true);
          }
          if (route === '/media' && method === 'GET') return service.media(context);
          if (route === '/setup-progress' && method === 'GET')
            return service.setupProgress(context);
          if (route === '/website' && method === 'GET')
            return { website: await service.website(context) };
          if (route === '/website' && method === 'PUT') {
            const { expectedRevision, ...data } = WebsiteUpdateSchema.parse(input);
            return { website: await service.updateWebsite(context, data, expectedRevision) };
          }
          if (['/website/publish', '/website/unpublish'].includes(route) && method === 'POST')
            return {
              website: await service.publishWebsite(
                context,
                PublishSchema.parse(input).expectedRevision,
                route.endsWith('/unpublish'),
              ),
            };
          if (route === '/machines' && method === 'GET')
            return { machines: await service.machines(context) };
          if (route === '/machines' && method === 'POST')
            return {
              machine: await service.createMachine(context, MachineInputSchema.parse(input)),
            };
          const machine = /^\/machines\/([a-zA-Z0-9_-]+)$/.exec(route);
          if (machine && method === 'PUT') {
            const { expectedRevision, ...data } = MachineUpdateSchema.parse(input);
            return {
              machine: await service.updateMachine(context, machine[1], data, expectedRevision),
            };
          }
          const machineTransition = /^\/machines\/([a-zA-Z0-9_-]+)\/(review|publish)$/.exec(route);
          if (machineTransition && method === 'POST')
            return {
              machine: await service.transitionMachine(
                context,
                machineTransition[1],
                PublishSchema.parse(input).expectedRevision,
                machineTransition[2] === 'publish',
              ),
            };
          if (route === '/units' && method === 'GET')
            return { units: await service.units(context) };
          if (route === '/units' && method === 'POST')
            return { unit: await service.createUnit(context, UnitInputSchema.parse(input)) };
          if (route === '/units/batch' && method === 'POST')
            return { units: await service.batchUnits(context, UnitBatchSchema.parse(input)) };
          const unit = /^\/units\/([a-zA-Z0-9_-]+)$/.exec(route);
          if (unit && method === 'PUT') {
            const { expectedRevision, ...data } = UnitUpdateSchema.parse(input);
            return { unit: await service.updateUnit(context, unit[1], data, expectedRevision) };
          }
          if (route === '/exercises' && method === 'GET')
            return { exercises: await service.exercises(context) };
          if (route === '/exercises' && method === 'POST')
            return {
              exercise: await service.createExercise(context, ExerciseInputSchema.parse(input)),
            };
          const exercise = /^\/exercises\/([a-zA-Z0-9_-]+)(\/publish)?$/.exec(route);
          if (exercise && !exercise[2] && method === 'PUT') {
            const { expectedRevision, ...data } = ExerciseUpdateSchema.parse(input);
            return {
              exercise: await service.updateExercise(context, exercise[1], data, expectedRevision),
            };
          }
          if (exercise?.[2] && method === 'POST')
            return {
              exercise: await service.publishExercise(
                context,
                exercise[1],
                PublishSchema.parse(input).expectedRevision,
              ),
            };
          const exerciseReview = /^\/exercises\/([a-zA-Z0-9_-]+)\/review$/.exec(route);
          if (exerciseReview && method === 'POST')
            return {
              exercise: await service.reviewExercise(
                context,
                exerciseReview[1],
                PublishSchema.parse(input).expectedRevision,
              ),
            };
          if (route === '/programs' && method === 'GET')
            return { programs: await service.programs(context) };
          if (route === '/programs' && method === 'POST')
            return {
              program: await service.createProgram(
                context,
                ProgramInputSchema.parse(input),
                z.uuid().optional().parse(request.headers['idempotency-key']),
              ),
            };
          const publishedProgram = /^\/programs\/([a-zA-Z0-9_-]+)\/versions\/([1-9][0-9]*)$/.exec(
            route,
          );
          if (publishedProgram && method === 'GET')
            return {
              version: await service.programVersion(
                context,
                publishedProgram[1],
                z.coerce.number().int().positive().max(2147483647).parse(publishedProgram[2]),
              ),
            };
          const program = /^\/programs\/([a-zA-Z0-9_-]+)(\/publish)?$/.exec(route);
          if (program && !program[2] && method === 'PUT') {
            const { expectedRevision, ...data } = ProgramUpdateSchema.parse(input);
            return {
              program: await service.updateProgram(context, program[1], data, expectedRevision),
            };
          }
          if (program?.[2] && method === 'POST')
            return {
              version: await service.publishProgram(
                context,
                program[1],
                PublishSchema.parse(input).expectedRevision,
              ),
            };
          if (route === '/assignments' && method === 'GET')
            return {
              assignments: await service.assignments(
                context,
                url.searchParams.get('memberId') ?? undefined,
              ),
            };
          if (route === '/assignments' && method === 'POST')
            return {
              assignment: await service.assignProgram(
                context,
                ProgramAssignmentSchema.parse(input),
                z.uuid().optional().parse(request.headers['idempotency-key']),
              ),
            };
          if (route === '/executions' && method === 'GET')
            return {
              executions: await service.executions(
                context,
                url.searchParams.get('memberId') ?? undefined,
              ),
            };
          if (route === '/executions' && method === 'POST')
            return {
              execution: await service.recordExecution(context, ExecutionInputSchema.parse(input)),
            };
          if (route === '/reports' && method === 'GET') return service.report(context);
          throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        },
        work,
      );
      return json(response, method === 'POST' ? 201 : 200, output);
    } catch (error) {
      request.resume();
      if (response.headersSent || response.destroyed) {
        response.end();
        return;
      }
      if (error instanceof HttpError)
        return json(
          response,
          error.status === 421 &&
            request.headers['x-klisteni-b2b-entry-mode'] === 'nginx' &&
            request.url?.split('?')[0] === `${API_PREFIX}/domain-entry`
            ? 403
            : error.status,
          {
            code: error.code,
            error: error.message,
            ...(error.issues ? { issues: error.issues } : {}),
          },
        );
      if (error instanceof ZodError)
        return json(response, 400, {
          code: 'INVALID_INPUT',
          error: 'Revisá los campos de la solicitud.',
        });
      console.error('B2B request failed');
      return json(response, 500, {
        code: 'INTERNAL_ERROR',
        error: 'No pudimos completar la operación.',
      });
    }
  });
  // Bounded allowance for raw media uploads over ordinary upstream connections.
  server.requestTimeout = 120000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
