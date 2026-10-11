import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ApiError, errorMessage } from '@klisteniapp/b2b-client'
import { initialResourceState, resourceReducer } from './resource-state.ts'

export type LoadOptions = { refreshKey?: string | number }

/** key identifies the data owner; refreshKey revalidates without resetting editors. */
export function useLoad<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  key: string,
  options: LoadOptions = {},
) {
  const [state, dispatch] = useReducer(resourceReducer<T>, key, initialResourceState<T>)
  const [refresh, setRefresh] = useState(0)
  const requestId = useRef(0)
  const currentLoader = useRef(loader)
  currentLoader.current = loader
  const reload = useCallback(() => setRefresh((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const id = ++requestId.current
    const run = currentLoader.current
    dispatch({ type: 'start', key, requestId: id })
    // Promise.resolve also handles a synchronous failure in a loader/parser.
    void Promise.resolve()
      .then(() => run(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted) dispatch({ type: 'success', key, requestId: id, data })
        },
        (error) => {
          if (!controller.signal.aborted) {
            dispatch({
              type: 'failure',
              key,
              requestId: id,
              error: errorMessage(error),
              clearData:
                error instanceof ApiError && (error.status === 401 || error.status === 403),
            })
          }
        },
      )
    return () => controller.abort()
  }, [key, options.refreshKey, refresh])

  // Hide previous-owner data immediately, before the effect for the new key runs.
  const current = state.key === key ? state : initialResourceState<T>(key)
  return { data: current.data, error: current.error, loading: current.loading, reload }
}
