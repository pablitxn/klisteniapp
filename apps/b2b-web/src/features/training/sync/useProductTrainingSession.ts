import {
  LocalWorkoutFlush,
  type FlushLocalWorkout,
  type LocalWorkoutFlushOptions,
} from './localWorkoutFlush.ts'
import {
  workoutPrescription,
  prescriptionContent,
  firstCorrectionProblem,
  confirmLegacyEntry,
  validateWorkoutBinding,
  type WorkoutBinding,
} from './workoutPrescription.ts'
import { newWorkoutId } from './workoutCrypto'
import { useEffect, useRef, useState } from 'react'
import type {
  ProductAccess,
  RoutineVersionV2,
  SessionPrescriptionBinding,
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
  hasPendingWorkoutOperation,
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
  routine?: RoutineVersionV2
  prescription?: SessionPrescriptionBinding
  store: WorkoutStore
  access: ProductAccess | null
  transport: WorkoutTransport
  /** Parent enables only after composed WP06 authorization acceptance. */
  integrationAccepted?: boolean
  /** Called only after a real owner document is durably loaded or created. */
  onDocumentReady?: (document: WorkoutDocument) => void | Promise<void>
  /** Parent supplies the existing account/realm/authorization lifetime. */
  contextSignal?: AbortSignal
  /** Ordinary route departures await this seam; revocation never waits for it. */
  registerLocalFlush?: (flush: FlushLocalWorkout) => void | (() => void)
}
export function useProductTrainingSession(options: ProductWorkoutOptions) {
  const { initial, store, access, transport, integrationAccepted = false } = options
  const prescription = workoutPrescription(options)
  const prescriptionIdentity = canonicalJson(prescription)
  const currentPrescription = () =>
    prescriptionContent(current.current?.binding?.prescription ?? prescription)
  const [document, setDocument] = useState<WorkoutDocument | null>(null)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [recovered, setRecovered] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [busy, setBusy] = useState(false)
  const retryCount = useRef(0)
  const contextController = useRef(new AbortController())
  const current = useRef<WorkoutDocument | null>(null)
  const durableReady = useRef(false)
  const departure = useRef(new LocalWorkoutFlush())
  const closeCompletion = useRef<Promise<void> | null>(null)
  const failedWrite = useRef<{ error: unknown; base: WorkoutDocument } | null>(null)
  const initialFailure = useRef<unknown>(null)
  const selectionFailure = useRef<unknown>(null)
  const tasks = useRef<Promise<unknown>>(Promise.resolve())
  const generation = useRef(0)
  const accessRef = useRef(access)
  accessRef.current = access
  const runnerRef = useRef<WorkoutSync | null>(null)
  const onDocumentReady = useRef(options.onDocumentReady)
  onDocumentReady.current = options.onDocumentReady
  const editable = canEditWorkout(initial.scope, access)
  const accessIdentity = canonicalJson(access)
  const fence = {
    key: initial.key,
    accessIdentity,
    prescriptionIdentity,
    signal: options.contextSignal,
  }
  const renderedContext = useRef(fence)
  renderedContext.current = fence
  function isCurrent(epoch: number) {
    const latest = renderedContext.current
    return (
      epoch === generation.current &&
      latest.key === fence.key &&
      latest.accessIdentity === fence.accessIdentity &&
      latest.prescriptionIdentity === fence.prescriptionIdentity &&
      latest.signal === fence.signal &&
      !fence.signal?.aborted &&
      !contextController.current.signal.aborted
    )
  }
  function assertCurrent(epoch: number) {
    if (!isCurrent(epoch)) throw new DOMException('Departed workout context', 'AbortError')
  }
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
    const lifecycle = new LocalWorkoutFlush()
    departure.current.cancel()
    departure.current = lifecycle
    failedWrite.current = null
    initialFailure.current = null
    selectionFailure.current = null
    closeCompletion.current = null
    setClosing(false)
    setCloseError('')
    const revoke = () => {
      if (epoch !== generation.current) return
      generation.current++
      lifecycle.cancel()
      runner.cancel()
      controller.abort()
      current.current = null
      setDocument(null)
      setClosing(false)
    }
    options.contextSignal?.addEventListener('abort', revoke, { once: true })
    if (options.contextSignal?.aborted) revoke()
    current.current = null
    durableReady.current = false
    setDocument(null)
    setError('')
    setValidationError('')
    setStorageError('')
    tasks.current = (async () => {
      try {
        assertCurrent(epoch)
        if (
          accessRef.current?.userId !== initial.scope.accountId ||
          accessRef.current.organizationId !== initial.scope.organizationId
        )
          return
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
          assertCurrent(epoch)
          if (!canEditWorkout(initial.scope, accessRef.current))
            throw new DOMException('Current workout authorization is required', 'AbortError')
          await store.compareAndSet(initial, null, controller.signal)
          d = initial
        }
        if (epoch !== generation.current) return
        current.current = d
        setDocument(d)
        setRecovered(d !== initial)
        try {
          if (canEditWorkout(initial.scope, accessRef.current)) await onDocumentReady.current?.(d)
          assertCurrent(epoch)
          durableReady.current = true
          selectionFailure.current = null
        } catch (error) {
          if (isCurrent(epoch)) {
            selectionFailure.current = error
            setStorageError(`No pudimos conservar la selección de recuperación: ${String(error)}`)
          }
        }
      } catch (e) {
        if (isCurrent(epoch)) {
          initialFailure.current = e
          setStorageError(String(e))
          current.current = initial
          setDocument(initial)
        }
      }
    })()
    return () => {
      options.contextSignal?.removeEventListener('abort', revoke)
      generation.current++
      lifecycle.cancel()
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
    prescriptionIdentity,
    options.contextSignal,
  ])
  useEffect(
    () => options.registerLocalFlush?.((request) => flushLocal(request)),
    [
      options.registerLocalFlush,
      initial.key,
      accessIdentity,
      prescriptionIdentity,
      options.contextSignal,
    ],
  )
  function serialize(task: () => Promise<void>) {
    if (!departure.current.acceptingEdits) return Promise.resolve()
    const epoch = generation.current
    tasks.current = tasks.current
      .catch(() => {})
      .then(async () => {
        if (!isCurrent(epoch)) return
        try {
          await task()
        } catch (e) {
          if (isCurrent(epoch)) setError(e instanceof Error ? e.message : String(e))
        }
      })
    return tasks.current
  }
  async function persist(next: WorkoutDocument, retryBase?: WorkoutDocument) {
    const epoch = generation.current
    assertCurrent(epoch)
    if (!canEditWorkout(initial.scope, accessRef.current))
      throw new DOMException('Current workout authorization is required', 'AbortError')
    if (!retryBase && failedWrite.current) throw failedWrite.current.error
    const previous = retryBase ?? current.current!
    let base = previous
    // Delivery can update metadata while the form remains editable. Apply only
    // changed fields, and fail closed if another writer changed those fields.
    const changed = (Object.keys(next) as (keyof WorkoutDocument)[]).filter(
      (key) => key !== 'generation' && canonicalJson(next[key]) !== canonicalJson(previous[key]),
    )
    for (let attempt = 0; attempt < 5; attempt++) {
      assertCurrent(epoch)
      const updated = { ...base, generation: base.generation + 1 }
      for (const key of changed) Object.assign(updated, { [key]: next[key] })
      try {
        await store.compareAndSet(updated, base.generation, contextController.current.signal)
        assertCurrent(epoch)
        current.current = updated
        setDocument(updated)
        failedWrite.current = null
        if (durableReady.current && !selectionFailure.current && !initialFailure.current)
          setStorageError('')
        return
      } catch (e) {
        assertCurrent(epoch)
        if (e instanceof LocalWorkoutConflict && attempt < 4) {
          const latest = await store.read(initial.key)
          assertCurrent(epoch)
          if (
            latest &&
            changed.every((key) => canonicalJson(latest[key]) === canonicalJson(previous[key]))
          ) {
            base = latest
            continue
          }
        }
        if (isCurrent(epoch)) {
          failedWrite.current ??= { error: e, base: previous }
          setStorageError(String(e))
        }
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
    if (
      !online ||
      !editable ||
      !integrationAccepted ||
      storageError ||
      busy ||
      !departure.current.acceptingEdits
    )
      return
    const epoch = generation.current
    let prepared = false
    await serialize(async () => {
      const d = current.current
      const a = accessRef.current
      if (
        !d ||
        !a ||
        !canEditWorkout(initial.scope, a) ||
        !durableReady.current ||
        !departure.current.acceptingEdits
      )
        return
      if (!hasPendingWorkoutOperation(d)) {
        const correctionProblem = firstCorrectionProblem(d)
        if (correctionProblem) throw new Error(correctionProblem)
        const issues = sessionIssues(d.content, currentPrescription(), d.accepted?.content)
        if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'))
      }
      const queued = await queueWorkout(
        d,
        a.accessRevision,
        newWorkoutId(),
        new Date().toISOString(),
      )
      if (queued !== d) await persist(queued)
      prepared = true
    })
    if (!prepared || epoch !== generation.current || !departure.current.acceptingEdits) return
    setError('')
    setBusy(true)
    try {
      await runnerRef.current?.replay(initial.key)
      await serialize(async () => {
        const latest = await store.read(initial.key)
        if (
          epoch === generation.current &&
          latest &&
          latest.generation !== current.current?.generation &&
          !failedWrite.current
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
      (!hasPendingWorkoutOperation(document) && firstCorrectionProblem(document)) ||
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
    let prepared = false
    await serialize(async () => {
      if (!current.current || !canEditWorkout(initial.scope, accessRef.current)) return
      let content: SessionContent
      try {
        content = prepareWorkoutContent(current.current, currentPrescription(), complete)
      } catch (failure) {
        // A rejected explicit intent must survive unrelated partial acknowledgements.
        setValidationError(failure instanceof Error ? failure.message : String(failure))
        return
      }
      await persist({ ...current.current, content })
      setValidationError('')
      prepared = true
    })
    if (prepared) await synchronize()
  }
  function recover(remote: SessionRevision, choice: 'server' | 'local', binding?: WorkoutBinding) {
    if (!editable) return
    return serialize(async () => {
      const authoritative = binding
        ? validateWorkoutBinding(current.current!, binding)
        : current.current?.binding
      if (
        binding &&
        (!binding.accepted || canonicalJson(binding.accepted) !== canonicalJson(remote))
      )
        throw new Error('Conflict recovery requires the exact bound server revision')
      const d = {
        ...resolveWorkoutConflict(current.current!, remote, choice),
        ...(authoritative ? { binding: authoritative } : {}),
      }
      const issues = sessionIssues(
        d.content,
        prescriptionContent(authoritative?.prescription ?? prescription),
        remote.content,
      )
      if (choice === 'local' && issues.length)
        throw new Error(issues.map((i) => i.message).join('\n'))
      await persist(d)
      setError('')
    })
  }
  async function resume() {
    if (!departure.current.acceptingEdits) return
    const epoch = generation.current
    try {
      const a = await transport.access(contextController.current.signal)
      if (!isCurrent(epoch) || !current.current || !departure.current.acceptingEdits) return
      if (!canEditWorkout(initial.scope, a))
        throw new Error('El acceso actual no permite enviar sesiones.')
      return serialize(async () => {
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
    } catch (error) {
      if (isCurrent(epoch)) setError(String(error))
    }
  }
  function reloadLocal() {
    return serialize(async () => {
      const epoch = generation.current
      const latest = await store.read(initial.key)
      if (epoch !== generation.current) return
      if (!latest) {
        if (!current.current) return
        const recovered = { ...current.current, generation: 0 }
        assertCurrent(epoch)
        await store.compareAndSet(recovered, null, contextController.current.signal)
        if (epoch !== generation.current) return
        current.current = recovered
        setDocument(recovered)
        await onDocumentReady.current?.(recovered)
        if (epoch !== generation.current) return
        durableReady.current = true
        initialFailure.current = selectionFailure.current = failedWrite.current = null
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
        assertCurrent(epoch)
        await store.compareAndSet(recovery, latest.generation, contextController.current.signal)
        if (epoch !== generation.current) return
        current.current = recovery
        setDocument(recovery)
      } else {
        current.current = latest
        setDocument(latest)
      }
      await onDocumentReady.current?.(current.current!)
      if (epoch !== generation.current) return
      durableReady.current = true
      initialFailure.current = selectionFailure.current = failedWrite.current = null
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
      const issues = sessionIssues(d.content, currentPrescription(), d.accepted?.content)
      if (issues.length) throw new Error(issues.map((i) => i.message).join('\n'))
      await persist(d)
      setError('')
    })
  }
  function flushLocal(request: LocalWorkoutFlushOptions = {}): Promise<void> {
    const epoch = generation.current
    const lifecycle = departure.current
    const queued = tasks.current
    const result = lifecycle.run(
      async () => {
        // The queue may contain swallowed form errors; durability is tracked separately.
        await queued
        assertCurrent(epoch)
        if (initialFailure.current) throw initialFailure.current
        if (failedWrite.current) {
          if (!request.retry) throw failedWrite.current.error
          const failed = failedWrite.current
          await persist(current.current!, failed.base)
        }
        assertCurrent(epoch)
        if (selectionFailure.current && !request.retry) throw selectionFailure.current
        if (!current.current) throw new Error('No local workout is available to flush')
        try {
          await onDocumentReady.current?.(current.current)
          assertCurrent(epoch)
          selectionFailure.current = null
          durableReady.current = true
          setStorageError('')
        } catch (error) {
          if (isCurrent(epoch)) {
            selectionFailure.current = error
            durableReady.current = false
            setStorageError(`No pudimos conservar la selección de recuperación: ${String(error)}`)
          }
          throw error
        }
      },
      () => isCurrent(epoch),
    )
    if (isCurrent(epoch)) setClosing(true)
    void result.catch((error) => {
      if (isCurrent(epoch)) {
        setClosing(false)
        setCloseError(
          `No pudimos guardar todos los cambios en este dispositivo. Conservamos la pantalla para reintentar o exportar. ${String(error)}`,
        )
      }
    })
    return result
  }
  function requestClose(close: () => void, request: LocalWorkoutFlushOptions = {}): Promise<void> {
    const epoch = generation.current
    if (!isCurrent(epoch))
      return Promise.reject(new DOMException('Departed workout context', 'AbortError'))
    if (closeCompletion.current) return closeCompletion.current
    const completion = flushLocal(request).then(() => {
      assertCurrent(epoch)
      close()
    })
    closeCompletion.current = completion
    void completion.catch(() => {
      if (closeCompletion.current === completion) closeCompletion.current = null
    })
    return completion
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
    access.organizationId === initial.scope.organizationId &&
    !options.contextSignal?.aborted
      ? document
      : null
  return {
    document: visible,
    editable,
    closing,
    closeError,
    flushLocal,
    requestClose,
    recovered,
    online,
    busy,
    error,
    validationError,
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
    correctionProblem: visible ? firstCorrectionProblem(visible) : null,
    confirmLegacyCorrection: (key: string) => {
      if (!editable) return
      return serialize(async () => {
        if (current.current) await persist(confirmLegacyEntry(current.current, key))
      })
    },
  }
}
