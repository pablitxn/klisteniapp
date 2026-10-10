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
} from '@klisteniapp/b2b-contracts';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import { B2BService } from './service.ts';
import { HttpError } from './errors.ts';
import { createMediaStore, MEDIA_LIMITS } from './media.ts';

const TOKEN = z.object({ token: z.string().min(32).max(200) }).strict();
async function body(request: IncomingMessage): Promise<unknown> {
  const maximum = 1024 * 1024;
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
      key !== 'cf-connecting-ip'
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
  const server = createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    try {
      const url = new URL(request.url ?? '/', config.origin),
        method = request.method ?? 'GET';
      if (url.pathname === `${API_PREFIX}/healthz` && method === 'GET')
        return json(response, 200, { status: 'ok' });
      if (url.pathname === `${API_PREFIX}/readyz` && method === 'GET') {
        try {
          await pool.query(
            'SELECT organization_id,member_id,assignment_id,data FROM b2b_execution LIMIT 0',
          );
          await pool.query('SELECT id FROM b2b_auth_user LIMIT 0');
          if (
            !(await pool.query("SELECT id FROM b2b_migration WHERE id='003-content-media'"))
              .rowCount
          )
            throw new Error('Missing migration');
          return json(response, 200, { status: 'ready' });
        } catch {
          return json(response, 503, { status: 'unavailable' });
        }
      }
      if (!url.pathname.startsWith(`${API_PREFIX}/`))
        throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      const path = url.pathname.slice(API_PREFIX.length);
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const upload = method === 'POST' && /^\/orgs\/[a-zA-Z0-9_-]+\/media$/.test(path);
      if (mutation) {
        if (
          request.headers.origin !== config.origin ||
          request.headers['sec-fetch-site'] === 'cross-site'
        )
          throw new HttpError(403, 'INVALID_ORIGIN', 'Origen no permitido.');
        if (
          !upload &&
          request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json'
        )
          throw new HttpError(415, 'INVALID_CONTENT_TYPE', 'La solicitud debe usar JSON.');
      }
      const requestHeaders = headers(request);
      if (path.startsWith('/auth/')) {
        const routes = new Map([
          ['/auth/sign-in/email', 'POST'],
          ['/auth/sign-out', 'POST'],
          ['/auth/get-session', 'GET'],
          ['/auth/change-password', 'POST'],
        ]);
        if (routes.get(path) !== method)
          throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
        const value = mutation ? await body(request) : undefined;
        const result = await auth.handler(
          new Request(`${config.origin}${url.pathname}`, {
            method,
            headers: requestHeaders,
            ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
          }),
        );
        for (const [key, value] of result.headers)
          if (key !== 'set-cookie') response.setHeader(key, value);
        response.setHeader('set-cookie', result.headers.getSetCookie());
        response.statusCode = result.status;
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      const publicPath = /^\/public\/([a-z0-9-]+)(?:\/units\/([a-zA-Z0-9_-]+))?$/.exec(path);
      if (publicPath && method === 'GET')
        return json(response, 200, await service.publicSite(publicPath[1], publicPath[2]));
      if (path === '/invitations/accept' && method === 'POST') {
        await service.limit(`invitation:${request.socket.remoteAddress ?? 'unknown'}`);
        const input = AcceptInvitationSchema.parse(await body(request));
        return json(response, 201, await service.acceptInvitation(input.token, input));
      }
      const session = await auth.api.getSession({ headers: requestHeaders });
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
      if (path === '/me' && method === 'GET')
        return json(
          response,
          200,
          await service.me({ id: actor, name: session.user.name, email: session.user.email }),
        );
      if (path === '/invitations/join' && method === 'POST')
        return json(
          response,
          200,
          await service.acceptInvitation(TOKEN.parse(await body(request)).token, undefined, {
            userId: actor,
            sessionId: session.session.id,
          }),
        );
      const orgPath = /^\/orgs\/([a-zA-Z0-9_-]+)(\/.*)$/.exec(path);
      if (!orgPath) throw new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      const orgId = orgPath[1],
        route = orgPath[2];
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
          await service.organization(actor, orgId, session.session.id, true, (c) =>
            service.uploadAllowance(c, bytes),
          );
          const stored = await mediaStore.ingest({
            body: request.iterator({ destroyOnReturn: false }),
            contentType: request.headers['content-type'] ?? '',
            kind: metadata.kind,
          });
          try {
            const media = await service.organization(actor, orgId, session.session.id, true, (c) =>
              service.saveMedia(c, stored, metadata),
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
              program: await service.createProgram(context, ProgramInputSchema.parse(input)),
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
      );
      return json(response, method === 'POST' ? 201 : 200, output);
    } catch (error) {
      request.resume();
      if (response.headersSent || response.destroyed) {
        response.end();
        return;
      }
      if (error instanceof HttpError)
        return json(response, error.status, { code: error.code, error: error.message });
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
