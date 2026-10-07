import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnatomicalModelVariant, YogaAsanaId, YogaPracticeStep } from '@klisteniapp/scene-schema'
import { selectAnatomicalModel, useAppStore } from '../lib/store'
import { yogaPreviewAnimationUrl, yogaPreviewSide, yogaPreviewUrl } from '../lib/yoga-preview-assets'
import './yoga-art.css'

/** Captures of YogaStage, loaded on interaction without a canvas per card. */
export default function YogaAsanaArt({ asanaId, side = 'both', modelVariant, eager = false, active = false, animated = true, suspended = false }: {
  asanaId: YogaAsanaId
  side?: YogaPracticeStep['side']
  modelVariant?: AnatomicalModelVariant
  eager?: boolean
  active?: boolean
  animated?: boolean
  suspended?: boolean
}) {
  const { t } = useTranslation('yoga')
  const root = useRef<HTMLSpanElement>(null)
  const preferredModel = useAppStore(selectAnatomicalModel)
  const reducedMotion = useAppStore(s => s.preferences.reducedMotion)
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const model = modelVariant ?? preferredModel
  const shownSide = yogaPreviewSide(asanaId, side)
  const url = yogaPreviewUrl(asanaId, model, shownSide)
  const animationUrl = yogaPreviewAnimationUrl(asanaId, model, shownSide)
  // A failed old request must not hide a newly selected side or model.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [failedAnimationUrl, setFailedAnimationUrl] = useState<string | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setSystemReducedMotion(media.matches)
    const visibility = () => setDocumentVisible(!document.hidden)
    media.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      media.removeEventListener('change', motion)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.1 })
    observer.observe(element)
    const surface = element.closest<HTMLElement>('.yoga-asana-card, .yoga-step-row') ?? element.closest('button') ?? element
    const enter = (event: PointerEvent) => { if (event.pointerType !== 'touch') setHovered(true) }
    const leave = () => setHovered(false)
    const focus = () => setFocused(true)
    const blur = (event: FocusEvent) => { if (!surface.contains(event.relatedTarget as Node | null)) setFocused(false) }
    surface.addEventListener('pointerenter', enter)
    surface.addEventListener('pointerleave', leave)
    surface.addEventListener('focusin', focus)
    surface.addEventListener('focusout', blur)
    return () => {
      observer.disconnect()
      surface.removeEventListener('pointerenter', enter)
      surface.removeEventListener('pointerleave', leave)
      surface.removeEventListener('focusin', focus)
      surface.removeEventListener('focusout', blur)
    }
  }, [])
  const playing = animated && !suspended && (active || hovered || focused) && visible && documentVisible && !reducedMotion && !systemReducedMotion && failedAnimationUrl !== animationUrl
  return <span ref={root} className="yoga-asana-art yoga-asana-preview" data-asana={asanaId} data-model={model} data-side={shownSide} data-state={playing ? 'playing' : 'still'} aria-hidden="true">
    {failedUrl === url ? <span className="yoga-preview-unavailable">{t('Vista 3D no disponible')}</span> : <img className="yoga-preview-poster" key={url} src={url} width={512} height={384} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => setFailedUrl(url)} />}
    {playing && <img className="yoga-preview-motion" key={animationUrl} src={animationUrl} width={384} height={288} alt="" decoding="async" draggable={false} onError={() => setFailedAnimationUrl(animationUrl)} />}
  </span>
}
