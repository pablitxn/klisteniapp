import type { AnatomicalModelVariant, YogaAsanaId, YogaPracticeStep } from '@klisteniapp/scene-schema'
import { getAsana } from '../data/yoga.ts'

/** Anatomical side, never the camera side or a mirrored CSS image. */
export function yogaPreviewSide(id: YogaAsanaId, side: YogaPracticeStep['side'] = 'both'): YogaPracticeStep['side'] {
  return getAsana(id)!.bilateral ? 'both' : side === 'left' ? 'left' : 'right'
}

/** Relative to public/previews/yoga. Both models and both unilateral sides are rendered. */
export function yogaPreviewFile(id: YogaAsanaId, model: AnatomicalModelVariant = 'male', side: YogaPracticeStep['side'] = 'both') {
  return `${model}/${id}-${yogaPreviewSide(id, side)}.webp`
}

export function yogaPreviewUrl(id: YogaAsanaId, model: AnatomicalModelVariant = 'male', side: YogaPracticeStep['side'] = 'both') {
  return `/previews/yoga/${yogaPreviewFile(id, model, side)}`
}

export function yogaPreviewAnimationFile(id: YogaAsanaId, model: AnatomicalModelVariant = 'male', side: YogaPracticeStep['side'] = 'both') {
  return `${model}/${id}-${yogaPreviewSide(id, side)}-motion.webp`
}

export function yogaPreviewAnimationUrl(id: YogaAsanaId, model: AnatomicalModelVariant = 'male', side: YogaPracticeStep['side'] = 'both') {
  return `/previews/yoga/${yogaPreviewAnimationFile(id, model, side)}`
}
