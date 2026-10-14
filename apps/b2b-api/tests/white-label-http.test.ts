import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { before, after, describe, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  ThemeInputSchema,
  ExecutionInputSchema,
  type Assignment,
  type Execution,
} from '@klisteniapp/b2b-contracts';
import { createAuth } from '../src/auth.ts';
import { createApiServer } from '../src/http.ts';
import { migrate } from '../src/migrate.ts';
import { seedWhiteLabelDemo } from '../src/white-label-demo.ts';
import type { Config } from '../src/config.ts';
const databaseUrl = process.env.B2B_TEST_DATABASE_URL;
const password = 'white-label-http-test-password';

describe('WL domain and branch HTTP authorization', { skip: !databaseUrl }, () => {
  const schema = `b2b_wl_http_${randomUUID().replaceAll('-', '')}`;
  let owner: Pool, pool: Pool, server: Server, base: string, config: Config, mediaRoot: string;
  let fixture: Awaited<ReturnType<typeof seedWhiteLabelDemo>>;
  type Client = {
    host: string;
    cookie: string;
    id: string;
    branch?: string;
    role?: string;
    request: (
      method: string,
      path: string,
      body?: unknown,
      headers?: Record<string, string>,
    ) => Promise<Response>;
  };
  async function result<T = Record<string, unknown>>(response: Response, status = 200): Promise<T> {
    assert.equal(response.status, status, await response.clone().text());
    return response.json() as Promise<T>;
  }
  function client(host: string): Client {
    const c: Client = {
      host,
      cookie: '',
      id: '',
      request: async (method, path, body, headers = {}) => {
        const response = await fetch(`${base}/api/b2b${path}`, {
          method,
          headers: {
            'content-type': 'application/json',
            origin: `http://${c.host}`,
            'x-klisteni-b2b-host': c.host,
            'x-klisteni-b2b-proto': 'http',
            'x-klisteni-b2b-proxy-secret': config.proxySecret!,
            ...(c.cookie ? { cookie: c.cookie } : {}),
            ...(c.id ? { 'x-klisteni-b2b-account': c.id } : {}),
            ...(c.branch
              ? { 'x-klisteni-b2b-branch': c.branch, 'x-klisteni-b2b-role': c.role! }
              : {}),
            ...headers,
          },
          ...(body === undefined
            ? {}
            : { body: Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body) }),
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) c.cookie = cookies.map((v) => v.split(';')[0]).join('; ');
        return response;
      },
    };
    return c;
  }
  async function login(host: string, email: string, branch?: string, role = 'member') {
    // Isolated fixture setup: independent cases do not share the login throttling window.
    await pool.query('DELETE FROM b2b_auth_rate_limit');
    const c = client(host);
    const signed = await result<{ user: { id: string } }>(
      await c.request('POST', '/auth/sign-in/email', { email, password }),
    );
    c.id = signed.user.id;
    c.branch = branch;
    c.role = role;
    return c;
  }
  const path = (route: string, org = 'atlas-demo') => `/orgs/${org}${route}`;
  before(async () => {
    const url = new URL(databaseUrl!);
    assert.match(url.pathname, /b2b.*test|test.*b2b/i);
    assert.equal(url.searchParams.has('options'), false);
    owner = new Pool({ connectionString: url.href });
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href });
    mediaRoot = await mkdtemp(join(tmpdir(), 'b2b-wl-http-'));
    config = {
      databaseUrl: url.href,
      secret: 'http-test-auth-secret-12345678901234567890',
      origin: 'http://atlas.b2b.test',
      host: '127.0.0.1',
      port: 0,
      production: false,
      demoMode: true,
      whiteLabel: true,
      proxySecret: 'http-test-proxy-secret-12345678901234567890',
      domainProtocol: 'http',
      mediaRoot,
    };
    const auth = createAuth(pool, config);
    await migrate(pool, auth);
    fixture = await seedWhiteLabelDemo(pool, auth, config, password);
    server = createApiServer({ pool, auth, config });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool?.end();
    if (owner) {
      await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await owner.end();
    }
    if (mediaRoot) await rm(mediaRoot, { recursive: true, force: true });
  });
  test('D01/D02 published identity by trusted host; unknown/unverified/spoofed host and direct API fail closed', async () => {
    for (const gym of fixture.gyms) {
      const c = client(gym.host);
      const context = await result<{ organization: { id: string }; branches: unknown[] }>(
        await c.request('GET', '/context'),
      );
      assert.equal(context.organization.id, gym.id);
      assert.equal(context.branches.length, 2);
    }
    assert.equal((await client('unknown.b2b.test').request('GET', '/context')).status, 421);
    assert.equal(
      (
        await fetch(`${base}/api/b2b/context`, {
          headers: { host: 'atlas.b2b.test', 'x-forwarded-host': 'atlas.b2b.test' },
        })
      ).status,
      421,
    );
    assert.equal(
      (
        await client('atlas.b2b.test').request('GET', '/context', undefined, {
          'x-klisteni-b2b-proxy-secret': 'spoofed',
        })
      ).status,
      421,
    );
  });
  test('legacy runtime cannot bypass branch authorization after white-label data exists', async () => {
    const legacyConfig = { ...config, whiteLabel: false };
    const legacy = createApiServer({
      pool,
      config: legacyConfig,
      auth: createAuth(pool, legacyConfig),
    });
    await new Promise<void>((resolve) => legacy.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${(legacy.address() as AddressInfo).port}/api/b2b`;
      for (const path of ['/context', '/public/atlas-demo', '/me'])
        assert.equal((await fetch(`${url}${path}`)).status, 503);
      assert.equal((await fetch(`${url}/readyz`)).status, 200);
    } finally {
      legacy.closeAllConnections();
      await new Promise<void>((resolve) => legacy.close(() => resolve()));
    }
  });
  test('D03-D07 login belongs to host; roles/sedes are explicit and copied tokens and cross origins fail', async () => {
    const denied = client('atlas.b2b.test');
    assert.equal(
      (
        await denied.request('POST', '/auth/sign-in/email', {
          email: 'member@sur.example.test',
          password,
        })
      ).status,
      401,
    );
    assert.equal(denied.cookie, '');
    const c = await login(
      'atlas.b2b.test',
      'coach@atlas.example.test',
      'atlas-demo-principal',
      'coach',
    );
    const me = await result<{
      memberships: { organization: { id: string } }[];
      whiteLabel: { branches: { branch: { id: string }; roles: string[] }[] };
    }>(await c.request('GET', '/me'));
    assert.deepEqual(
      me.memberships.map((m) => m.organization.id),
      ['atlas-demo'],
    );
    assert.equal(me.whiteLabel.branches.length, 1);
    assert.equal((await c.request('GET', path('/units', 'sur-demo'))).status, 404);
    assert.equal(
      (
        await c.request('GET', path('/units'), undefined, {
          'x-klisteni-b2b-branch': 'atlas-demo-norte',
        })
      ).status,
      403,
    );
    assert.equal(
      (await c.request('GET', path('/units'), undefined, { 'x-klisteni-b2b-role': 'admin' }))
        .status,
      400,
    );
    assert.equal(
      (await c.request('POST', path('/programs'), {}, { origin: 'http://sur.b2b.test' })).status,
      403,
    );
    const copied = client('sur.b2b.test');
    copied.cookie = c.cookie;
    assert.equal((await copied.request('GET', '/me')).status, 401);
    const dual = await login('atlas.b2b.test', fixture.multi.email);
    const scope = await result<{
      whiteLabel: { branches: { branch: { slug: string }; roles: string[] }[] };
    }>(await dual.request('GET', '/me'));
    assert.deepEqual(
      scope.whiteLabel.branches.map((b) => [b.branch.slug, b.roles]),
      [
        ['centro', ['coach']],
        ['norte', ['member']],
      ],
    );
    assert.equal((await dual.request('GET', path('/units'))).status, 400);
  });
  test('D09/D14 independent branch publication and identity draft/publish/restore', async () => {
    const admin = await login(
      'atlas.b2b.test',
      'admin@atlas.example.test',
      'atlas-demo-principal',
      'admin',
    );
    const before = await result<{ theme: ReturnType<typeof ThemeInputSchema.parse> }>(
      await client(admin.host).request('GET', '/context'),
    );
    const state = await result<{
      theme: { draft: ReturnType<typeof ThemeInputSchema.parse>; revision: number };
    }>(await admin.request('GET', path('/theme')));
    const theme = { ...state.theme.draft, loginTitle: 'Nueva identidad Atlas' };
    const updated = await result<{ theme: { revision: number } }>(
      await admin.request('PUT', path('/theme'), {
        ...theme,
        expectedRevision: state.theme.revision,
      }),
    );
    assert.equal(
      (
        await result<{ theme: { loginTitle: string } }>(
          await client(admin.host).request('GET', '/context'),
        )
      ).theme.loginTitle,
      before.theme.loginTitle,
    );
    const published = await result<{ theme: { revision: number } }>(
      await admin.request('POST', path('/theme/publish'), {
        expectedRevision: updated.theme.revision,
      }),
      201,
    );
    assert.equal(
      (
        await result<{ theme: { loginTitle: string } }>(
          await client(admin.host).request('GET', '/context'),
        )
      ).theme.loginTitle,
      theme.loginTitle,
    );
    await result(
      await admin.request('POST', path('/theme/restore'), {
        expectedRevision: published.theme.revision,
        version: 1,
      }),
      201,
    );
    const site = await result<{ website: { revision: number } }>(
      await admin.request('GET', path('/website')),
    );
    await result(
      await admin.request('POST', path('/website/unpublish'), {
        expectedRevision: site.website.revision,
      }),
      201,
    );
    assert.equal(
      (await client(admin.host).request('GET', '/public/atlas-demo?branch=centro')).status,
      404,
    );
    assert.equal(
      (await client(admin.host).request('GET', '/public/atlas-demo?branch=norte')).status,
      200,
    );
    assert.equal((await client(admin.host).request('GET', '/context')).status, 200);
    assert.equal(
      (await client(admin.host).request('GET', '/public/sur-demo?branch=centro')).status,
      404,
    );
    const current = await result<{ website: { revision: number } }>(
      await admin.request('GET', path('/website')),
    );
    await result(
      await admin.request('POST', path('/website/publish'), {
        expectedRevision: current.website.revision,
      }),
      201,
    );
  });
  test('D08 new and existing invitations bind one branch, explicit consent, expiry and one-use', async () => {
    const admin = await login(
      'atlas.b2b.test',
      'admin@atlas.example.test',
      'atlas-demo-norte',
      'admin',
    );
    const invite = await result<{ url: string }>(
      await admin.request('POST', path('/invitations'), {
        email: 'invited@wl.example.test',
        name: 'Invitada',
        role: 'member',
      }),
      201,
    );
    const link = new URL(invite.url);
    assert.equal(link.search, '');
    const token = new URLSearchParams(link.hash.slice(1)).get('token')!;
    assert.equal(
      (
        await client('sur.b2b.test').request('POST', '/invitations/accept', {
          token,
          name: 'Invitada',
          password,
        })
      ).status,
      400,
    );
    await result(
      await client(admin.host).request('POST', '/invitations/accept', {
        token,
        name: 'Invitada',
        password,
      }),
      201,
    );
    assert.equal(
      (
        await client(admin.host).request('POST', '/invitations/accept', {
          token,
          name: 'Invitada',
          password,
        })
      ).status,
      400,
    );
    const joined = await login(admin.host, 'invited@wl.example.test');
    const me = await result<{ whiteLabel: { branches: { branch: { id: string } }[] } }>(
      await joined.request('GET', '/me'),
    );
    assert.deepEqual(
      me.whiteLabel.branches.map((b) => b.branch.id),
      ['atlas-demo-norte'],
    );
    const existing = await result<{ url: string }>(
      await admin.request('POST', path('/invitations'), {
        email: 'member@sur.example.test',
        name: 'Socio Sur',
        role: 'member',
      }),
      201,
    );
    const existingToken = new URLSearchParams(new URL(existing.url).hash.slice(1)).get('token')!;
    const newcomer = client(admin.host);
    assert.equal(
      (
        await newcomer.request('POST', '/invitations/sign-in', {
          email: 'member@sur.example.test',
          password,
          token: existingToken,
          consent: false,
        })
      ).status,
      400,
    );
    await pool.query('DELETE FROM b2b_auth_rate_limit');
    await result(
      await newcomer.request('POST', '/invitations/sign-in', {
        email: 'member@sur.example.test',
        password,
        token: existingToken,
        consent: true,
      }),
    );
    assert.deepEqual(
      (
        await result<{ whiteLabel: { branches: { branch: { id: string } }[] } }>(
          await newcomer.request('GET', '/me'),
        )
      ).whiteLabel.branches.map((b) => b.branch.id),
      ['atlas-demo-norte'],
    );
    const expired = await result<{ url: string }>(
      await admin.request('POST', path('/invitations'), {
        email: 'expired@wl.example.test',
        name: 'Vencida',
        role: 'coach',
      }),
      201,
    );
    await pool.query(
      "UPDATE b2b_invitation SET expires_at=now()-interval '1 second' WHERE email='expired@wl.example.test'",
    );
    assert.equal(
      (
        await client(admin.host).request('POST', '/invitations/accept', {
          token: new URLSearchParams(new URL(expired.url).hash.slice(1)).get('token'),
          name: 'Vencida',
          password,
        })
      ).status,
      400,
    );
  });
  test('D10 private media requires branch reference for GET HEAD Range and never crosses brands', async () => {
    const admin = await login(
      'atlas.b2b.test',
      'admin@atlas.example.test',
      'atlas-demo-norte',
      'admin',
    );
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
      'base64',
    );
    const uploaded = await result<{
      media: { id: string; url: string; kind: string; label: string; attribution: string };
    }>(
      await admin.request('POST', path('/media?kind=image&label=Norte'), bytes, {
        'content-type': 'image/png',
      }),
      201,
    );
    const branding = await result<{ media: { url: string } }>(
      await admin.request('POST', path('/brand-media?kind=image&label=Logo'), bytes, {
        'content-type': 'image/png',
      }),
      201,
    );
    const brandRoute = branding.media.url.slice('/api/b2b'.length);
    assert.equal((await client(admin.host).request('GET', brandRoute)).status, 404);
    const theme = await result<{
      theme: { draft: ReturnType<typeof ThemeInputSchema.parse>; revision: number };
    }>(await admin.request('GET', path('/theme')));
    const editedTheme = await result<{ theme: { revision: number } }>(
      await admin.request('PUT', path('/theme'), {
        ...theme.theme.draft,
        brand: { ...theme.theme.draft.brand, logoUrl: branding.media.url },
        expectedRevision: theme.theme.revision,
      }),
    );
    assert.equal((await client(admin.host).request('GET', brandRoute)).status, 404);
    const liveTheme = await result<{ theme: { revision: number } }>(
      await admin.request('POST', path('/theme/publish'), {
        expectedRevision: editedTheme.theme.revision,
      }),
      201,
    );
    assert.equal((await client(admin.host).request('GET', brandRoute)).status, 200);
    await result(
      await admin.request('POST', path('/theme/restore'), {
        expectedRevision: liveTheme.theme.revision,
        version: 1,
      }),
      201,
    );
    assert.equal((await client(admin.host).request('GET', brandRoute)).status, 404);
    const route = uploaded.media.url.slice('/api/b2b'.length);
    const centerCoach = await login(
      admin.host,
      'coach@atlas.example.test',
      'atlas-demo-principal',
      'coach',
    );
    const northCoach = await login(
      admin.host,
      'coach-norte@atlas.example.test',
      'atlas-demo-norte',
      'coach',
    );
    assert.equal(
      (
        await northCoach.request('POST', path('/brand-media?kind=image&label=Blocked'), bytes, {
          'content-type': 'image/png',
        })
      ).status,
      403,
    );
    for (const method of ['GET', 'HEAD']) {
      assert.equal((await client(admin.host).request(method, route)).status, 404);
      assert.equal((await centerCoach.request(method, route)).status, 404);
      assert.equal((await client('sur.b2b.test').request(method, route)).status, 404);
      assert.equal((await northCoach.request(method, route)).status, 200);
    }
    const range = await northCoach.request('GET', route, undefined, { range: 'bytes=0-3' });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('cache-control'), 'no-store');
    assert.equal((await range.arrayBuffer()).byteLength, 4);
    const website = await result<{ website: { draft: Record<string, unknown>; revision: number } }>(
      await admin.request('GET', path('/website')),
    );
    const { id, url, kind, label, attribution } = uploaded.media;
    const edited = await result<{ website: { revision: number } }>(
      await admin.request('PUT', path('/website'), {
        ...website.website.draft,
        gallery: [{ id, url, kind, label, attribution }],
        expectedRevision: website.website.revision,
      }),
    );
    await result(
      await admin.request('POST', path('/website/publish'), {
        expectedRevision: edited.website.revision,
      }),
      201,
    );
    assert.equal((await client(admin.host).request('GET', route)).status, 200);
    assert.equal((await client('sur.b2b.test').request('GET', route)).status, 404);
  });
  test('D11/D12/D15/D17 record in four branches, coach isolation, exact retry, capabilities and preserved own history', async () => {
    for (const gym of fixture.gyms)
      for (const branch of gym.branches) {
        const member = await login(gym.host, branch.member.email, branch.id, 'member');
        const list = await result<{ assignments: Assignment[] }>(
          await member.request('GET', path('/assignments', gym.id)),
        );
        assert.equal(list.assignments.length, 1);
        const a = list.assignments[0];
        assert.equal(a.branchId, branch.id);
        const now = new Date().toISOString();
        const payload = ExecutionInputSchema.parse({
          id: randomUUID(),
          assignmentId: a.id,
          completedAt: now,
          status: 'completed',
          notes: 'WL HTTP evidence',
          sets: a.program.steps.flatMap((step) =>
            Array.from({ length: step.sets }, (_, i) => ({
              stepId: step.id,
              exerciseId: step.exerciseId,
              set: i + 1,
              reps: step.reps ?? null,
              loadKg: step.loadKg ?? null,
            })),
          ),
        });
        const first = await member.request('POST', path('/executions', gym.id), payload);
        await result(first, 201);
        await result(await member.request('POST', path('/executions', gym.id), payload), 201);
        const coach = await login(gym.host, branch.coach.email, branch.id, 'coach');
        const rows = await result<{ executions: Execution[] }>(
          await coach.request('GET', path('/executions', gym.id)),
        );
        assert.ok(rows.executions.some((e) => e.id === payload.id));
      }
    const admin = await login(
      'atlas.b2b.test',
      'admin@atlas.example.test',
      'atlas-demo-norte',
      'admin',
    );
    await result(
      await admin.request('PUT', path('/modules'), { module: 'equipment', enabled: false }),
    );
    assert.equal(
      (
        await admin.request('POST', path('/units'), {
          machineId: 'base-cable-station-v1',
          label: 'Blocked',
        })
      ).status,
      403,
    );
    assert.equal((await admin.request('GET', path('/units'))).status, 200);
    await result(
      await admin.request('PUT', path('/modules'), { module: 'equipment', enabled: true }),
    );
    await result(
      await admin.request(
        'POST',
        path(`/assignments/${fixture.gyms[0].branches[1].assignmentId}/retire`),
        {},
      ),
      201,
    );
    await result(
      await admin.request('PUT', path('/grants'), {
        branchId: admin.branch,
        userId: fixture.gyms[0].branches[1].member.id,
        role: 'member',
        active: false,
      }),
    );
    const former = await login(
      'atlas.b2b.test',
      fixture.gyms[0].branches[1].member.email,
      admin.branch,
      'member',
    );
    assert.equal((await former.request('GET', path('/units'))).status, 403);
    const history = await result<{ executions: Execution[] }>(
      await former.request('GET', '/history/executions'),
    );
    assert.equal(history.executions.length, 1);
    assert.equal(history.executions[0].branchId, admin.branch);
  });
  test('duplicate branch slug is a recoverable conflict and never inserts a second branch', async () => {
    const admin = await login(
      'atlas.b2b.test',
      'admin@atlas.example.test',
      'atlas-demo-principal',
      'admin',
    );
    const input = { slug: 'qa-duplicate', name: 'QA branch', timezone: 'UTC' };
    await result(await admin.request('POST', path('/branches'), input), 201);
    const response = await admin.request('POST', path('/branches'), {
      ...input,
      name: 'Other name',
    });
    const error = await result<{ code: string }>(response, 409);
    assert.equal(error.code, 'BRANCH_SLUG_TAKEN');
    const rows = await pool.query(
      'SELECT name FROM b2b_branch WHERE organization_id=$1 AND slug=$2',
      ['atlas-demo', input.slug],
    );
    assert.deepEqual(rows.rows, [{ name: input.name }]);
  });
});
