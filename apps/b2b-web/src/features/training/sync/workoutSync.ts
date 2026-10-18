import { firstCorrectionProblem } from './workoutPrescription.ts'
import { workoutContentHash } from './workoutCrypto.ts'
import {
  ProductAccessSchema,
  SessionRevisionSchema,
  OutboxEntrySchema,
  type ProductAccess,
  type SessionContent,
  type SessionRevision,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import {
  checkedReceipt,
  sameScope,
  type WorkoutDocument,
  type WorkoutScope,
  type WorkoutStore,
  type SaveWorkout,
} from '../storage/workoutStore.ts'

export type WorkoutTransport = {
  /** Must refresh current host/session/branch access before every mutation. */
  access(signal: AbortSignal): Promise<ProductAccess>
  save(payload: SaveWorkout, signal: AbortSignal): Promise<unknown>
}
export type WorkoutFailure = {
  status?: number
  code?: string
  message?: string
  issues?: { code: string; message: string }[]
}
export function canEditWorkout(scope: WorkoutScope, value: ProductAccess | null): boolean {
  const result = ProductAccessSchema.safeParse(value)
  if (!result.success) return false
  const access = result.data
  return (
    access.userId === scope.actorId &&
    scope.accountId === scope.actorId &&
    access.organizationId === scope.organizationId &&
    access.accessMode === 'active' &&
    access.capabilities.includes('edit-own-sessions') &&
    access.branches.some((b) => b.branchId === scope.branchId && b.role === 'member')
  )
}
export async function workoutRequestHash(scope: WorkoutScope, input: SaveWorkout): Promise<string> {
  return workoutContentHash(
    canonicalJson({
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      actorId: scope.actorId,
      action: 'session.save',
      input,
    }),
  )
}
export function hasPendingWorkoutOperation(document: WorkoutDocument): boolean {
  return document.operations.some(
    (op) => op.state !== 'accepted' && !document.supersededOperationIds.includes(op.operationId),
  )
}
export async function queueWorkout(
  document: WorkoutDocument,
  accessRevision: number,
  operationId: string,
  createdAt: string,
): Promise<WorkoutDocument> {
  if (document.problem || hasPendingWorkoutOperation(document)) return document
  const correctionProblem = firstCorrectionProblem(document)
  if (correctionProblem) throw new Error(correctionProblem)
  if (
    document.accepted &&
    canonicalJson(document.content) === canonicalJson(document.accepted.content)
  )
    return document
  const predecessor = document.accepted
  const payload: SaveWorkout = {
    id: document.id,
    origin: structuredClone(document.origin),
    content: structuredClone(document.content),
    operationId,
    expectedRevision: document.accepted?.revision ?? 0,
  }
  const operation = OutboxEntrySchema.parse({
    schemaVersion: 2,
    accountId: document.scope.accountId,
    branchId: document.scope.branchId,
    actorId: document.scope.actorId,
    accessRevision,
    operationId,
    predecessorOperationId: predecessor?.operationId ?? null,
    requestHash: await workoutRequestHash(document.scope, payload),
    payload,
    state: 'queued',
    createdAt,
    receipt: null,
  })
  return {
    ...document,
    operations: [...document.operations, operation],
    replayAccessRevision: accessRevision,
  }
}
/** One scoped runner; requests may settle after cancellation but cannot touch local state. */
export class WorkoutSync {
  private controller = new AbortController()
  private running = false
  private store: WorkoutStore
  private scope: WorkoutScope
  private transport: WorkoutTransport
  private integrationAccepted: boolean
  constructor(
    store: WorkoutStore,
    scope: WorkoutScope,
    transport: WorkoutTransport,
    integrationAccepted = false,
  ) {
    this.store = store
    this.scope = scope
    this.transport = transport
    this.integrationAccepted = integrationAccepted
  }
  cancel() {
    this.controller.abort()
  }
  private live() {
    if (this.controller.signal.aborted)
      throw new DOMException('Departed workout context', 'AbortError')
  }
  async replay(key: string): Promise<void> {
    if (this.running || !this.integrationAccepted || this.controller.signal.aborted) return
    this.running = true
    try {
      const document = await this.store.read(key)
      this.live()
      if (!document || !sameScope(document.scope, this.scope) || document.problem) return
      const operation = document.operations.find(
        (op) =>
          !document.supersededOperationIds.includes(op.operationId) &&
          (op.state === 'queued' || op.state === 'sending'),
      )
      if (!operation) return
      const update = async (change: (d: WorkoutDocument) => WorkoutDocument) => {
        this.live()
        // A concurrent edit is preserved; CAS retries only this delivery metadata update.
        for (let attempt = 0; attempt < 5; attempt++) {
          const latest = await this.store.read(key)
          this.live()
          if (!latest || !sameScope(latest.scope, this.scope)) return
          const next = change(latest)
          try {
            await this.store.compareAndSet(
              { ...next, generation: latest.generation + 1 },
              latest.generation,
            )
            return
          } catch (e) {
            if (!(e instanceof Error) || e.name !== 'LocalWorkoutConflict' || attempt === 4) throw e
          }
        }
      }
      try {
        const access = await this.transport.access(this.controller.signal)
        this.live()
        if (
          !canEditWorkout(this.scope, access) ||
          access.accessRevision !== document.replayAccessRevision
        ) {
          await update((d) => ({
            ...d,
            problem: {
              kind: 'blocked',
              message:
                'El acceso cambió. Conservamos tu trabajo. Revisá el acceso antes de reintentar.',
            },
            operations: d.operations.map((op) =>
              op.operationId === operation.operationId ? { ...op, state: 'access-revoked' } : op,
            ),
          }))
          return
        }
        if (
          operation.payload.origin.kind === 'legacy' &&
          operation.payload.origin.executionId !== null &&
          operation.payload.expectedRevision === 0 &&
          !operation.payload.content.correctionReason.trim()
        )
          throw Object.assign(
            new Error('La primera corrección requiere un motivo. Conservamos el envío original.'),
            { status: 400, code: 'INVALID_INPUT' },
          )
        if ((await workoutRequestHash(this.scope, operation.payload)) !== operation.requestHash)
          throw new Error('Local immutable operation hash mismatch')
        this.live()
        await update((d) => ({
          ...d,
          operations: d.operations.map((op) =>
            op.operationId === operation.operationId ? { ...op, state: 'sending' } : op,
          ),
        }))
        const result = checkedReceipt(
          await this.transport.save(structuredClone(operation.payload), this.controller.signal),
        )
        this.live()
        if (
          result.receipt.operationId !== operation.operationId ||
          result.receipt.requestHash !== operation.requestHash ||
          result.receipt.resourceId !== document.id ||
          result.receipt.revision !== operation.payload.expectedRevision + 1 ||
          result.session.id !== document.id ||
          result.session.operationId !== operation.operationId ||
          result.session.revision !== result.receipt.revision ||
          result.session.actorId !== this.scope.actorId ||
          result.session.scope.memberId !== this.scope.actorId ||
          result.session.scope.branchId !== this.scope.branchId ||
          result.session.scope.organizationId !== this.scope.organizationId ||
          canonicalJson(result.session.content) !== canonicalJson(operation.payload.content) ||
          canonicalJson(result.session.origin) !== canonicalJson(operation.payload.origin)
        )
          throw new Error('Server receipt does not match this immutable operation')
        await update((d) => ({
          ...d,
          accepted:
            !d.accepted || d.accepted.revision < result.session.revision
              ? result.session
              : d.accepted,
          operations: d.operations.map((op) =>
            op.operationId === operation.operationId
              ? { ...op, state: 'accepted', receipt: result.receipt }
              : op,
          ),
        }))
      } catch (failure) {
        this.live()
        const error = failure as WorkoutFailure
        const blocked =
          error.status === 401 ||
          error.status === 403 ||
          [
            'CONTEXT_REVOKED',
            'MEMBERSHIP_REQUIRED',
            'PRODUCT_NOT_ACTIVE',
            'UPGRADE_REQUIRED',
          ].includes(error.code ?? '')
        const conflict = ['REVISION_CONFLICT', 'OPERATION_CONFLICT'].includes(error.code ?? '')
        const unavailable =
          error.code === 'INVALID_INPUT' && error.issues?.some((i) => i.code === 'unavailable')
        const invalid =
          error.status !== undefined &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408 &&
          error.status !== 429
        if (blocked || conflict || invalid)
          await update((d) => ({
            ...d,
            problem: {
              kind: blocked
                ? 'blocked'
                : conflict
                  ? 'conflict'
                  : unavailable
                    ? 'unavailable'
                    : 'invalid',
              message: error.message ?? 'Revisá el envío. Tu trabajo está conservado.',
            },
            operations: d.operations.map((op) =>
              op.operationId === operation.operationId
                ? { ...op, state: blocked ? 'access-revoked' : 'conflict' }
                : op,
            ),
          }))
        else throw failure // Delivery uncertain: retain exact sending payload for replay.
      }
    } finally {
      this.running = false
    }
  }
}
/** Only an explicit recovery choice can replace a conflicting operation. */
export function resolveWorkoutConflict(
  document: WorkoutDocument,
  remote: SessionRevision,
  choice: 'server' | 'local',
): WorkoutDocument {
  remote = SessionRevisionSchema.parse(remote)
  if (
    remote.revision < (document.accepted?.revision ?? 0) ||
    remote.id !== document.id ||
    remote.scope.organizationId !== document.scope.organizationId ||
    remote.scope.branchId !== document.scope.branchId ||
    remote.scope.memberId !== document.scope.actorId ||
    canonicalJson(remote.origin) !== canonicalJson(document.origin)
  )
    throw new Error('Foreign conflict revision')
  return {
    ...document,
    accepted: structuredClone(remote),
    content: structuredClone(choice === 'server' ? remote.content : document.content),
    recovery: [...document.recovery, structuredClone(document.content)],
    supersededOperationIds: [
      ...new Set([
        ...document.supersededOperationIds,
        ...document.operations.filter((op) => op.state !== 'accepted').map((op) => op.operationId),
      ]),
    ],
    problem: null,
  }
}
export function reviseRejectedWorkout(document: WorkoutDocument): WorkoutDocument {
  if (!document.problem || !['invalid', 'unavailable'].includes(document.problem.kind))
    throw new Error('Only definitive input rejection can be replaced without a server revision')
  return {
    ...document,
    recovery: [...document.recovery, structuredClone(document.content)],
    supersededOperationIds: [
      ...new Set([
        ...document.supersededOperationIds,
        ...document.operations.filter((op) => op.state === 'conflict').map((op) => op.operationId),
      ]),
    ],
    problem: null,
  }
}
export function ownerWorkoutExport(
  document: WorkoutDocument,
  signedIn: Pick<WorkoutScope, 'accountId' | 'actorId'>,
): string {
  if (
    document.scope.accountId !== signedIn.accountId ||
    document.scope.actorId !== signedIn.actorId ||
    signedIn.accountId !== signedIn.actorId
  )
    throw new Error('Owner identity required')
  return JSON.stringify(
    {
      format: 'klisteniapp.local-workout-recovery',
      version: 2,
      serverConfirmed: false,
      warning: 'Local work and operation delivery state; separate from the server export.',
      workout: document,
    },
    null,
    2,
  )
}
export function editedContent(content: SessionContent): SessionContent {
  return {
    ...content,
    status: content.sets.length ? 'partial' : 'draft',
    explicitCompletion: false,
  }
}
