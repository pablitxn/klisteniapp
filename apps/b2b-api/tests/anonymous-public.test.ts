import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { before, after, describe, test } from 'node:test';
import { Pool } from 'pg';
import { createAuth } from '../src/auth.ts';
import { migrate } from '../src/migrate.ts';
import { createApiServer } from '../src/http.ts';
import { createMediaStore } from '../src/media.ts';
import { seedWhiteLabelDemo } from '../src/white-label-demo.ts';
import type { Config } from '../src/config.ts';

const source = process.env.B2B_TEST_DATABASE_URL;
describe('Anonymous white-label publication regressions', { skip: !source }, () => {
  const schema = `b2b_anonymous_${randomUUID().replaceAll('-', '')}`;
  let owner: Pool, pool: Pool, server: Server, base: string, mediaRoot: string, mediaUrl: string;
  const config: Config = {
    databaseUrl: '',
    secret: randomUUID() + randomUUID(),
    origin: 'http://atlas.b2b.test',
    host: '127.0.0.1',
    port: 0,
    production: false,
    demoMode: true,
    whiteLabel: true,
    domainProtocol: 'http',
    proxySecret: randomUUID() + randomUUID(),
  };
  async function request(path: string, host = 'atlas.b2b.test', method = 'GET') {
    return fetch(`${base}/api/b2b${path}`, {
      method,
      headers: {
        'x-klisteni-b2b-host': host,
        'x-klisteni-b2b-proto': 'http',
        'x-klisteni-b2b-proxy-secret': config.proxySecret!,
      },
    });
  }
  before(async () => {
    const url = new URL(source!);
    assert.match(url.pathname, /b2b.*test|test.*b2b/i);
    assert.equal(url.searchParams.has('options'), false);
    owner = new Pool({ connectionString: url.href });
    await owner.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.href });
    mediaRoot = await mkdtemp(join(tmpdir(), 'b2b-anonymous-api-'));
    Object.assign(config, { databaseUrl: url.href, mediaRoot });
    const auth = createAuth(pool, config);
    await migrate(pool, auth);
    const fixture = await seedWhiteLabelDemo(pool, auth, config, 'anonymous-test-only-password');
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
      'base64',
    );
    const media = await createMediaStore(mediaRoot).ingest({
      body: Readable.from([bytes]),
      contentType: 'image/png',
      kind: 'image',
    });
    await pool.query(
      `INSERT INTO b2b_media(id,organization_id,created_by,kind,label,attribution,relative_path,mime,bytes,sha256)
      VALUES($1,'atlas-demo',$2,'image','Brand public photo','Synthetic',$3,$4,$5,$6)`,
      [
        media.id,
        fixture.gyms[0].admin.id,
        media.relativePath,
        media.mime,
        media.bytes,
        media.sha256,
      ],
    );
    mediaUrl = `/media/${media.id}`;
    const asset = {
      id: media.id,
      kind: 'image',
      url: `/api/b2b${mediaUrl}`,
      label: 'Brand public photo',
      attribution: 'Synthetic',
    };
    await pool.query(
      "UPDATE b2b_website SET published=jsonb_set(published,'{content,gallery}',$1) WHERE organization_id='atlas-demo'",
      [JSON.stringify([asset])],
    );
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
  test('branch website and QR return only published branch contact, never live drafts', async () => {
    await pool.query(`UPDATE b2b_branch SET address='Private changed address',contact='Private changed contact',
      published_profile=jsonb_set(jsonb_set(published_profile,'{address}','"Published North address"'),'{contact}','"Published North contact"') WHERE id='atlas-demo-norte'`);
    for (const path of [
      '/public/atlas-demo?branch=norte',
      '/public/atlas-demo/units/atlas-demo-norte-cable-01',
    ]) {
      const response = await request(path);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.organization.brand.address, 'Published North address');
      assert.equal(data.organization.brand.contact, 'Published North contact');
      assert.ok(!JSON.stringify(data).includes('Private changed'));
    }
    const root = await (await request('/public/atlas-demo')).json();
    assert.equal(root.organization.brand.address, 'Sala de entrenamiento demo');
  });
  test('root-only published media supports GET HEAD Range and remains brand isolated', async () => {
    const response = await request(mediaUrl);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    assert.equal((await request(mediaUrl, 'atlas.b2b.test', 'HEAD')).status, 200);
    assert.equal((await request(mediaUrl, 'sur.b2b.test')).status, 404);
    const ranged = await fetch(`${base}/api/b2b${mediaUrl}`, {
      headers: {
        'x-klisteni-b2b-host': 'atlas.b2b.test',
        'x-klisteni-b2b-proto': 'http',
        'x-klisteni-b2b-proxy-secret': config.proxySecret!,
        range: 'bytes=0-7',
      },
    });
    assert.equal(ranged.status, 206);
    assert.equal((await ranged.arrayBuffer()).byteLength, 8);
  });
  test('brand publication is independent of public branches, and unpublish revokes root media', async () => {
    await pool.query("UPDATE b2b_branch SET public=false WHERE organization_id='atlas-demo'");
    let context = await (await request('/context')).json();
    assert.equal(context.websitePublished, true);
    assert.deepEqual(context.branches, []);
    assert.equal((await request(mediaUrl)).status, 200);
    await pool.query("UPDATE b2b_branch SET public=true WHERE organization_id='atlas-demo'");
    await pool.query(
      "UPDATE b2b_website SET draft=published,published=NULL WHERE organization_id='atlas-demo'",
    );
    context = await (await request('/context')).json();
    assert.equal(context.websitePublished, false);
    assert.equal(context.branches.length, 2);
    assert.equal((await request('/public/atlas-demo?branch=norte')).status, 200);
    assert.equal((await request(mediaUrl)).status, 404);
  });
  test('missing published profile denies direct unit URL as well as branch page', async () => {
    await pool.query("UPDATE b2b_branch SET published_profile=NULL WHERE id='atlas-demo-norte'");
    assert.equal((await request('/public/atlas-demo?branch=norte')).status, 404);
    assert.equal((await request('/public/atlas-demo/units/atlas-demo-norte-cable-01')).status, 404);
  });
});
