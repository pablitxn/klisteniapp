import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { createGateway } from './b2b-gateway.mjs';

test('member, gym staff and Vite resources use one B2B development server', async t => {
  const upstream = http.createServer((request, response) => response.end(request.url));
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const gateway = createGateway({ webPort: upstream.address().port });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  t.after(() => Promise.all([gateway, upstream].map(server => new Promise(resolve => server.close(resolve)))));
  for (const path of ['/app', '/backoffice/', '/backoffice/people', '/src/main.tsx', '/__b2b_hmr']) {
    const response = await fetch(`http://127.0.0.1:${gateway.address().port}${path}`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), path);
  }
});

test('gateway strips spoofed forwarding identity and authenticates the actual host', async () => {
  const upstream = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(request.headers));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const secret = 'gateway-test-only-secret-with-at-least-32-characters';
  const gateway = createGateway({ apiPort: upstream.address().port, whiteLabel: true, proxySecret: secret, domainProtocol: 'http' });
  const get = headers => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: gateway.address().port,
      path: '/api/b2b/context', headers }, response => {
      let body = '';
      response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    request.on('error', reject);
  });
  try {
    await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
    const response = await get({ host: 'Atlas.b2b.test', 'x-forwarded-host': 'sur.b2b.test', forwarded: 'host=sur.b2b.test',
        'x-klisteni-b2b-host': 'sur.b2b.test', 'x-klisteni-b2b-proxy-secret': 'attacker',
    });
    const headers = response.body;
    assert.equal(headers['x-klisteni-b2b-host'], 'atlas.b2b.test');
    assert.equal(headers['x-klisteni-b2b-proto'], 'http');
    assert.equal(headers['x-klisteni-b2b-proxy-secret'], secret);
    assert.equal(headers['x-forwarded-host'], undefined);
    assert.equal(headers.forwarded, undefined);
    const invalid = await get({ host: 'atlas.test,evil.test' });
    assert.equal(invalid.status, 421);
  } finally {
    await Promise.all([gateway, upstream].map(server => new Promise(resolve => server.close(resolve))));
  }
});
test('HTTPS mode cannot start with a plaintext gateway or absent shared secret', () => {
  assert.throws(() => createGateway({ whiteLabel: true, domainProtocol: 'https', proxySecret: 'x'.repeat(32) }), /TLS/);
  assert.throws(() => createGateway({ whiteLabel: true, domainProtocol: 'http', proxySecret: '' }), /B2B_PROXY_SECRET/);
});
test('document entry checks the registry before serving HTML and preserves safe alias responses', async () => {
  const upstream = http.createServer((request, response) => {
    assert.equal(request.url, '/api/b2b/domain-entry');
    assert.equal(request.headers['x-klisteni-b2b-entry-path'], '/sedes/centro');
    const alias = request.headers['x-klisteni-b2b-host'] === 'alias.b2b.test';
    response.writeHead(alias ? 308 : 421, alias ? { location: 'https://atlas.b2b.test/sedes/centro#' } : {});
    response.end();
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const gateway = createGateway({ apiPort: upstream.address().port, whiteLabel: true,
    proxySecret: 'gateway-test-only-secret-with-at-least-32-characters', domainProtocol: 'http', built: true });
  try {
    await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
    for (const [host, status] of [['unknown.b2b.test', 421], ['alias.b2b.test', 308]]) {
      const result = await new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: gateway.address().port, path: '/sedes/centro', headers: { host } }, response => {
          response.resume(); response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location }));
        }).on('error', reject);
      });
      assert.equal(result.status, status);
      if (status === 308) assert.equal(result.location, 'https://atlas.b2b.test/sedes/centro#');
    }
  } finally { await Promise.all([gateway, upstream].map(server => new Promise(resolve => server.close(resolve)))); }
});

test('built fixture serves its fixed snapshot after the shared build is replaced', async t => {
  const { mkdtemp, mkdir, writeFile, cp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'klisteni-gateway-snapshot-'));
  const shared = join(directory, 'shared'), snapshot = join(directory, 'snapshot');
  await mkdir(join(shared, 'assets'), { recursive: true });
  await writeFile(join(shared, 'index.html'), '<script src="/assets/old.js"></script>');
  await writeFile(join(shared, 'assets/old.js'), 'old fixture chunk');
  await cp(shared, snapshot, { recursive: true });
  const gateway = createGateway({ built: true, builtDirectory: snapshot, whiteLabel: false });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    gateway.closeAllConnections();
    await new Promise(resolve => gateway.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  await rm(shared, { recursive: true });
  await mkdir(shared);
  await writeFile(join(shared, 'index.html'), 'new build');
  const origin = `http://127.0.0.1:${gateway.address().port}`;
  assert.equal(await (await fetch(`${origin}/manage/people`)).text(), '<script src="/assets/old.js"></script>');
  const chunk = await fetch(`${origin}/assets/old.js`);
  assert.equal(chunk.status, 200);
  assert.equal(await chunk.text(), 'old fixture chunk');
});
