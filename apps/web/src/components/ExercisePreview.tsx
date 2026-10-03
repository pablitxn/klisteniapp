import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../lib/store'
import Icon from './Icon'

interface ExercisePreviewProps {
  id: string
  active?: boolean
}

/** Lightweight captures of the same model and poses used by AnatomyViewer. */
export default function ExercisePreview({
  id,
  active = false,
}: ExercisePreviewProps) {
  const root = useRef<HTMLSpanElement>(null)
  const reducedMotion = useAppStore((s) => s.preferences.reducedMotion)
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [documentVisible, setDocumentVisible] = useState(
    () => !document.hidden,
  )
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const [animationFailed, setAnimationFailed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setSystemReducedMotion(media.matches)
    const updateVisibility = () => setDocumentVisible(!document.hidden)
    media.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      media.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.1 },
    )
    observer.observe(element)
    const card = element.closest('button')
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') setHovered(true)
    }
    const leave = () => setHovered(false)
    const focus = () => setFocused(true)
    const blur = () => setFocused(false)
    card?.addEventListener('pointerenter', enter)
    card?.addEventListener('pointerleave', leave)
    card?.addEventListener('focusin', focus)
    card?.addEventListener('focusout', blur)
    return () => {
      observer.disconnect()
      card?.removeEventListener('pointerenter', enter)
      card?.removeEventListener('pointerleave', leave)
      card?.removeEventListener('focusin', focus)
      card?.removeEventListener('focusout', blur)
    }
  }, [])

  const playing =
    (active || hovered || focused) &&
    visible &&
    documentVisible &&
    !reducedMotion &&
    !systemReducedMotion &&
    !animationFailed

  return (
    <span
      ref={root}
      className="exercise-preview"
      data-exercise={id}
      data-state={playing ? 'playing' : 'still'}
      aria-hidden="true"
    >
      {posterFailed ? (
        <span className="exercise-preview-fallback">
          <Icon name="play" size={20} />
        </span>
      ) : (
        <img
          className="exercise-preview-poster"
          src={`/previews/${id}-poster.webp`}
          width={256}
          height={256}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setPosterFailed(true)}
        />
      )}
      {playing && (
        <img
          className="exercise-preview-motion"
          src={`/previews/${id}.webp`}
          width={256}
          height={256}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setAnimationFailed(true)}
        />
      )}
    </span>
  )
}
