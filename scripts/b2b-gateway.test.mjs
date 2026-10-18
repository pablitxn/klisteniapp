import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, open, readlink, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createGateway } from './b2b-gateway.mjs';
import { serveBuiltFile } from './b2b-static-files.mjs';

async function staticFixture(t, openFile) {
  const directory = await mkdtemp(join(tmpdir(), 'klisteni-gateway-lifecycle-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<main>synthetic shell</main>');
  const gateway = openFile
    ? http.createServer((request, response) => serveBuiltFile(request, response,
      { directory, pathname: new URL(request.url, 'http://localhost').pathname, openFile }))
    : createGateway({ built: true, builtDirectory: directory, whiteLabel: false });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    gateway.closeAllConnections();
    await new Promise(resolve => gateway.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, port: gateway.address().port, gateway };
}

function getStatic(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path, method, agent: false }, response => {
      const chunks = [];
      const result = aborted => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks), aborted });
      response.on('data', chunk => chunks.push(chunk));
      response.once('end', () => result(false));
      response.once('aborted', () => result(true));
      response.on('error', () => {});
    });
    request.once('error', reject);
    request.end();
  });
}

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline) await delay(10);
  assert.ok(predicate(), message);
}

function trackFiles() {
  const records = [];
  const openFile = async (...args) => {
    const file = await open(...args);
    const record = { file, stream: undefined, closed: false };
    records.push(record);
    return {
      stat: () => file.stat(), close: () => file.close(),
      createReadStream() {
        record.stream = file.createReadStream();
        record.stream.once('close', () => { record.closed = true; });
        return record.stream;
      },
    };
  };
  return { records, openFile };
}

async function fixtureDescriptorCount(directory) {
  if (process.platform !== 'linux') return undefined;
  const paths = await Promise.all((await readdir('/proc/self/fd')).map(async fd => {
    try { return await readlink(`/proc/self/fd/${fd}`); }
    catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  }));
  return paths.filter(path => path.startsWith(`${directory}/`)).length;
}

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

test('built GET bytes and HEAD metadata preserve MIME and security headers', { timeout: 10000 }, async t => {
  const { directory, port } = await staticFixture(t);
  const bytes = Buffer.from(Array.from({ length: 196613 }, (_, index) => index % 251));
  await writeFile(join(directory, 'assets/example.glb'), bytes);
  const get = await getStatic(port, '/assets/example.glb');
  const head = await getStatic(port, '/assets/example.glb', 'HEAD');
  assert.equal(get.status, 200);
  assert.equal(get.aborted, false);
  assert.deepEqual(get.body, bytes);
  assert.equal(createHash('sha256').update(get.body).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  for (const result of [get, head]) {
    assert.equal(result.headers['content-length'], String(bytes.length));
    assert.equal(result.headers['content-type'], 'model/gltf-binary');
    assert.equal(result.headers['cache-control'], 'no-cache');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal(result.headers['referrer-policy'], 'no-referrer');
  }
  await writeFile(join(directory, 'assets/empty.js'), '');
  const empty = await getStatic(port, '/assets/empty.js');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.length, 0);
  assert.equal(empty.headers['content-length'], '0');
});

test('built routes retain method, malformed path, dotfile, asset and SPA fallback behavior', { timeout: 10000 }, async t => {
  const { directory, port } = await staticFixture(t);
  await writeFile(join(directory, '.secret'), 'not public');
  await mkdir(join(directory, 'folder'));
  for (const path of ['/missing.js', '/assets/missing', '/models/missing', '/previews/missing',
    '/.secret', '/%2esecret', '/%2e%2e%2foutside', '/%2f..%2foutside', '/assets/%00bad']) {
    assert.equal((await getStatic(port, path)).status, 404, path);
  }
  assert.equal((await getStatic(port, '/bad%')).status, 400);
  assert.equal((await getStatic(port, '/manage/people', 'POST')).status, 405);
  for (const path of ['/manage/people?tab=all', '/folder']) {
    const result = await getStatic(port, path);
    assert.equal(result.status, 200);
    assert.equal(result.body.toString(), '<main>synthetic shell</main>');
  }
  await rm(join(directory, 'index.html'));
  const missingBuild = await getStatic(port, '/manage/people');
  assert.equal(missingBuild.status, 503);
  assert.equal(missingBuild.body.toString(), 'Build B2B before starting this gateway.');
  assert.equal((await getStatic(port, '/index.html')).status, 404);
});

test('repeated client disconnects close every static source and return file descriptors to baseline', { timeout: 15000 }, async t => {
  const { records, openFile } = trackFiles();
  const { directory, port } = await staticFixture(t, openFile);
  const fixtureFile = await open(join(directory, 'assets/large.glb'), 'w');
  await fixtureFile.truncate(32 * 1024 * 1024);
  await fixtureFile.close();
  const baseline = await fixtureDescriptorCount(directory);
  for (let index = 0; index < 16; index++) {
    await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/assets/large.glb', agent: false }, response => {
        response.on('error', () => {});
        response.once('data', () => { response.destroy(); resolve(); });
      }).once('error', reject);
    });
    await waitUntil(() => records.length === index + 1 && records.every(record => record.closed && record.file.fd === -1), 'all disconnected sources must close');
  }
  assert.equal(records.length, 16);
  assert.equal(await fixtureDescriptorCount(directory), baseline);
});

test('paused clients apply backpressure and close their sources on disconnect', { timeout: 10000 }, async t => {
  const { records, openFile } = trackFiles();
  const { directory, port } = await staticFixture(t, openFile);
  const fixtureFile = await open(join(directory, 'assets/large.glb'), 'w');
  const size = 64 * 1024 * 1024;
  await fixtureFile.truncate(size);
  await fixtureFile.close();
  const clients = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/assets/large.glb', agent: false }, response => {
      response.pause();
      response.on('error', () => {});
      resolve({ request, response });
    });
    request.once('error', reject);
  })));
  try {
    await delay(100);
    assert.equal(records.length, 4);
    for (const { stream, file } of records) {
      assert.ok(stream.isPaused());
      assert.ok(stream.bytesRead < size / 2, `source read ${stream.bytesRead} bytes despite backpressure`);
      assert.ok(file.fd >= 0);
    }
  } finally {
    for (const { request, response } of clients) { response.destroy(); request.destroy(); }
  }
  await waitUntil(() => records.every(record => record.closed && record.file.fd === -1), 'paused sources must close after disconnect');
  assert.equal(await fixtureDescriptorCount(directory), process.platform === 'linux' ? 0 : undefined);
});

test('HEAD closes its open handle without creating a source', { timeout: 10000 }, async t => {
  const { records, openFile } = trackFiles();
  const { port } = await staticFixture(t, openFile);
  const result = await getStatic(port, '/index.html', 'HEAD');
  assert.equal(result.status, 200);
  await waitUntil(() => records.length === 1 && records[0].file.fd === -1, 'HEAD handle must close');
  assert.equal(records[0].stream, undefined);
});

test('disconnects during pending open or metadata close the handle without starting a source', { timeout: 10000 }, async t => {
  for (const phase of ['open', 'stat']) {
    await t.test(phase, async t => {
      const started = Promise.withResolvers();
      const pending = Promise.withResolvers();
      let file, sourceCreated = false;
      const pause = async () => { started.resolve(); await pending.promise; };
      const openFile = async (filename, flags) => {
        file = await open(filename, flags);
        if (phase === 'open') await pause();
        return {
          close: () => file.close(),
          async stat() { if (phase === 'stat') await pause(); return file.stat(); },
          createReadStream() { sourceCreated = true; return file.createReadStream(); },
        };
      };
      const { port, gateway } = await staticFixture(t, openFile);
      const disconnected = Promise.withResolvers();
      gateway.once('request', (_request, response) => response.once('close', disconnected.resolve));
      const request = http.get({ hostname: '127.0.0.1', port, path: '/index.html', agent: false });
      request.on('error', () => {});
      try {
        await started.promise;
        request.destroy();
        await disconnected.promise;
      } finally { pending.resolve(); request.destroy(); }
      await waitUntil(() => file.fd === -1, 'pending metadata handle must close after disconnect');
      assert.equal(sourceCreated, false);
    });
  }
});

test('metadata and body use the same open file when the path is replaced', { timeout: 10000 }, async t => {
  let replaced = false;
  const openFile = async (filename, flags) => {
    const file = await open(filename, flags);
    return {
      close: () => file.close(), createReadStream: () => file.createReadStream(),
      async stat() {
        const result = await file.stat();
        if (!replaced) {
          replaced = true;
          await rename(filename, `${filename}.old`);
          await writeFile(filename, 'replacement with a different length');
        }
        return result;
      },
    };
  };
  const { port } = await staticFixture(t, openFile);
  const result = await getStatic(port, '/index.html');
  assert.equal(result.status, 200);
  assert.equal(result.body.toString(), '<main>synthetic shell</main>');
  assert.equal(result.headers['content-length'], String(result.body.length));
});

test('open, stat, stream creation and read failures are contained and close handles', { timeout: 15000 }, async t => {
  for (const fault of ['open', 'stat-missing', 'stat', 'create', 'first-read', 'later-read']) {
    await t.test(fault, async t => {
      const files = [];
      const openFile = async (filename, flags) => {
        if (fault === 'open') throw Object.assign(new Error('synthetic open failure'), { code: 'EIO' });
        const file = await open(filename, flags);
        files.push(file);
        return {
          close: () => file.close(),
          async stat() {
            if (fault.startsWith('stat')) throw Object.assign(new Error('synthetic metadata failure'), { code: fault === 'stat-missing' ? 'ENOENT' : 'EIO' });
            return file.stat();
          },
          createReadStream() {
            if (fault === 'create') throw new Error('synthetic stream creation failure');
            let sent = false;
            return new Readable({
              read() {
                if (fault === 'first-read') { this.destroy(new Error('synthetic initial read failure')); return; }
                if (!sent) { sent = true; this.push(Buffer.from('part')); }
                else setImmediate(() => this.destroy(new Error('synthetic later read failure')));
              },
              destroy(error, callback) { file.close().then(() => callback(error), callback); },
            });
          },
        };
      };
      const { directory, port } = await staticFixture(t, openFile);
      await writeFile(join(directory, 'assets/example.js'), 'a body longer than the partial read');
      const result = await getStatic(port, '/assets/example.js');
      assert.equal(result.status, fault === 'later-read' ? 200 : fault === 'stat-missing' ? 404 : 500);
      assert.equal(result.aborted, fault === 'later-read');
      if (fault === 'later-read') assert.equal(result.body.toString(), 'part');
      else assert.equal(result.headers['content-length'], undefined);
      await waitUntil(() => files.every(file => file.fd === -1), 'failed source must close its handle');
      assert.equal((await getStatic(port, '/missing.js')).status, fault === 'open' ? 500 : 404);
    });
  }
});
