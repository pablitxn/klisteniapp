import { newWorkoutId } from './workoutCrypto'
import { useEffect, useRef, useState } from 'react'
import type {
  ProductAccess,
  RoutineVersionV2,
  SessionContent,
  SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson, sessionIssues } from '@klisteniapp/b2b-domain/sessions'
import {
  LocalWorkoutConflict,
  type WorkoutDocument,
  type WorkoutStore,
} from '../storage/workoutStore.ts'
import {
  canEditWorkout,
  editedContent,
  ownerWorkoutExport,
  queueWorkout,
  resolveWorkoutConflict,
  reviseRejectedWorkout,
  WorkoutSync,
  type WorkoutTransport,
} from './workoutSync.ts'
import { archiveUnacceptedTarget, prepareWorkoutContent } from './workoutEdit.ts'
export type ProductWorkoutOptions = {
  initial: WorkoutDocument
  routine: RoutineVersionV2
  store: WorkoutStore
  access: ProductAccess | null
  transport: WorkoutTransport
  /** Parent enables only after composed WP06 authorization acceptance. */
  integrationAccepted?: boolean
  /** Called only after a real owner document is durably loaded or created. */
  onDocumentReady?: (document: WorkoutDocument) => void | Promise<void>
}
export function useProductTrainingSession(options: ProductWorkoutOptions) {
  const { initial, routine, store, access, transport, integrationAccepted = false } = options
  const [document, setDocument] = useState<WorkoutDocument | null>(null)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [recovered, setRecovered] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [busy, setBusy] = useState(false)
  const retryCount = useRef(0)
  const contextController = useRef(new AbortController())
  const current = useRef<WorkoutDocument | null>(null)
  const tasks = useRef<Promise<unknown>>(Promise.resolve())
  const generation = useRef(0)
  const accessRef = useRef(access)
  accessRef.current = access
  const runnerRef = useRef<WorkoutSync | null>(null)
  const onDocumentReady = useRef(options.onDocumentReady)
  onDocumentReady.current = options.onDocumentReady
  const editable = canEditWorkout(initial.scope, access)
  const accessIdentity = canonicalJson(access)
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) {
        retryCount.current = 0
        setError('')
      }
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    contextController.current = controller
    const runner = new WorkoutSync(store, initial.scope, transport, integrationAccepted)
    runnerRef.current = runner
    const epoch = ++generation.current
    current.current = null
    setDocument(null)
    setError('')
    setStorageError('')
    tasks.current = (async () => {
      try {
        let d = await store.read(initial.key)
        if (epoch !== generation.current) return
        if (
          d &&
          (d.key !== initial.key ||
            canonicalJson(d.scope) !== canonicalJson(initial.scope) ||
            canonicalJson(d.origin) !== canonicalJson(initial.origin))
        )
          throw new Error(
            'Stored workout has a different issued origin; the original is preserved.',
          )
        if (!d) {
          await store.compareAndSet(initial, null)
          d = initial
        }
        if (epoch !== generation.current) return
        current.current = d
        setDocument(d)
        setRecovered(d !== initial)
        try {
          await onDocumentReady.current?.(d)
        } catch (error) {
          if (epoch === generation.current)
            setStorageError(`No pudimos conservar la selección de recuperación: ${String(error)}`)
        }
      } catch (e) {
        if (epoch === generation.current) {
          setStorageError(String(e))
          current.current = initial
          setDocument(initial)
        }
      }
    })()
    return () => {
      generation.current++
      runner.cancel()
      controller.abort()
      current.current = null
    }
  }, [
    initial.key,
    store,
    transport,
    integrationAccepted,
    access?.accessMode,
    access?.accessRevision,
    access?.userId,
    accessIdentity,
  ])
  function serialize(task: () => Promise<void>) {
    const epoch = generation.current
    tasks.current = tasks.current
      .catch(() => {})
      .then(async () => {
        if (epoch !== generation.current) return
        try {
          await task()
        } catch (e) {
          if (epoch === generation.current) setError(e instanceof Error ? e.message : String(e))
        }
      })
    return tasks.current
  }
  async function persist(next: WorkoutDocument) {
    const epoch = generation.current
    const previous = current.current!
    let base = previous
    // Delivery can update metadata while the form remains editable. Apply only
    // changed fields, and fail closed if another writer changed those fields.
    const changed = (Object.keys(next) as (keyof WorkoutDocument)[]).filter(
      (key) => key !== 'generation' && canonicalJson(next[key]) !== canonicalJson(previous[key]),
    )
    for (let attempt = 0; attempt < 5; attempt++) {
      if (epoch !== generation.current) return
      const updated = { ...base, generation: base.generation + 1 }
      for (const key of changed) Object.assign(updated, { [key]: next[key] })
      try {
        await store.compareAndSet(updated, base.generation)
        if (epoch !== generation.current) return
        current.current = updated
        setDocument(updated)
        setStorageError('')
        return
      } catch (e) {
        if (e instanceof LocalWorkoutConflict && attempt < 4) {
          const latest = await store.read(initial.key)
          if (
            latest &&
            changed.every((key) => canonicalJson(latest[key]) === canonicalJson(previous[key]))
          ) {
            base = latest
            continue
          }
        }
        if (epoch === generation.current) setStorageError(String(e))
        throw e
      }
    }
  }
  function edit(change: (content: SessionContent) => SessionContent) {
    if (!editable) return
    setError('')
    return serialize(async () => {
      const epoch = generation.current
      if (!canEditWorkout(initial.scope, accessRef.current) || !current.current) return
      const next = { ...current.current, content: editedContent(change(current.current.content)) }
      // Retain edits on screen even if durable storage fails; replay remains disabled.
      try {
        await persist(next)
      } catch {
        if (epoch !== generation.current) return
        current.current = next
        setDocument(next)
      }
    })
  }
  async function synchronize() {
    if (!online || !editable || !integrationAccepted || storageError || busy) return
    const epoch = generation.current
    let prepared = false
    await serialize(async () => {
      const d = current.current
      const a = accessRef.current
      if (!d || !a || !canEditWorkout(initial.scope, a)) return
      const issues = sessionIssues(d.content, routine, d.accepted?.content)
      if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'))
      const queued = await queueWorkout(
        d,
        a.accessRevision,
        newWorkoutId(),
        new Date().toISOString(),
      )
      if (queued !== d) await persist(queued)
      prepared = true
    })
    if (!prepared || epoch !== generation.current) return
    setError('')
    setBusy(true)
    try {
      await runnerRef.current?.replay(initial.key)
      await serialize(async () => {
        const latest = await store.read(initial.key)
        if (
          epoch === generation.current &&
          latest &&
          latest.generation !== current.current?.generation
        ) {
          current.current = latest
          setDocument(latest)
        }
      })
    } catch (e) {
      if (epoch === generation.current) {
        retryCount.current++
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      if (epoch === generation.current) setBusy(false)
    }
  }
  useEffect(() => {
    if (
      !document ||
      !online ||
      !editable ||
      !integrationAccepted ||
      document.problem ||
      storageError ||
      error ||
      busy
    )
      return
    if (
      document.accepted &&
      canonicalJson(document.content) === canonicalJson(document.accepted.content) &&
      !document.operations.some(
        (op) =>
          !document.supersededOperationIds.includes(op.operationId) && op.state !== 'accepted',
      )
    )
      return
    const timer = window.setTimeout(() => {
      void synchronize()
    }, 750)
    return () => window.clearTimeout(timer)
  }, [document, online, editable, integrationAccepted, storageError, busy])
  useEffect(() => {
    if (
      !error ||
      !document ||
      document.problem ||
      storageError ||
      !online ||
      !editable ||
      !integrationAccepted ||
      busy ||
      retryCount.current >= 3 ||
      !document.operations.some(
        (op) =>
          !document.supersededOperationIds.includes(op.operationId) &&
          (op.state === 'queued' || op.state === 'sending'),
      )
    )
      return
    const timer = window.setTimeout(
      () => {
        void synchronize()
      },
      1000 * 2 ** retryCount.current,
    )
    return () => window.clearTimeout(timer)
  }, [error, busy, online, document, storageError, editable, integrationAccepted])
  async function save(complete: boolean | 'void') {
    if (!editable) return
    await serialize(async () => {
      if (!current.current || !canEditWorkout(initial.scope, accessRef.current)) return
      await persist({
        ...current.current,
        content: prepareWorkoutContent(current.current, routine, complete),
      })
    })
    await synchronize()
  }
  function recover(remote: SessionRevision, choice: 'server' | 'local') {
    if (!editable) return
    return serialize(async () => {
      const d = resolveWorkoutConflict(current.current!, remote, choice)
      const issues = sessionIssues(d.content, routine, remote.content)
      if (choice === 'local' && issues.length)
        throw new Error(issues.map((i) => i.message).join('\n'))
      await persist(d)
      setError('')
    })
  }
  function resume() {
    return serialize(async () => {
      const epoch = generation.current
      const a = await transport.access(contextController.current.signal)
      if (epoch !== generation.current || !current.current) return
      if (!canEditWorkout(initial.scope, a))
        throw new Error('El acceso actual no permite enviar sesiones.')
      const d = current.current!
      if (d.problem?.kind !== 'blocked') return
      await persist({
        ...d,
        replayAccessRevision: a.accessRevision,
        problem: null,
        operations: d.operations.map((op) =>
          op.state === 'access-revoked' ? { ...op, state: 'queued' } : op,
        ),
      })
    })
  }
  function reloadLocal() {
    return serialize(async () => {
      const epoch = generation.current
      const latest = await store.read(initial.key)
      if (epoch !== generation.current) return
      if (!latest) {
        if (!current.current) return
        const recovered = { ...current.current, generation: 0 }
        await store.compareAndSet(recovered, null)
        if (epoch !== generation.current) return
        current.current = recovered
        setDocument(recovered)
        await onDocumentReady.current?.(recovered)
        if (epoch !== generation.current) return
        setStorageError('')
        setError('')
        return
      }
      const before = current.current
      if (before && canonicalJson(before.content) !== canonicalJson(latest.content)) {
        const recovery = {
          ...latest,
          recovery: [...latest.recovery, before.content],
          generation: latest.generation + 1,
        }
        await store.compareAndSet(recovery, latest.generation)
        if (epoch !== generation.current) return
        current.current = recovery
        setDocument(recovery)
      } else {
        current.current = latest
        setDocument(latest)
      }
      await onDocumentReady.current?.(current.current!)
      if (epoch !== generation.current) return
      setStorageError('')
      setError('')
    })
  }
  function archiveTarget(id: string) {
    if (!editable) return
    return serialize(async () => {
      if (current.current) await persist(archiveUnacceptedTarget(current.current, id))
    })
  }
  function reviseRejected() {
    if (!editable) return
    return serialize(async () => {
      const d = reviseRejectedWorkout(current.current!)
      const issues = sessionIssues(d.content, routine, d.accepted?.content)
      if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'))
      await persist(d)
      setError('')
    })
  }
  function exportLocal() {
    if (
      !current.current ||
      !access ||
      access.userId !== initial.scope.actorId ||
      access.organizationId !== initial.scope.organizationId
    )
      throw new Error('Owner access required')
    return ownerWorkoutExport(current.current, initial.scope)
  }
  // A changed key never paints the previous account's state, even before effects run.
  const visible =
    document?.key === initial.key &&
    access?.userId === initial.scope.actorId &&
    access.organizationId === initial.scope.organizationId
      ? document
      : null
  return {
    document: visible,
    editable,
    recovered,
    online,
    busy,
    error,
    storageError,
    edit,
    save,
    synchronize,
    recover,
    resume,
    exportLocal,
    reloadLocal,
    reviseRejected,
    archiveTarget,
  }
}
