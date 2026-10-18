import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  authenticatedRecoveryOwner,
  restoreSelectedWorkout,
  rememberSelectedWorkout,
  exportSelectedOwnerWorkout,
  mayResumeSelectedWorkout,
  type WorkoutRecoveryContext,
} from './selectedWorkoutRecovery.ts'
import {
  recoveryOwnerKey,
  type SelectedWorkoutRecovery,
  type WorkoutRecoveryStore,
} from './recoverySelection.ts'
import type { WorkoutDocument } from './workoutStore.ts'

/** Selection belongs to the existing session authority; this adds no login or
 * replay controller. A realm pointer is an owner-local preference, never a grant. */
export function useSelectedWorkoutRecovery(
  store: WorkoutRecoveryStore,
  context: WorkoutRecoveryContext | null,
) {
  let key = ''
  try {
    if (context) key = recoveryOwnerKey(authenticatedRecoveryOwner(context))
  } catch {
    /* Current discovery is unavailable. */
  }
  const [state, setState] = useState<{
    key: string
    selected: SelectedWorkoutRecovery | null
    error: string
  }>({ key: '', selected: null, error: '' })
  const [loading, setLoading] = useState(false)
  const current = useRef(context),
    generation = useRef(0),
    selectionRequest = useRef<AbortController | null>(null)
  current.current = context
  useEffect(() => {
    const epoch = ++generation.current,
      controller = new AbortController()
    selectionRequest.current?.abort()
    if (!context || !key) {
      setState({ key: '', selected: null, error: '' })
      setLoading(false)
      return
    }
    const scoped = { ...context, signal: AbortSignal.any([context.signal, controller.signal]) }
    setLoading(true)
    void restoreSelectedWorkout(store, scoped)
      .then((selected) => {
        if (epoch === generation.current && !scoped.signal.aborted)
          setState({ key, selected, error: '' })
      })
      .catch((error) => {
        if (epoch === generation.current && !scoped.signal.aborted)
          setState({ key, selected: null, error: String(error) })
      })
      .finally(() => {
        if (epoch === generation.current) setLoading(false)
      })
    return () => {
      generation.current++
      controller.abort()
      selectionRequest.current?.abort()
    }
  }, [
    store,
    key,
    context?.signal,
    context?.branchId,
    context?.access.accessMode,
    context?.access.accessRevision,
  ])
  const remember = useCallback(
    async (document: Pick<WorkoutDocument, 'scope' | 'id'>) => {
      const authority = current.current
      if (!authority || authority.signal.aborted)
        throw new Error('Current owner context is unavailable')
      const ownerKey = recoveryOwnerKey(authenticatedRecoveryOwner(authority)),
        epoch = generation.current
      selectionRequest.current?.abort()
      const controller = new AbortController()
      selectionRequest.current = controller
      const scoped = {
        ...authority,
        signal: AbortSignal.any([authority.signal, controller.signal]),
      }
      try {
        const selected = await rememberSelectedWorkout(store, scoped, {
          scope: document.scope,
          id: document.id,
        })
        scoped.signal.throwIfAborted()
        if (epoch === generation.current) setState({ key: ownerKey, selected, error: '' })
      } catch (error) {
        if (epoch === generation.current && !scoped.signal.aborted)
          setState((previous) => ({
            key: ownerKey,
            selected: previous.key === ownerKey ? previous.selected : null,
            error: String(error),
          }))
        throw error
      }
    },
    [store],
  )
  const exportOwnPending = useCallback(
    async ({ signal, access }: { signal: AbortSignal; access?: ProductAccess }) => {
      const authority = current.current
      if (!authority) throw new Error('Current owner context is unavailable')
      return exportSelectedOwnerWorkout(store, {
        ...authority,
        access: access ?? authority.access,
        signal: AbortSignal.any([signal, authority.signal]),
      })
    },
    [store],
  )
  const selected =
    context && key && state.key === key && !context.signal.aborted ? state.selected : null
  return {
    selected,
    loading: Boolean(key) && loading,
    error: state.key === key ? state.error : '',
    canResume: Boolean(context && selected && mayResumeSelectedWorkout(context, selected.document)),
    remember,
    exportOwnPending,
  }
}
