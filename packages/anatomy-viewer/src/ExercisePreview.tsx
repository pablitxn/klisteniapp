import { useEffect, useState, type ReactNode } from 'react'
import { exercisePreviewUrls, localAssets, type AssetResolver } from '@klisteniapp/model-assets'
import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'
import { getMovementDefinition } from './movement-library.ts'

export interface ExercisePreviewProps {
  exerciseId: string
  modelVariant?: AnatomicalModelVariant
  assetResolver?: AssetResolver
  alt?: string
  className?: string
  fallback?: ReactNode
  active?: boolean
  reducedMotion?: boolean
}

/** Catalog-backed captures; custom gym exercises without media receive the supplied fallback. */
export function ExercisePreview({ exerciseId, modelVariant = 'male', assetResolver = localAssets, alt, className, fallback = 'Vista previa no disponible', active = false, reducedMotion = false }: ExercisePreviewProps) {
  const definition = getMovementDefinition(exerciseId)
  const [failed, setFailed] = useState<string | null>(null)
  const [systemReduced, setSystemReduced] = useState(true)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  if (!definition) return <span className={className} data-preview-unavailable={exerciseId}>{fallback}</span>
  const assets = exercisePreviewUrls(exerciseId, modelVariant, assetResolver)
  const source = active && !reducedMotion && !systemReduced && failed !== assets.animation ? assets.animation : assets.poster
  if (failed === assets.poster) return <span className={className}>{fallback}</span>
  return <img className={className} src={source} alt={alt ?? definition.exercise.name} width={256} height={256} loading="lazy" decoding="async" onError={() => setFailed(source)} data-model-variant={modelVariant} />
}
