import type { MouseEvent } from 'react'
import { resolveRoute } from '../routes'
import { navigate } from './navigation'

/** All ordinary delegated application links use the same local durability gate. */
export function followApplicationLink(event: MouseEvent<HTMLElement>, href: string) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  const link = event.target instanceof Element ? event.target.closest('a') : null
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
  const url = new URL(link.href)
  if (url.origin !== location.origin || resolveRoute(url.pathname).kind === 'notFound') return
  const accepted = new URL(href, location.origin)
  // Preserve native scrolling only when both the accepted and browser locations
  // are this document; a pending Back/Forward may already have changed the URL.
  if (
    url.pathname + url.search === accepted.pathname + accepted.search &&
    url.pathname + url.search === location.pathname + location.search &&
    url.hash
  )
    return
  event.preventDefault()
  navigate(url.pathname + url.search + url.hash)
}
