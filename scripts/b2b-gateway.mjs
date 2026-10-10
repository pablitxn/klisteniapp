// Same-origin gateway for local development and browser acceptance tests.
// Production uses docker/nginx.b2b.conf with the same route layout.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

export function createGateway({ apiPort = 4201, memberPort = 4210, backofficePort = 4211, built = false } = {}) {
  function proxy(request, response, port) {
    const upstream = http.request({ hostname: '127.0.0.1', port, path: request.url, method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${port}` } }, result => {
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
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      response.end('ok\n'); return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) { proxy(request, response, apiPort); return; }
    const backoffice = pathname === '/backoffice' || pathname.startsWith('/backoffice/') || pathname.includes('__backoffice_hmr');
    if (!built) { proxy(request, response, backoffice ? backofficePort : memberPort); return; }
    if (!['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405); response.end(); return; }
    const directory = resolve(root, backoffice ? 'apps/backoffice/dist' : 'apps/member-web/dist');
    let relative;
    try { relative = decodeURIComponent(backoffice ? pathname.replace(/^\/backoffice\/?/, '') : pathname.slice(1)); }
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
  });
  server.on('upgrade', (request, socket, head) => {
    if (built) { socket.destroy(); return; }
    const port = request.url?.includes('__backoffice_hmr') || request.url?.startsWith('/backoffice/') ? backofficePort : memberPort;
    const upstream = http.request({ hostname: '127.0.0.1', port, path: request.url, headers: { ...request.headers, host: `127.0.0.1:${port}` } });
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
  const gateway = createGateway({ apiPort: Number(process.env.B2B_PORT ?? 4201), built: process.argv.includes('--built') });
  gateway.listen(Number(process.env.B2B_GATEWAY_PORT ?? 4200), '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => gateway.close());
}
