import { useEffect, useRef, useState } from 'react'
import type { HealthAccess } from '../features/health/healthAccess'

/** Stream bytes carry no health or identity data. Any disconnect, timeout,
 * invalidation or hidden page removes the mounted protected projection. */
export function useProductStream(
  context: HealthAccess | null,
  memberId: string | undefined,
  onInvalidate: () => void,
) {
  const [readyKey, setReadyKey] = useState('')
  const callback = useRef(onInvalidate)
  callback.current = onInvalidate
  const key = context ? JSON.stringify([context.generation, memberId]) : ''
  useEffect(() => {
    if (!context || context.signal.aborted) return
    const lifetime = new AbortController()
    let stream: AbortController | null = null,
      watchdog: ReturnType<typeof setTimeout> | undefined
    let invalidated = false
    const invalidate = () => {
      if (invalidated || lifetime.signal.aborted || context.signal.aborted) return
      invalidated = true
      stream?.abort()
      setReadyKey('')
      callback.current()
    }
    const hidden = () => {
      if (document.visibilityState !== 'visible') invalidate()
      else if (!stream) void connect()
    }
    async function connect() {
      if (document.visibilityState !== 'visible' || lifetime.signal.aborted) return
      stream = new AbortController()
      const signal = AbortSignal.any([context!.signal, lifetime.signal, stream.signal])
      const reset = () => {
        clearTimeout(watchdog)
        watchdog = setTimeout(invalidate, 10_000)
      }
      reset()
      try {
        const url = `/api/b2b/orgs/${encodeURIComponent(context!.organizationId)}/product/v2/events${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''}`
        const response = await fetch(url, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal,
          headers: {
            Accept: 'text/event-stream',
            'X-Klisteni-B2B-Contract': '2',
            'X-Klisteni-B2B-Account': context!.accountId,
            ...(context!.branchId ? { 'X-Klisteni-B2B-Branch': context!.branchId } : {}),
            ...(context!.access?.role ? { 'X-Klisteni-B2B-Role': context!.access.role } : {}),
          },
        })
        if (
          !response.ok ||
          !response.headers.get('content-type')?.startsWith('text/event-stream') ||
          !response.body
        )
          throw new Error('Event authority unavailable')
        const reader = response.body.getReader(),
          decoder = new TextDecoder()
        let pending = ''
        try {
          while (!signal.aborted) {
            const part = await reader.read()
            if (part.done) break
            pending += decoder.decode(part.value, { stream: true })
            if (pending.length > 16_384) throw new Error('Invalid event frame')
            let end: number
            while ((end = pending.indexOf('\n\n')) >= 0) {
              const frame = pending.slice(0, end)
              pending = pending.slice(end + 2)
              const event = /^event: (ready|heartbeat|invalidate)$/m.exec(frame)?.[1]
              if (event === 'invalidate' || !event) {
                invalidate()
                return
              }
              reset()
              if (event === 'ready' && !signal.aborted) setReadyKey(key)
            }
          }
        } finally {
          await reader.cancel().catch(() => undefined)
        }
        if (!signal.aborted) invalidate()
      } catch {
        if (!signal.aborted) invalidate()
      } finally {
        clearTimeout(watchdog)
      }
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('offline', invalidate)
    context.signal.addEventListener('abort', () => lifetime.abort(), {
      once: true,
      signal: lifetime.signal,
    })
    void connect()
    return () => {
      lifetime.abort()
      stream?.abort()
      clearTimeout(watchdog)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('offline', invalidate)
    }
  }, [key, context])
  return Boolean(context && !context.signal.aborted && readyKey === key)
}
