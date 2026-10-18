import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, b2bClient, errorMessage } from '@klisteniapp/b2b-client'
import type { BrandContext } from '@klisteniapp/b2b-contracts'

/** The public context is fetched before auth; an explicit legacy 404 is the only fallback. */
export function useBrandContext() {
  const [state, setState] = useState<{
    context: BrandContext | null
    loading: boolean
    error: string
  }>({ context: null, loading: true, error: '' })
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
            setState({ context, loading: false, error: '' })
        },
        (error) => {
          if (!controller.signal.aborted && current === generation.current)
            setState({
              context: null,
              loading: false,
              error:
                error instanceof ApiError &&
                error.status === 404 &&
                error.code === 'WHITE_LABEL_DISABLED'
                  ? ''
                  : errorMessage(error),
            })
        },
      )
    return () => controller.abort()
  }, [revision])
  return { ...state, refresh }
}
