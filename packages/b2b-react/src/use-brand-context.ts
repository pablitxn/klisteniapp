import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, b2bClient, errorMessage } from '@klisteniapp/b2b-client'
import type { BrandContext } from '@klisteniapp/b2b-contracts'

/** The public context is fetched before auth; an explicit legacy 404 is the only fallback. */
export function useBrandContext() {
  const [state, setState] = useState<{
    context: BrandContext | null
    loading: boolean
    error: string
    errorResponse: { status: number; code: string } | null
  }>({ context: null, loading: true, error: '', errorResponse: null })
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    const current = ++generation.current
    void b2bClient
      .withSignal(controller.signal)
      .context()
      .then(
        (context) => {
          if (!controller.signal.aborted && current === generation.current)
            setState({ context, loading: false, error: '', errorResponse: null })
        },
        (error) => {
          if (!controller.signal.aborted && current === generation.current) {
            const legacy =
              error instanceof ApiError &&
              error.status === 404 &&
              error.code === 'WHITE_LABEL_DISABLED'
            setState({
              context: null,
              loading: false,
              error: legacy ? '' : errorMessage(error),
              errorResponse:
                !legacy && error instanceof ApiError
                  ? { status: error.status, code: error.code }
                  : null,
            })
          }
        },
      )
    return () => controller.abort()
  }, [revision])
  return { ...state, refresh }
}
