import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { createGateway } from './b2b-gateway.mjs';

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
