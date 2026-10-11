import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export function prepareCapture(root, mode = 'demo') {
  if (!['demo', 'instance'].includes(mode)) throw new Error('--mode must be demo or instance')
  process.env.VITE_APP_MODE = mode
  const profile = mode === 'instance' ? 'apps/b2c-web/instance-profile.example.json' : null
  process.env.KLISTENI_PUBLIC_PROFILE_FILE = profile ? join(root, profile) : ''
  for (const key of ['VITE_UMAMI_SCRIPT_URL', 'VITE_UMAMI_HOST_URL', 'VITE_UMAMI_WEBSITE_ID', 'VITE_UMAMI_ALLOWED_HOSTNAME']) process.env[key] = ''
  return { mode, publicProfile: profile, analytics: 'disabled', session: 'anonymous', backend: 'blocked' }
}

export async function captureSources(root, script) {
  async function filesBelow(directory) {
    const entries = await readdir(join(root, directory), { withFileTypes: true })
    return (await Promise.all(entries.map(entry => entry.isDirectory()
      ? filesBelow(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]))).flat()
  }
  const files = [script, 'scripts/capture-readme-context.mjs', 'pnpm-lock.yaml',
    'apps/b2c-web/index.html', 'apps/b2c-web/vite.config.ts', 'apps/b2c-web/config/deployment.ts',
    'apps/b2c-web/instance-profile.example.json', 'packages/model-assets/public/models/anatomy.glb',
    'packages/model-assets/public/models/rig-landmarks.json', 'packages/model-assets/public/previews/manifest.json',
    ...await filesBelow('apps/b2c-web/src'), ...await filesBelow('packages/geometry/src'),
    ...await filesBelow('packages/scene-schema/src'), ...await filesBelow('packages/catalog-base/src'),
    ...await filesBelow('packages/anatomy-viewer/src'), ...await filesBelow('packages/model-assets/src')].sort()
  return Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(join(root, file)))])))
}

export async function checkMedia(output, manifestFile, sources, deployment, expectedCount) {
  const manifest = JSON.parse(await readFile(join(output, manifestFile), 'utf8'))
  if (manifest.sourceHash !== hash(JSON.stringify(sources))) throw new Error('Capture sources changed. Regenerate and visually review the media.')
  if (JSON.stringify(manifest.deployment) !== JSON.stringify(deployment)) throw new Error('Capture mode/profile differs. Regenerate with the intended --mode.')
  if (manifest.assets.length !== expectedCount) throw new Error('Incomplete media set. Regenerate the full capture without --no-gif.')
  for (const asset of manifest.assets) {
    if (hash(await readFile(join(output, asset.file))) !== asset.sha256) throw new Error(`Media missing or changed: ${asset.file}`)
  }
  console.log(`${manifest.assets.length} ${deployment.mode} media assets match their recorded sources and hashes. Visual review is separate.`)
}

export async function isolateCapture(context, mode, unexpected) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (mode === 'instance' && url.pathname === '/api/auth/get-session' && route.request().method() === 'GET') return route.fulfill({ json: null })
    if (url.pathname.startsWith('/api/') || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      unexpected.push(`${route.request().method()} ${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
}
