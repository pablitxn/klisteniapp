import { open } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

async function openRegularFile(filename, openFile) {
  let file;
  let transferred = false;
  try {
    file = await openFile(filename, 'r');
    const metadata = await file.stat();
    if (metadata.isFile()) { transferred = true; return { file, size: metadata.size }; }
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
  } finally {
    // A successful return transfers ownership to the caller.
    if (file && !transferred) await file.close();
  }
  return undefined;
}

// The open operation is injectable so transport failures can be tested without
// changing shared files or relying on filesystem races.
export async function serveBuiltFile(request, response, { directory, pathname, openFile = open }) {
  let file;
  const fail = (status, body) => {
    if (response.destroyed) return;
    if (response.headersSent) { response.destroy(); return; }
    response.writeHead(status);
    response.end(body);
  };
  try {
    let relative;
    try { relative = decodeURIComponent(pathname.slice(1)); }
    catch { fail(400); return; }
    if (relative.includes('\0') || relative.split('/').some(part => part.startsWith('.'))) { fail(404); return; }
    let filename = resolve(directory, relative || 'index.html');
    if (filename !== directory && !filename.startsWith(`${directory}${sep}`)) { fail(404); return; }
    let opened = await openRegularFile(filename, openFile);
    if (!opened) {
      // A missing media/script URL must never return SPA HTML.
      if (extname(relative) || /^(assets|models|previews)\//.test(relative)) { fail(404); return; }
      filename = resolve(directory, 'index.html');
      opened = await openRegularFile(filename, openFile);
    }
    if (!opened) { fail(503, 'Build B2B before starting this gateway.'); return; }
    file = opened.file;
    if (response.destroyed || request.aborted) return;
    const headers = { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream',
      'Content-Length': opened.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    if (request.method === 'HEAD') { response.writeHead(200, headers); response.end(); return; }

    // Stat and stream use the same opened file. Once created, the stream owns
    // the handle and closes it on completion, failure or downstream disconnect.
    const source = file.createReadStream();
    file = undefined;
    const cancel = () => source.destroy();
    response.once('close', cancel);
    response.once('finish', cancel);
    response.once('error', cancel);
    request.once('aborted', cancel);
    source.once('close', () => {
      response.off('close', cancel);
      response.off('finish', cancel);
      response.off('error', cancel);
      request.off('aborted', cancel);
    });
    source.once('error', () => fail(500));
    // Keep success headers pending until the first read, so an initial read
    // failure can still produce an ordinary error response.
    source.once('readable', () => {
      if (response.destroyed) { cancel(); return; }
      response.writeHead(200, headers);
      source.pipe(response);
    });
  } catch {
    fail(500);
  } finally {
    if (file) await file.close().catch(() => {});
  }
}
