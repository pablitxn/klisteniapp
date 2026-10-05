import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'

/** Paths relative to public/previews; keep existing masculine URLs compatible. */
export function exercisePreviewFiles(id: string, modelVariant: AnatomicalModelVariant = 'male') {
  const prefix = modelVariant === 'female' ? 'female/' : ''
  return {
    poster: `${prefix}${id}-poster.webp`,
    animation: `${prefix}${id}.webp`,
    gif: `${prefix}${id}.gif`,
  }
}

/** Every visual format selects the same anatomical representation. */
export function exercisePreviewUrls(id: string, modelVariant: AnatomicalModelVariant = 'male') {
  const files = exercisePreviewFiles(id, modelVariant)
  return {
    poster: `/previews/${files.poster}`,
    animation: `/previews/${files.animation}`,
    gif: `/previews/${files.gif}`,
  }
}
