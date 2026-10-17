import {
  LocalWorkoutConflict,
  sameScope,
  workoutKey,
  workoutScopePrefix,
  unboundWorkoutScope,
  validWorkoutRealm,
  type WorkoutScope,
} from './workoutIdentity.ts'
import {
  recoveryOwnerKey,
  assertRecoveryScope,
  parseRecoveryPointer,
  assertSelectedDocument,
  prepareRecoverySelection,
  type WorkoutRecoveryOwner,
  type SelectedWorkoutRecovery,
  type CommitWorkoutSelection,
  type WorkoutRecoveryStore,
} from './recoverySelection.ts'
export {
  LocalWorkoutConflict,
  sameScope,
  workoutKey,
  type WorkoutScope,
} from './workoutIdentity.ts'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import {
  SaveSessionSchema,
  SessionContentSchema,
  SessionReceiptSchema,
  SessionRevisionSchema,
  OutboxEntrySchema,
  type ProductInput,
  type ProductOutput,
  type SessionContent,
  type SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'

export type SaveWorkout = ProductInput<'saveSession'>
export type WorkoutOperation = ReturnType<typeof OutboxEntrySchema.parse>
export type WorkoutDocument = {
  schemaVersion: 2
  key: string
  scope: WorkoutScope
  id: string
  origin: SaveWorkout['origin']
  generation: number
  content: SessionContent
  accepted: SessionRevision | null
  operations: WorkoutOperation[]
  legacyDraft: { key: string; bytes: string } | null
  supersededOperationIds: string[]
  recovery: SessionContent[]
  problem: null | { kind: 'conflict' | 'blocked' | 'invalid' | 'unavailable'; message: string }
  replayAccessRevision: number | null
}
export interface WorkoutStore {
  read(key: string): Promise<WorkoutDocument | null>
  compareAndSet(document: WorkoutDocument, expectedGeneration: number | null): Promise<void>
  preserveLegacy(key: string, bytes: string): Promise<void>
}
/** Stored bytes are untrusted and future versions must never be overwritten. */
export function parseWorkoutDocument(value: unknown): WorkoutDocument {
  if (!value || typeof value !== 'object') throw new Error('Invalid local workout')
  const d = value as WorkoutDocument
  if (
    d.schemaVersion !== 2 ||
    !d.scope ||
    Object.keys(d.scope).some(
      (key) =>
        !['origin', 'accountId', 'organizationId', 'branchId', 'actorId', 'realm'].includes(key),
    ) ||
    ['origin', 'accountId', 'organizationId', 'branchId', 'actorId'].some(
      (key) =>
        typeof d.scope[key as keyof WorkoutScope] !== 'string' ||
        !d.scope[key as keyof WorkoutScope],
    ) ||
    (d.scope.realm !== undefined && !validWorkoutRealm(d.scope.realm)) ||
    d.key !== workoutKey(d.scope, d.id) ||
    !Number.isSafeInteger(d.generation) ||
    d.generation < 0 ||
    !Array.isArray(d.recovery) ||
    !Array.isArray(d.supersededOperationIds) ||
    d.supersededOperationIds.some((id) => typeof id !== 'string') ||
    !Array.isArray(d.operations) ||
    (d.replayAccessRevision !== null &&
      (!Number.isSafeInteger(d.replayAccessRevision) || d.replayAccessRevision < 0))
  )
    throw new Error('Unsupported local workout. Export recovery data before continuing.')
  SaveSessionSchema.parse({
    id: d.id,
    origin: d.origin,
    content: d.content,
    expectedRevision: 0,
    operationId: d.id,
  })
  if (d.accepted) {
    const accepted = SessionRevisionSchema.parse(d.accepted)
    if (
      accepted.id !== d.id ||
      accepted.scope.organizationId !== d.scope.organizationId ||
      accepted.scope.branchId !== d.scope.branchId ||
      accepted.scope.memberId !== d.scope.actorId ||
      canonicalJson(accepted.origin) !== canonicalJson(d.origin)
    )
      throw new Error('Local accepted identity mismatch')
  }
  if (
    d.legacyDraft !== null &&
    (!d.legacyDraft ||
      typeof d.legacyDraft.key !== 'string' ||
      typeof d.legacyDraft.bytes !== 'string')
  )
    throw new Error('Invalid preserved legacy draft')
  d.recovery.forEach((v) => SessionContentSchema.parse(v))
  const ids = new Set<string>()
  for (const raw of d.operations) {
    const op = OutboxEntrySchema.parse(raw)
    if (
      ids.has(op.operationId) ||
      op.accountId !== d.scope.accountId ||
      op.branchId !== d.scope.branchId ||
      op.actorId !== d.scope.actorId ||
      op.payload.id !== d.id ||
      canonicalJson(op.payload.origin) !== canonicalJson(d.origin)
    )
      throw new Error('Local operation identity mismatch')
    ids.add(op.operationId)
  }
  if (
    d.problem &&
    (!['conflict', 'blocked', 'invalid', 'unavailable'].includes(d.problem.kind) ||
      typeof d.problem.message !== 'string')
  )
    throw new Error('Invalid local recovery state')
  return structuredClone(d)
}
/** CAS protects tabs; immutable-operation checks protect retries from later edits. */
export function assertWorkoutTransition(previous: WorkoutDocument, next: WorkoutDocument): void {
  if (
    previous.key !== next.key ||
    !sameScope(previous.scope, next.scope) ||
    previous.id !== next.id ||
    canonicalJson(previous.origin) !== canonicalJson(next.origin)
  )
    throw new Error('Local original workout identity cannot change')
  if (previous.accepted && (!next.accepted || next.accepted.revision < previous.accepted.revision))
    throw new Error('Accepted workout revision cannot move backwards')
  for (let index = 0; index < previous.operations.length; index++) {
    const old = previous.operations[index]
    const current = next.operations[index]
    if (
      !current ||
      canonicalJson({ ...old, state: undefined, receipt: undefined }) !==
        canonicalJson({ ...current, state: undefined, receipt: undefined })
    )
      throw new Error('Retain every immutable operation payload and identity')
    if (
      old.state === 'accepted' &&
      (current.state !== 'accepted' ||
        canonicalJson(current.receipt) !== canonicalJson(old.receipt))
    )
      throw new Error('Accepted operation receipts are immutable')
  }
}
export function checkedReceipt(value: unknown): ProductOutput<'saveSession'> {
  return SessionReceiptSchema.parse(value)
}

/** Version 1 stores are retained during upgrade; no existing bytes are deleted. */
export class IndexedDBWorkoutStore implements WorkoutRecoveryStore {
  private database: Promise<IDBDatabase>
  constructor(factory: IDBFactory = indexedDB, name = 'klisteni.b2b.workouts') {
    this.database = new Promise((resolve, reject) => {
      const request = factory.open(name, 3)
      let blocked = false
      request.onupgradeneeded = () => {
        for (const name of [
          'workouts-v2',
          'legacy-recovery',
          'selected-workout-v1',
          'unbound-workout-realm-v1',
        ])
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        blocked = true
        reject(new Error('Close other workout tabs to upgrade local storage.'))
      }
      request.onsuccess = () => {
        if (blocked) {
          request.result.close()
          return
        }
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
    })
  }
  async read(key: string) {
    const db = await this.database
    return new Promise<WorkoutDocument | null>((resolve, reject) => {
      const tx = db.transaction('workouts-v2', 'readonly')
      const request = tx.objectStore('workouts-v2').get(key)
      let result: WorkoutDocument | null = null
      request.onsuccess = () => {
        try {
          result = request.result === undefined ? null : parseWorkoutDocument(request.result)
        } catch (e) {
          reject(e)
        }
      }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Storage read aborted'))
    })
  }
  async compareAndSet(document: WorkoutDocument, expectedGeneration: number | null) {
    const value = parseWorkoutDocument(document)
    const db = await this.database
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workouts-v2', 'readwrite')
      const store = tx.objectStore('workouts-v2')
      const request = store.get(value.key)
      let failure: unknown
      request.onsuccess = () => {
        try {
          const current = request.result === undefined ? null : parseWorkoutDocument(request.result)
          if (
            (current?.generation ?? null) !== expectedGeneration ||
            value.generation !== (expectedGeneration === null ? 0 : expectedGeneration + 1)
          )
            throw new LocalWorkoutConflict()
          if (current) assertWorkoutTransition(current, value)
          store.put(value, value.key)
        } catch (e) {
          failure = e
          tx.abort()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Storage write aborted'))
      tx.onerror = () => reject(failure ?? tx.error)
    })
  }
  async preserveLegacy(key: string, bytes: string) {
    const db = await this.database
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('legacy-recovery', 'readwrite')
      // Key includes exact bytes: later legacy edits cannot overwrite earlier retry payloads.
      tx.objectStore('legacy-recovery').put(bytes, JSON.stringify([key, bytes]))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Legacy backup aborted'))
    })
  }
  private async selectionTransaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    signal: AbortSignal,
    run: (tx: IDBTransaction, complete: (value: T) => void, fail: (error: unknown) => void) => void,
  ): Promise<T> {
    signal.throwIfAborted()
    const db = await this.database
    signal.throwIfAborted()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode)
      let result: T
      let failure: unknown
      const abort = () => {
        failure = signal.reason
        try {
          tx.abort()
        } catch {
          /* The transaction may already have committed. */
        }
      }
      const cleanup = () => signal.removeEventListener('abort', abort)
      signal.addEventListener('abort', abort, { once: true })
      tx.oncomplete = () => {
        cleanup()
        if (signal.aborted) reject(signal.reason)
        else resolve(result)
      }
      tx.onabort = () => {
        cleanup()
        reject(failure ?? tx.error ?? new Error('Local recovery transaction aborted'))
      }
      tx.onerror = () => {
        failure ??= tx.error
      }
      const fail = (error: unknown) => {
        failure = error
        tx.abort()
      }
      try {
        run(
          tx,
          (value) => {
            result = value
          },
          fail,
        )
      } catch (error) {
        fail(error)
      }
    })
  }
  async claim(key: string, signal: AbortSignal): Promise<WorkoutRecoveryOwner | null> {
    return this.selectionTransaction(
      ['unbound-workout-realm-v1'],
      'readonly',
      signal,
      (tx, complete, fail) => {
        const request = tx.objectStore('unbound-workout-realm-v1').get(key)
        request.onsuccess = () => {
          try {
            if (request.result === undefined) complete(null)
            else {
              recoveryOwnerKey(request.result)
              complete(structuredClone(request.result))
            }
          } catch (error) {
            fail(error)
          }
        }
      },
    )
  }
  async selected(
    owner: WorkoutRecoveryOwner,
    signal: AbortSignal,
  ): Promise<SelectedWorkoutRecovery | null> {
    const key = recoveryOwnerKey(owner)
    return this.selectionTransaction(
      ['selected-workout-v1', 'workouts-v2'],
      'readonly',
      signal,
      (tx, complete, fail) => {
        const selected = tx.objectStore('selected-workout-v1').get(key)
        selected.onsuccess = () => {
          try {
            if (selected.result === undefined) {
              complete(null)
              return
            }
            const pointer = parseRecoveryPointer(selected.result, owner)
            const record = tx.objectStore('workouts-v2').get(pointer.documentKey)
            record.onsuccess = () => {
              try {
                if (record.result === undefined)
                  throw new Error('Selected local workout is missing; the pointer is preserved')
                const document = parseWorkoutDocument(record.result)
                assertSelectedDocument(pointer, document)
                complete({ pointer, document })
              } catch (error) {
                fail(error)
              }
            }
          } catch (error) {
            fail(error)
          }
        }
      },
    )
  }
  async list(scope: WorkoutScope, signal: AbortSignal): Promise<WorkoutDocument[]> {
    const prefix = workoutScopePrefix(scope)
    return this.selectionTransaction(['workouts-v2'], 'readonly', signal, (tx, complete, fail) => {
      const results: WorkoutDocument[] = []
      const request = tx
        .objectStore('workouts-v2')
        .openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'))
      request.onsuccess = () => {
        try {
          const cursor = request.result
          if (!cursor) {
            complete(results)
            return
          }
          const key: unknown = typeof cursor.key === 'string' ? JSON.parse(cursor.key) : null
          if (
            !Array.isArray(key) ||
            typeof key.at(-1) !== 'string' ||
            workoutKey(scope, key.at(-1)) !== cursor.key
          ) {
            cursor.continue()
            return
          }
          const document = parseWorkoutDocument(cursor.value)
          if (sameScope(scope, document.scope)) results.push(document)
          cursor.continue()
        } catch (error) {
          fail(error)
        }
      }
    })
  }
  async commitSelection(
    input: CommitWorkoutSelection,
    signal: AbortSignal,
  ): Promise<SelectedWorkoutRecovery> {
    assertRecoveryScope(input.owner, input.scope)
    const key = recoveryOwnerKey(input.owner),
      targetKey = workoutKey(input.scope, input.id)
    const unboundKey = workoutKey(unboundWorkoutScope(input.scope), input.id)
    if (input.create && input.adoptUnbound) throw new Error('Choose new work or explicit adoption')
    if (input.adoptUnbound && input.adoptUnbound.key !== unboundKey)
      throw new Error('Invalid unbound adoption source')
    return this.selectionTransaction(
      ['selected-workout-v1', 'workouts-v2', 'unbound-workout-realm-v1'],
      'readwrite',
      signal,
      (tx, complete, fail) => {
        const selections = tx.objectStore('selected-workout-v1'),
          documents = tx.objectStore('workouts-v2')
        const selection = selections.get(key),
          target = documents.get(targetKey)
        const source = input.adoptUnbound ? documents.get(unboundKey) : null
        const claim = input.adoptUnbound
          ? tx.objectStore('unbound-workout-realm-v1').get(unboundKey)
          : null
        let selectionReady = false,
          targetReady = false,
          sourceReady = source === null,
          claimReady = claim === null
        const commit = () => {
          if (!selectionReady || !targetReady || !sourceReady || !claimReady) return
          try {
            const previous =
              selection.result === undefined
                ? null
                : parseRecoveryPointer(selection.result, input.owner)
            const document =
              target.result === undefined ? null : parseWorkoutDocument(target.result)
            const original =
              source?.result === undefined ? null : parseWorkoutDocument(source.result)
            const checked = input.create
              ? { ...input, create: parseWorkoutDocument(input.create) }
              : input
            const selected = prepareRecoverySelection(
              checked,
              previous,
              document,
              original,
              claim?.result ?? null,
            )
            if (input.create || input.adoptUnbound)
              documents.add(parseWorkoutDocument(selected.document), targetKey)
            if (input.adoptUnbound)
              tx.objectStore('unbound-workout-realm-v1').put(input.owner, unboundKey)
            selections.put(selected.pointer, key)
            complete(selected)
          } catch (error) {
            fail(error)
          }
        }
        selection.onsuccess = () => {
          selectionReady = true
          commit()
        }
        target.onsuccess = () => {
          targetReady = true
          commit()
        }
        if (claim)
          claim.onsuccess = () => {
            claimReady = true
            commit()
          }
        if (source)
          source.onsuccess = () => {
            sourceReady = true
            commit()
          }
      },
    )
  }
  async close() {
    ;(await this.database).close()
  }
}
