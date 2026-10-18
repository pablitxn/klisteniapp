// Same-origin gateway for local development and browser acceptance tests.
// Production uses docker/nginx.b2b.conf with the same route layout.
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeDomainHost } from '../apps/b2b-api/src/domain-context.ts';
import { serveBuiltFile } from './b2b-static-files.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export function createGateway({ apiPort = 4201, webPort = 4210, built = false, builtDirectory,
  whiteLabel = process.env.B2B_WHITE_LABEL === 'true', proxySecret = process.env.B2B_PROXY_SECRET,
  domainProtocol = process.env.B2B_DOMAIN_PROTOCOL ?? 'https', tls } = {}) {
  if (whiteLabel && (!proxySecret || !/^[a-zA-Z0-9_-]{32,256}$/.test(proxySecret))) throw new Error('White-label gateway requires B2B_PROXY_SECRET');
  // This gateway terminates TLS itself. An outer TLS proxy must use the separately
  // configured Nginx boundary; client forwarding headers never select its scheme.
  if (whiteLabel && domainProtocol === 'https' && !tls) throw new Error('White-label HTTPS gateway requires TLS key and certificate');
  function forwardedHeaders(request, port) {
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([key]) =>
      !key.startsWith('x-forwarded-') && !key.startsWith('x-klisteni-b2b-proxy-') &&
      !['forwarded', 'x-klisteni-b2b-host', 'x-klisteni-b2b-proto', 'cf-connecting-ip'].includes(key)));
    headers.host = `127.0.0.1:${port}`;
    if (whiteLabel && port === apiPort) {
      headers['x-klisteni-b2b-host'] = normalizeDomainHost(request.headers.host ?? '', domainProtocol);
      headers['x-klisteni-b2b-proto'] = tls ? 'https' : 'http';
      headers['x-klisteni-b2b-proxy-secret'] = proxySecret;
    }
    return headers;
  }
  function proxy(request, response, port) {
    let upstreamResponse;
    const upstream = http.request({ hostname: '127.0.0.1', port, path: request.url, method: request.method,
      headers: forwardedHeaders(request, port) }, result => {
      upstreamResponse = result;
      if (response.destroyed) { result.destroy(); return; }
      result.on('error', () => response.destroy());
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    });
    upstream.on('error', () => {
      if (response.destroyed) return;
      if (response.headersSent) { response.destroy(); return; }
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'El servicio está iniciando o no está disponible.', code: 'UPSTREAM_UNAVAILABLE' }));
    });
    const close = () => { upstreamResponse?.destroy(); upstream.destroy(); };
    response.once('close', close);
    request.once('aborted', close);
    request.pipe(upstream);
  }
  function domainEntry(request, response) {
    return new Promise(resolve => {
      const upstream = http.get({ hostname: '127.0.0.1', port: apiPort, path: '/api/b2b/domain-entry',
        headers: { ...forwardedHeaders(request, apiPort), 'x-klisteni-b2b-entry-path': request.url ?? '/' } }, result => {
        if (result.statusCode === 204) { result.resume(); resolve(true); return; }
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response); resolve(false);
      });
      upstream.on('error', () => {
        response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: 'Dominio no disponible.', code: 'UPSTREAM_UNAVAILABLE' })); resolve(false);
      });
      upstream.setTimeout(10000, () => upstream.destroy(new Error('Domain entry timeout')));
    });
  }
  const handler = async (request, response) => {
    if (whiteLabel) {
      try {
        const hosts = request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'host');
        if (hosts.length !== 1) throw new Error('Invalid host');
        normalizeDomainHost(request.headers.host ?? '', domainProtocol);
      } catch {
        response.writeHead(421, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: 'Dominio no disponible.', code: 'INVALID_DOMAIN' })); return;
      }
    }
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      response.end('ok\n'); return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) { proxy(request, response, apiPort); return; }
    // Authorize document entry before serving any brand SPA. Queries/fragments
    // are handled by the canonical redirect policy in the API.
    if (whiteLabel && ['GET', 'HEAD'].includes(request.method ?? '') && !extname(pathname) &&
      !pathname.includes('__b2b_hmr') && !await domainEntry(request, response)) return;
    if (!built) { proxy(request, response, webPort); return; }
    if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405); response.end(); return; }
    const directory = resolve(builtDirectory ?? resolve(root, 'apps/b2b-web/dist'));
    await serveBuiltFile(request, response, { directory, pathname });
  };
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  server.on('upgrade', (request, socket, head) => {
    if (built) { socket.destroy(); return; }
    const port = webPort;
    const upstream = http.request({ hostname: '127.0.0.1', port, path: request.url, headers: forwardedHeaders(request, port) });
    upstream.on('upgrade', (response, connection, upstreamHead) => {
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) connection.write(head);
      socket.pipe(connection).pipe(socket);
      socket.on('error', () => connection.destroy());
      connection.on('error', () => socket.destroy());
    });
    upstream.on('error', () => socket.destroy());
    upstream.end();
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const gateway = createGateway({ apiPort: Number(process.env.B2B_PORT ?? 4201), built: process.argv.includes('--built'),
    ...(process.env.B2B_TLS_KEY && process.env.B2B_TLS_CERT ? { tls: { key: readFileSync(process.env.B2B_TLS_KEY), cert: readFileSync(process.env.B2B_TLS_CERT) } } : {}) });
  gateway.listen(Number(process.env.B2B_GATEWAY_PORT ?? 4200), '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => gateway.close());
}
