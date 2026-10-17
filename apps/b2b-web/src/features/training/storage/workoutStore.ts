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

export type WorkoutScope = {
  origin: string
  accountId: string
  organizationId: string
  branchId: string
  actorId: string
}
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
export class LocalWorkoutConflict extends Error {
  constructor() {
    super('This workout changed in another tab. Reload the local copy before editing.')
    this.name = 'LocalWorkoutConflict'
  }
}
export function workoutKey(scope: WorkoutScope, id: string): string {
  return JSON.stringify([
    scope.origin,
    scope.accountId,
    scope.organizationId,
    scope.branchId,
    scope.actorId,
    id,
  ])
}
export function sameScope(a: WorkoutScope, b: WorkoutScope): boolean {
  return (
    a.origin === b.origin &&
    a.accountId === b.accountId &&
    a.organizationId === b.organizationId &&
    a.branchId === b.branchId &&
    a.actorId === b.actorId
  )
}
/** Stored bytes are untrusted and future versions must never be overwritten. */
export function parseWorkoutDocument(value: unknown): WorkoutDocument {
  if (!value || typeof value !== 'object') throw new Error('Invalid local workout')
  const d = value as WorkoutDocument
  if (
    d.schemaVersion !== 2 ||
    !d.scope ||
    Object.values(d.scope).length !== 5 ||
    Object.values(d.scope).some((v) => typeof v !== 'string' || !v) ||
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
export class IndexedDBWorkoutStore implements WorkoutStore {
  private database: Promise<IDBDatabase>
  constructor(factory: IDBFactory = indexedDB, name = 'klisteni.b2b.workouts') {
    this.database = new Promise((resolve, reject) => {
      const request = factory.open(name, 2)
      let blocked = false
      request.onupgradeneeded = () => {
        for (const name of ['workouts-v2', 'legacy-recovery'])
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
  async close() {
    ;(await this.database).close()
  }
}
