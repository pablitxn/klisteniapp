import http from 'node:http';
import net from 'node:net';

/** Restricted test-only CONNECT resolver; neither DNS changes nor a public proxy. */
export function createWhiteLabelTestProxy(gatewayPort) {
  const sockets = new Set();
  const server = http.createServer((_request, response) => { response.writeHead(403); response.end(); });
  server.on('connect', (request, client, head) => {
    if (!/^(?:atlas|sur|alias|unknown)\.b2b\.test:443$/.test(request.url ?? '')) {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
    }
    const upstream = net.connect(gatewayPort, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream).pipe(client);
    });
    sockets.add(client); sockets.add(upstream);
    client.on('close', () => { sockets.delete(client); upstream.destroy(); });
    upstream.on('close', () => { sockets.delete(upstream); client.destroy(); });
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
  });
  server.closeTunnels = () => { for (const socket of sockets) socket.destroy(); };
  return server;
}
