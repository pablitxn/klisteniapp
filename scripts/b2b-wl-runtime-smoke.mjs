// Runs already-built test images locally. Own schema/containers; never deploys production.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { createAuth } from '../apps/b2b-api/src/auth.ts';
import { seedWhiteLabelDemo } from '../apps/b2b-api/src/white-label-demo.ts';
import { whiteLabelTLS } from './b2b-wl-tls.mjs';

const requireApi = createRequire(new URL('../apps/b2b-api/package.json', import.meta.url));
const { Pool } = requireApi('pg');
const source = new URL(process.env.B2B_TEST_DATABASE_URL ?? 'missing:');
if (!/^postgres(?:ql)?:$/.test(source.protocol) || !/(?:b2b.*test|test.*b2b)/i.test(decodeURIComponent(source.pathname)) || source.searchParams.has('options'))
  throw new Error('Use a dedicated disposable B2B test database without connection options.');
const apiImage = 'klisteni-b2b-api:wl-test', webImage = 'klisteni-b2b-web:wl-test';
const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
const schema = `b2b_wl_image_${suffix}`, containers = [];
const directory = mkdtempSync(join(tmpdir(), 'klisteni-wl-image-'));
const owner = new Pool({ connectionString: source.href });
const scoped = new URL(source); scoped.searchParams.set('options', `-c search_path=${schema}`);
const pool = new Pool({ connectionString: scoped.href });
const certificate = whiteLabelTLS(), evidence = { checkedAt: new Date().toISOString(), images: {}, checks: [], productionDeployed: false };
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function unusedPort() {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
const apiPort = await unusedPort(), webPort = await unusedPort();
const secret = randomBytes(40).toString('hex'), proxySecret = randomBytes(40).toString('hex');
const config = { databaseUrl: scoped.href, secret, origin: 'https://atlas.b2b.test', host: '127.0.0.1', port: apiPort,
  production: false, demoMode: true, whiteLabel: true, proxySecret, trustedProxyAddresses: ['127.0.0.1'], domainProtocol: 'https' };
const envFile = join(directory, 'runtime.env');
writeFileSync(envFile, Object.entries({ B2B_DATABASE_URL: scoped.href, B2B_AUTH_SECRET: secret, B2B_APP_ORIGIN: config.origin,
  B2B_HOST: '127.0.0.1', B2B_PORT: apiPort, B2B_WHITE_LABEL: 'true', B2B_PROXY_SECRET: proxySecret,
  B2B_TRUSTED_PROXY_ADDRESSES: '127.0.0.1', B2B_DOMAIN_PROTOCOL: 'https', NODE_ENV: 'production' }).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
const nginx = readFileSync(new URL('../docker/nginx.b2b.conf', import.meta.url), 'utf8')
  .replace('server b2b-api:4201;', `server 127.0.0.1:${apiPort};`).replace('listen 8080;', `listen 127.0.0.1:${webPort};`);
writeFileSync(join(directory, 'nginx.conf'), nginx);
writeFileSync(join(directory, 'identity.conf'), `map "" $b2b_proxy_secret { default "${proxySecret}"; }\n`, { mode: 0o600 });
let tlsServer, schemaCreated = false;
async function waitReady() {
  for (let i = 0; i < 150; i++) {
    if (await fetch(`http://127.0.0.1:${apiPort}/api/b2b/readyz`).then(response => response.ok).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Image API readiness timeout');
}
async function request(host, path, { method = 'GET', body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: '127.0.0.1', port: tlsServer.address().port, servername: host,
      ca: readFileSync(certificate.ca), method, path, headers: { host, origin: `https://${host}`, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: body, json: () => JSON.parse(body) }));
    });
    request.setTimeout(10000, () => request.destroy(new Error('Image request timeout')));
    request.on('error', reject); if (body !== undefined) request.write(JSON.stringify(body)); request.end();
  });
}
try {
  for (const image of [apiImage, webImage]) evidence.images[image] = {
    id: docker(['image', 'inspect', '--format', '{{.Id}}', image]),
    revision: docker(['image', 'inspect', '--format', '{{ index .Config.Labels "org.opencontainers.image.revision" }}', image]),
  };
  evidence.sourceRevision = evidence.images[apiImage].revision;
  assert.match(evidence.sourceRevision, /^[a-f0-9]{40}$/);
  assert.equal(evidence.images[webImage].revision, evidence.sourceRevision);
  if (process.env.B2B_WL_EXPECTED_REVISION) assert.equal(evidence.sourceRevision, process.env.B2B_WL_EXPECTED_REVISION);
  evidence.runtimeVersions = {
    node: docker(['run', '--rm', '--network', 'none', '--entrypoint', 'node', apiImage, '--version']),
    nginx: docker(['run', '--rm', '--network', 'none', '--entrypoint', 'sh', webImage, '-c', 'nginx -v 2>&1']),
  };
  await owner.query(`CREATE SCHEMA ${schema}`); schemaCreated = true;
  docker(['run', '--rm', '--network', 'host', '--env-file', envFile, apiImage, 'node', 'apps/b2b-api/src/migrate.ts']);
  evidence.checks.push('image-migration');
  await seedWhiteLabelDemo(pool, createAuth(pool, config), config, 'image-tests-only-password-2026');
  await pool.query(`INSERT INTO b2b_domain(host,organization_id,status,primary_domain,verified_at,dns_verified_at,tls_verified_at,tls_expires_at,verification_evidence)
    VALUES('alias.b2b.test','atlas-demo','active',false,now(),now(),now(),now()+interval '1 day','isolated image smoke')`);
  const apiName = `klisteni-wl-api-${suffix}`; containers.push(apiName);
  docker(['run', '-d', '--name', apiName, '--network', 'host', '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true', '--env-file', envFile, apiImage]);
  await waitReady(); evidence.checks.push('image-readiness');
  const webName = `klisteni-wl-web-${suffix}`; containers.push(webName);
  docker(['run', '-d', '--name', webName, '--network', 'host', '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true', '-v', `${directory}/nginx.conf:/etc/nginx/nginx.conf:ro`,
    '-v', `${directory}/identity.conf:/etc/nginx/b2b-proxy-identity.conf:ro`, webImage]);
  tlsServer = https.createServer(certificate.tls, (request, response) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: webPort, path: request.url, method: request.method,
      headers: request.headers }, result => { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response); });
    upstream.on('error', () => { response.writeHead(502); response.end(); }); request.pipe(upstream);
  });
  await new Promise(resolve => tlsServer.listen(0, '127.0.0.1', resolve));
  for (let i = 0; i < 50; i++) {
    if ((await request('atlas.b2b.test', '/healthz')).status === 200) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  let atlasCookie;
  for (const brand of ['atlas', 'sur']) {
    const host = `${brand}.b2b.test`;
    const web = await request(host, '/'); assert.equal(web.status, 200); assert.match(web.text, /<html/);
    const context = await request(host, '/api/b2b/context'); assert.equal(context.status, 200);
    assert.equal(context.json().organization.id, `${brand}-demo`); assert.equal(context.json().branches.length, 2);
    const login = await request(host, '/api/b2b/auth/sign-in/email', { method: 'POST', body: { email: `member@${brand}.example.test`, password: 'image-tests-only-password-2026' } });
    assert.equal(login.status, 200); assert.match(login.headers['set-cookie'].join(';'), /Secure/);
    const cookie = login.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    if (brand === 'atlas') atlasCookie = cookie;
    const me = await request(host, '/api/b2b/me', { cookie }); assert.equal(me.status, 200);
    assert.deepEqual(me.json().memberships.map(membership => membership.organization.id), [`${brand}-demo`]);
    evidence.checks.push(`${brand}-html-context-login-me-two-branches`);
  }
  assert.equal((await request('sur.b2b.test', '/api/b2b/me', { cookie: atlasCookie })).status, 401);
  evidence.checks.push('copied-cookie-rejected');
  assert.equal((await request('unknown.b2b.test', '/')).status, 421);
  const alias = await request('alias.b2b.test', '/sedes/centro');
  assert.equal(alias.status, 308); assert.equal(alias.headers.location, 'https://atlas.b2b.test/sedes/centro#');
  assert.equal((await request('alias.b2b.test', '/login?token=do-not-transfer')).status, 421);
  evidence.checks.push('nginx-unknown-alias-and-secret-redirect-policy');
  evidence.result = 'passed';
  writeFileSync(resolve('docs/validation/b2b-white-label-images-2026-10-11.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.info(JSON.stringify(evidence, null, 2));
} finally {
  if (tlsServer?.listening) { tlsServer.closeAllConnections(); await new Promise(resolve => tlsServer.close(resolve)); }
  for (const name of containers.reverse()) { try { docker(['rm', '-f', name]); } catch { /* retain primary error */ } }
  await pool.end();
  if (schemaCreated) await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await owner.end(); rmSync(directory, { recursive: true, force: true });
}
