import { createReadStream } from 'node:fs'
import { cp, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export const sharedAssetDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const contentTypes: Record<string, string> = {
  '.glb': 'model/gltf-binary', '.json': 'application/json', '.webp': 'image/webp',
  '.gif': 'image/gif', '.png': 'image/png', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
}

/** Resolve only public model/preview files, never source code or adjacent directories. */
export function sharedAssetFile(pathname: string): string | undefined {
  let path: string
  try { path = decodeURIComponent(pathname).replace(/^\/+/, '') } catch { return undefined }
  if (!/^(models|previews)\//.test(path) || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) return undefined
  const absolute = resolve(sharedAssetDirectory, path)
  return absolute.startsWith(`${resolve(sharedAssetDirectory)}${sep}`) ? absolute : undefined
}

/** Development and built deployments both serve their own copy, without a B2C origin. */
export function sharedModelAssetsPlugin(): Plugin {
  let outputDirectory: string
  return {
    name: 'klisteniapp-shared-model-assets',
    configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir) },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next()
        const pathname = (request.url ?? '').split('?')[0]!
        const base = server.config.base
        const localPath = base !== '/' && pathname.startsWith(base) ? pathname.slice(base.length) : pathname
        const file = sharedAssetFile(localPath)
        if (!file) return next()
        try {
          const info = await stat(file)
          if (!info.isFile()) return next()
          response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream')
          response.setHeader('Content-Length', info.size)
          response.setHeader('Cache-Control', 'no-cache')
          if (request.method === 'HEAD') return response.end()
          const stream = createReadStream(file)
          stream.on('error', next)
          stream.pipe(response)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return next()
          next(error)
        }
      })
    },
    async writeBundle() {
      for (const directory of ['models', 'previews']) {
        await cp(join(sharedAssetDirectory, directory), join(outputDirectory, directory), { recursive: true })
      }
    },
  }
}
