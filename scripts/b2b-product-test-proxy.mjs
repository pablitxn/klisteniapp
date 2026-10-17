import http from 'node:http'
import net from 'node:net'
import { createWhiteLabelTestProxy } from './b2b-wl-proxy.mjs'
const host = /^(?:atlas|sur|alias|unknown)\.b2b\.test$/
/** Fictitious test hosts only, with one fixed loopback upstream and no DNS. */
export function createProductTestProxy(gatewayPort, protocol) {
  if (protocol === 'https') return createWhiteLabelTestProxy(gatewayPort)
  const sockets = new Set()
  const proxy = http.createServer((request, response) => {
    let target
    try {
      target = new URL(request.url)
    } catch {
      response.writeHead(403)
      response.end()
      return
    }
    if (
      target.protocol !== 'http:' ||
      target.username ||
      target.password ||
      !host.test(target.host)
    ) {
      response.writeHead(403)
      response.end()
      return
    }
    let upstreamResponse
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: gatewayPort,
        path: target.pathname + target.search,
        method: request.method,
        headers: { ...request.headers, host: target.host },
      },
      (result) => {
        upstreamResponse = result
        if (response.destroyed) {
          result.destroy()
          return
        }
        result.on('error', () => response.destroy())
        response.writeHead(result.statusCode, result.headers)
        result.pipe(response)
      },
    )
    upstream.on('error', () => {
      if (response.destroyed) return
      if (response.headersSent) {
        response.destroy()
        return
      }
      if (!response.headersSent) response.writeHead(502)
      response.end()
    })
    const close = () => {
      upstreamResponse?.destroy()
      upstream.destroy()
    }
    response.once('close', close)
    request.once('aborted', close)
    request.pipe(upstream)
  })
  proxy.on('connect', (request, client, head) => {
    if (!/^(?:atlas|sur|alias|unknown)\.b2b\.test:80$/.test(request.url ?? '')) {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    const upstream = net.connect(gatewayPort, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      client.pipe(upstream).pipe(client)
    })
    sockets.add(client)
    sockets.add(upstream)
    client.on('close', () => {
      sockets.delete(client)
      upstream.destroy()
    })
    upstream.on('close', () => {
      sockets.delete(upstream)
      client.destroy()
    })
    client.on('error', () => upstream.destroy())
    upstream.on('error', () => client.destroy())
  })
  proxy.closeTunnels = () => {
    for (const socket of sockets) socket.destroy()
  }
  return proxy
}
