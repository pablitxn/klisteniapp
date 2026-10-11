// Same-origin gateway for local development and browser acceptance tests.
// Production uses docker/nginx.b2b.conf with the same route layout.
import http from 'node:http';
import https from 'node:https';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeDomainHost } from '../apps/b2b-api/src/domain-context.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

export function createGateway({ apiPort = 4201, webPort = 4210, built = false,
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
    const upstream = http.request({ hostname: '127.0.0.1', port, path: request.url, method: request.method,
      headers: forwardedHeaders(request, port) }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    });
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'El servicio está iniciando o no está disponible.', code: 'UPSTREAM_UNAVAILABLE' }));
    });
    request.on('aborted', () => upstream.destroy());
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
    const directory = resolve(root, 'apps/b2b-web/dist');
    let relative;
    try { relative = decodeURIComponent(pathname.slice(1)); }
    catch { response.writeHead(400); response.end(); return; }
    if (relative.includes('\0') || relative.split('/').some(part => part.startsWith('.'))) { response.writeHead(404); response.end(); return; }
    let filename = resolve(directory, relative || 'index.html');
    if (filename !== directory && !filename.startsWith(`${directory}${sep}`)) { response.writeHead(404); response.end(); return; }
    if (!existsSync(filename) || !statSync(filename).isFile()) {
      // A missing media/script URL must never return SPA HTML.
      if (extname(relative) || /^(assets|models|previews)\//.test(relative)) { response.writeHead(404); response.end(); return; }
      filename = resolve(directory, 'index.html');
    }
    if (!existsSync(filename)) { response.writeHead(503); response.end('Build B2B before starting this gateway.'); return; }
    response.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream',
      'Content-Length': statSync(filename).size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (request.method === 'HEAD') response.end(); else createReadStream(filename).pipe(response);
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
