import { useEffect, useMemo, useRef, useState } from 'react'
import type { HealthAccess } from '../features/health/healthAccess'
import { ProductStreamGuard } from './productStreamGuard'

/** Trainer projections fail closed immediately. Workspace transport failures
 * suspend network work but retain owner-local editors until authority changes. */
export function useProductStream(
  context: HealthAccess | null,
  memberId: string | undefined,
  onInvalidate: () => void,
  workspace?: { revalidate: () => Promise<boolean> },
) {
  const connection = useMemo(() => ({ guard: new ProductStreamGuard() }), [context, memberId])
  const [readyConnection, setReadyConnection] = useState<object | null>(null)
  const [validatedConnection, setValidatedConnection] = useState<object | null>(null)
  const callback = useRef(onInvalidate),
    revalidate = useRef(workspace?.revalidate)
  callback.current = onInvalidate
  revalidate.current = workspace?.revalidate
  const retain = Boolean(workspace)
  useEffect(() => {
    if (!context || context.signal.aborted) return
    const lifetime = new AbortController()
    let stream: AbortController | null = null,
      watchdog: ReturnType<typeof setTimeout> | undefined,
      retry: ReturnType<typeof setTimeout> | undefined,
      invalidated = false
    const suspend = () => {
      connection.guard.suspend()
      setReadyConnection(null)
      stream?.abort()
      stream = null
      clearTimeout(watchdog)
    }
    const invalidate = () => {
      if (invalidated || lifetime.signal.aborted || context.signal.aborted) return
      invalidated = true
      suspend()
      callback.current()
    }
    const unavailable = () => {
      if (lifetime.signal.aborted || invalidated) return
      if (!retain) return invalidate()
      suspend()
      clearTimeout(retry)
      retry = setTimeout(() => void connect(), 1000)
    }
    const hidden = () => {
      if (document.visibilityState !== 'visible') unavailable()
      else void connect()
    }
    async function connect() {
      if (
        stream ||
        invalidated ||
        document.visibilityState !== 'visible' ||
        !navigator.onLine ||
        lifetime.signal.aborted ||
        context!.signal.aborted
      )
        return
      clearTimeout(retry)
      const current = new AbortController()
      stream = current
      const signal = AbortSignal.any([context!.signal, lifetime.signal, current.signal])
      const reset = () => {
        clearTimeout(watchdog)
        watchdog = setTimeout(unavailable, 10_000)
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
        if (response.status === 401 || response.status === 403) return invalidate()
        if (
          !response.ok ||
          !response.headers.get('content-type')?.startsWith('text/event-stream') ||
          !response.body
        )
          throw new Error('Event authority unavailable')
        const reader = response.body.getReader(),
          decoder = new TextDecoder()
        let pending = '',
          receivedReady = false
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
              if (event === 'invalidate' || !event || (!receivedReady && event !== 'ready')) {
                invalidate()
                return
              }
              reset()
              if (event === 'ready') {
                if (receivedReady) throw new Error('Duplicate stream readiness')
                receivedReady = true
                if (revalidate.current && !(await revalidate.current())) {
                  if (!signal.aborted && stream === current) unavailable()
                  return
                }
                if (signal.aborted || stream !== current) return
                connection.guard.activate()
                setReadyConnection(connection)
                setValidatedConnection(connection)
              }
            }
          }
        } finally {
          await reader.cancel().catch(() => undefined)
        }
        if (!signal.aborted) unavailable()
      } catch {
        if (!signal.aborted) unavailable()
      } finally {
        if (stream === current) clearTimeout(watchdog)
      }
    }
    const abort = () => {
      connection.guard.suspend()
      lifetime.abort()
      stream?.abort()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('offline', unavailable)
    window.addEventListener('online', connect)
    context.signal.addEventListener('abort', abort, { once: true, signal: lifetime.signal })
    void connect()
    return () => {
      abort()
      clearTimeout(watchdog)
      clearTimeout(retry)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('offline', unavailable)
      window.removeEventListener('online', connect)
    }
  }, [connection, context, memberId, retain])
  return {
    ready: Boolean(context && !context.signal.aborted && readyConnection === connection),
    validated: Boolean(context && !context.signal.aborted && validatedConnection === connection),
    guard: connection.guard,
  }
}
