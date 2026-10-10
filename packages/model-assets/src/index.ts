/** Browser-safe paths. Each consuming application serves the same package assets. */
export type AssetResolver = (path: string) => string

export function createAssetResolver(base = '/'): AssetResolver {
  const prefix = base.endsWith('/') ? base : `${base}/`
  return (path) => {
    const relative = path.replace(/^\/+/, '')
    if (relative.split('/').some(part => part === '..' || part === '.') || relative.includes('\\')) {
      throw new Error('Asset paths must stay within the shared resource directory')
    }
    return `${prefix}${relative}`
  }
}

export const localAssets = createAssetResolver()

export interface ModelResource {
  id: string
  kind: 'anatomy' | 'equipment'
  version: string
  modelPath?: string
  landmarksPath?: string
  provenancePath?: string
  noticePath?: string
  rendering: 'gltf' | 'procedural'
}

export const modelResourceManifest = {
  schemaVersion: 1,
  version: '1.0.0',
  resources: [
    {
      id: 'anatomical-atlas', kind: 'anatomy', version: '1.0.0', rendering: 'gltf',
      modelPath: 'models/anatomy.glb', landmarksPath: 'models/rig-landmarks.json',
      provenancePath: 'models/anatomy-manifest.json', noticePath: 'models/NOTICE.md',
    },
    {
      id: 'low-row-bar', kind: 'equipment', version: '1.0.0', rendering: 'procedural',
      // The existing row fixture is geometry in ExerciseStage, not a gym machine model.
    },
  ] satisfies ModelResource[],
} as const

export function exercisePreviewFiles(id: string, modelVariant: 'male' | 'female' = 'male') {
  const prefix = modelVariant === 'female' ? 'female/' : ''
  return { poster: `${prefix}${id}-poster.webp`, animation: `${prefix}${id}.webp`, gif: `${prefix}${id}.gif` }
}

export function exercisePreviewUrls(id: string, modelVariant: 'male' | 'female' = 'male', resolveAsset: AssetResolver = localAssets) {
  const files = exercisePreviewFiles(id, modelVariant)
  return { poster: resolveAsset(`previews/${files.poster}`), animation: resolveAsset(`previews/${files.animation}`), gif: resolveAsset(`previews/${files.gif}`) }
}
