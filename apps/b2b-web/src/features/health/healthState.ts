import { createClientId } from '@klisteniapp/b2b-client'
import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import {
  HealthCategorySchema,
  type HealthCategory,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { canReadTrainerHealth, hasHealthCapability, type HealthAccess } from './healthAccess.ts'
import { healthClient } from './healthClient.ts'

export const healthCategories = HealthCategorySchema.options
export const healthCategoryLabels: Record<HealthCategory, string> = {
  measurements: 'Medidas',
  sleep: 'Sueño',
  activity: 'Actividad',
  nutrition: 'Alimentación',
  supplements: 'Suplementos',
}
export type ImportPreview = ProductOutput<'previewHealthImport'>
type OwnHealth = ProductOutput<'ownHealth'>
type Consent = ProductOutput<'grantHealthConsent'>
type Projection = ProductOutput<'consentedHealth'>
type ImportRequest = ProductInput<'previewHealthImport'>

export type HealthState = {
  status: 'hidden' | 'loading' | 'ready' | 'error'
  message: string
  own: OwnHealth | null
  consents: Consent[]
  trainer: Projection | null
  importStatus: 'idle' | 'reading' | 'previewing' | 'preview' | 'applying' | 'applied'
  preview: ImportPreview | null
  retryImport: boolean
}
const emptyState = (): HealthState => ({
  status: 'hidden',
  message: '',
  own: null,
  consents: [],
  trainer: null,
  importStatus: 'idle',
  preview: null,
  retryImport: false,
})

export function previewIsConfirmable(preview: ImportPreview, now: number): boolean {
  return (
    preview.issues.length === 0 &&
    preview.conflicts.length === 0 &&
    Date.parse(preview.expiresAt) > now
  )
}

/** Envelope recognition only; all record semantics, deduplication and conflicts
 * remain with the frozen API parser. Source labels do not imply vendor support. */
export function recognizeHealthFile(name: string, size: number, raw?: string): void {
  if (!name.toLowerCase().endsWith('.json'))
    throw new Error('Solo se admite JSON klisteniapp.health v1. CSV y ZIP no son compatibles.')
  if (
    size > 2 * 1024 * 1024 ||
    (raw !== undefined && new TextEncoder().encode(raw).byteLength > 2 * 1024 * 1024)
  )
    throw new Error('El archivo supera el límite de 2 MiB. No se importó ningún registro.')
  if (raw === undefined) return
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('El archivo no es JSON válido. No se importó ningún registro.')
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('format' in value) ||
    value.format !== 'klisteniapp.health' ||
    !('version' in value) ||
    value.version !== 1
  )
    throw new Error('Formato o versión no compatible. Solo se admite klisteniapp.health v1.')
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONSENT_REQUIRED') return 'No hay consentimiento vigente para esta sede.'
    if (error.code === 'REVISION_CONFLICT' || error.status === 409)
      return 'Los datos cambiaron. Actualizá y revisá una nueva vista previa antes de confirmar.'
    if (error.status === 401 || error.status === 403)
      return 'El acceso cambió. Volvé a validar tu sesión y la sede seleccionada.'
    if (error.code === 'INVALID_INPUT' || error.code === 'UNSUPPORTED_FORMAT')
      return 'El archivo o la vista previa ya no es válido. Actualizá y volvé a revisarlo.'
    return 'No se pudo confirmar la operación. Revisá la conexión y actualizá el estado.'
  }
  return 'No se pudo completar la operación. Actualizá el estado antes de continuar.'
}

/** One controller per immutable shell context and target. Epoch checks protect
 * against fetch/file readers that ignore abort; cancellation alone is insufficient. */
export class HealthController {
  readonly context: HealthAccess
  private state = emptyState()
  private listeners = new Set<() => void>()
  private epoch = 0
  private pending: AbortController | null = null
  private importRequest: ImportRequest | null = null
  private connected = false
  private visible = false
  private abortContext = () => this.hide('El acceso cambió. Volvé a validar la sesión.')
  private client: (signal: AbortSignal) => ProductV2Client
  private now: () => number
  private id: () => string
  private invalidateViews: () => void

  constructor(
    context: HealthAccess,
    options: {
      client?: (signal: AbortSignal) => ProductV2Client
      now?: () => number
      id?: () => string
      invalidateViews?: () => void
    } = {},
  ) {
    this.context = context
    this.client = options.client ?? ((signal) => healthClient(context, signal))
    this.now = options.now ?? Date.now
    this.id = options.id ?? (() => createClientId())
    this.invalidateViews = options.invalidateViews ?? (() => {})
  }

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(patch: Partial<HealthState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private cancel() {
    this.epoch++
    this.pending?.abort()
    this.pending = null
  }
  hide(message = 'Los datos están ocultos hasta validar el acceso en línea.') {
    this.cancel()
    this.importRequest = null
    this.state = { ...emptyState(), message }
    for (const listener of this.listeners) listener()
  }
  start() {
    this.context.signal.addEventListener('abort', this.abortContext)
    if (this.context.signal.aborted) this.abortContext()
  }
  stop() {
    this.context.signal.removeEventListener('abort', this.abortContext)
    this.hide()
  }
  setEnvironment(online: boolean, visible: boolean) {
    this.connected = online
    this.visible = visible
    if (!online || !visible) this.hide()
  }
  private allowed(trainer = false) {
    return (
      this.connected &&
      this.visible &&
      (trainer
        ? canReadTrainerHealth(this.context)
        : hasHealthCapability(this.context, 'manage-own-health'))
    )
  }
  private begin(trainer = false) {
    if (!this.allowed(trainer)) {
      this.hide()
      return null
    }
    this.cancel()
    const controller = new AbortController()
    this.pending = controller
    return { epoch: this.epoch, client: this.client(controller.signal) }
  }
  private current(epoch: number, trainer = false) {
    return epoch === this.epoch && this.allowed(trainer)
  }
  private ownMatches(own: OwnHealth) {
    return own.ownerId === this.context.accountId
  }
  private consentMatches(consent: Consent) {
    return (
      consent.ownerId === this.context.accountId &&
      consent.scope.organizationId === this.context.organizationId
    )
  }
  selectedConsent(): Consent | undefined {
    return this.state.consents.find(
      (c) => c.scope.branchId === this.context.branchId && c.status === 'active',
    )
  }

  async loadOwner() {
    const task = this.begin()
    if (!task) return
    this.importRequest = null
    this.set({ ...emptyState(), status: 'loading' })
    try {
      const [own, consents] = await Promise.all([
        task.client.call('ownHealth', {}),
        task.client.call('healthConsents', {}),
      ])
      if (!this.current(task.epoch)) return
      if (!this.ownMatches(own) || !consents.every((c) => this.consentMatches(c)))
        throw new Error('Scope mismatch')
      this.set({ status: 'ready', own, consents })
    } catch (error) {
      if (this.current(task.epoch)) this.set({ status: 'error', message: failureMessage(error) })
    }
  }

  async loadTrainer(memberId: string) {
    const task = this.begin(true)
    if (!task) return
    // Clear before every revalidation, including periodic checks and reconnect.
    this.set({ ...emptyState(), status: 'loading' })
    try {
      const trainer = await task.client.call('consentedHealth', { memberId })
      if (!this.current(task.epoch, true)) return
      if (
        trainer.ownerId !== memberId ||
        trainer.scope.organizationId !== this.context.organizationId ||
        trainer.scope.branchId !== this.context.branchId
      )
        throw new Error('Scope mismatch')
      this.set({ status: 'ready', trainer })
    } catch (error) {
      if (this.current(task.epoch, true))
        this.set({ status: 'error', message: failureMessage(error), trainer: null })
    }
  }

  async previewFile(file: Pick<File, 'name' | 'size' | 'text'>) {
    const own = this.state.own
    if (!own || this.state.status !== 'ready') return
    const task = this.begin()
    if (!task) return
    this.importRequest = null
    this.set({ importStatus: 'reading', preview: null, retryImport: false, message: '' })
    try {
      recognizeHealthFile(file.name, file.size)
      const raw = await file.text()
      if (!this.current(task.epoch)) return
      recognizeHealthFile(file.name, file.size, raw)
      const request: ImportRequest = {
        operationId: this.id(),
        expectedRevision: own.revision,
        format: 'klisteniapp.health',
        version: 1,
        raw,
      }
      this.set({ importStatus: 'previewing' })
      const preview = await task.client.call('previewHealthImport', request)
      if (!this.current(task.epoch)) return
      if (preview.expectedRevision !== own.revision) throw new Error('Revision mismatch')
      this.importRequest = request
      this.set({ importStatus: 'preview', preview })
    } catch (error) {
      if (!this.current(task.epoch)) return
      this.set({
        importStatus: 'idle',
        message:
          error instanceof ApiError
            ? failureMessage(error)
            : error instanceof Error
              ? error.message
              : 'No se pudo leer el archivo.',
      })
    }
  }

  canConfirmImport() {
    return (
      this.allowed() &&
      this.state.importStatus === 'preview' &&
      this.importRequest !== null &&
      this.state.preview !== null &&
      (this.state.retryImport || previewIsConfirmable(this.state.preview, this.now()))
    )
  }
  async confirmImport() {
    if (!this.canConfirmImport()) return
    const request = this.importRequest!
    const preview = this.state.preview!
    const task = this.begin()
    if (!task) return
    this.set({ importStatus: 'applying', message: '' })
    try {
      const own = await task.client.call('applyHealthImport', {
        ...request,
        previewHash: preview.previewHash,
      })
      if (!this.current(task.epoch)) return
      if (!this.ownMatches(own)) throw new Error('Scope mismatch')
      this.importRequest = null
      this.set({
        own,
        importStatus: 'applied',
        preview: null,
        retryImport: false,
        message: 'Importación confirmada. Compartir requiere una autorización separada.',
      })
    } catch (error) {
      if (!this.current(task.epoch)) return
      // Retry the exact operation after uncertain delivery, even after expiry;
      // WP05's durable receipt resolves acceptance without duplicating records.
      const retry = error instanceof ApiError && error.status === 0
      if (!retry) this.importRequest = null
      this.set({
        importStatus: retry ? 'preview' : 'idle',
        preview: retry ? preview : null,
        retryImport: retry,
        message: failureMessage(error),
      })
    }
  }

  async grant(categories: HealthCategory[], acknowledged: boolean) {
    if (
      !acknowledged ||
      this.state.status !== 'ready' ||
      !categories.length ||
      new Set(categories).size !== categories.length ||
      !categories.every((c) => healthCategories.includes(c))
    )
      return
    const consent = this.selectedConsent()
    await this.changeConsent((client) =>
      client.call('grantHealthConsent', {
        operationId: this.id(),
        expectedRevision: consent?.revision ?? 0,
        id: consent?.id ?? this.id(),
        categories: [...categories],
        audience: 'current-authorized-branch-trainers',
        disclosureVersion: 1,
      }),
    )
  }
  async revoke() {
    const consent = this.selectedConsent()
    if (!consent || this.state.status !== 'ready') return
    await this.changeConsent((client) =>
      client.call('revokeHealthConsent', {
        operationId: this.id(),
        expectedRevision: consent.revision,
        id: consent.id,
      }),
    )
  }
  private async changeConsent(change: (client: ProductV2Client) => Promise<Consent>) {
    const task = this.begin()
    if (!task) return
    this.invalidateViews()
    this.importRequest = null
    this.set({ ...emptyState(), status: 'loading' })
    try {
      const consent = await change(task.client)
      if (!this.current(task.epoch)) return
      if (!this.consentMatches(consent) || consent.scope.branchId !== this.context.branchId)
        throw new Error('Scope mismatch')
      this.invalidateViews()
      await this.loadOwner()
    } catch (error) {
      if (this.current(task.epoch))
        this.set({
          status: 'error',
          message: `${failureMessage(error)} No se confirmó el cambio de consentimiento.`,
        })
    }
  }
}
