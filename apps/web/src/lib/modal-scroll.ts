// Dialogs live in the top layer, but showModal() does not lock the document.
// Fixing the body also prevents touch scrolling behind a dialog on mobile.
let locks = 0
let restoreScroll: (() => void) | undefined
let restorePosition: { x: number; y: number } | undefined

export function scrollPageToTop() {
  // A route change may happen before the closing dialog's effect is cleaned up.
  // Its navigation target must win over the old page's saved scroll position.
  if (locks > 0) restorePosition = { x: 0, y: 0 }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

export function lockModalScroll() {
  if (locks === 0) {
    const body = document.body
    const root = document.documentElement
    const x = window.scrollX
    const y = window.scrollY
    restorePosition = { x, y }
    const gap = window.innerWidth - root.clientWidth
    const original = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
      overflow: root.style.overflow,
      scrollBehavior: root.style.scrollBehavior,
    }
    if (gap > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gap}px`
    body.style.position = 'fixed'
    body.style.top = `${-y}px`
    body.style.left = `${-x}px`
    body.style.width = '100%'
    root.style.overflow = 'hidden'
    restoreScroll = () => {
      Object.assign(body.style, {
        position: original.position,
        top: original.top,
        left: original.left,
        width: original.width,
        paddingRight: original.paddingRight,
      })
      root.style.overflow = original.overflow
      root.style.scrollBehavior = 'auto'
      window.scrollTo(restorePosition?.x ?? x, restorePosition?.y ?? y)
      restorePosition = undefined
      root.style.scrollBehavior = original.scrollBehavior
    }
  }
  locks += 1
  let released = false
  return () => {
    if (released) return
    released = true
    locks -= 1
    if (locks === 0) {
      restoreScroll?.()
      restoreScroll = undefined
    }
  }
}
