import { createClientId } from '@klisteniapp/b2b-client'
import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductInput, ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import {
  peopleContextAllowed,
  peopleError,
  type PeopleContext,
  type Person,
} from './peopleModel.ts'
import {
  scopedInvitationBranches,
  invitationError,
  type InvitationBranch,
  type InvitationGrant,
} from './invitationGrants.ts'
import { canManagePerson, creatableRoles } from './peopleCapabilities.ts'

type Pending =
  | { kind: 'updateMember'; input: ProductInput<'updateMember'> }
  | { kind: 'inviteMember'; input: ProductInput<'inviteMember'> }
export type PeopleState = {
  people: Person[]
  loading: boolean
  busy: boolean
  error: string
  message: string
  blocked: boolean
  retry: boolean
  refresh: boolean
  invitation: ProductOutput<'inviteMember'> | null
  invitationGrants: InvitationGrant[] | null
  branches: InvitationBranch[]
  branchesLoading: boolean
  branchesValid: boolean
  branchesError: string
}
/** Scoped in-memory operations only. A failed transport freezes the exact payload
 * until explicit retry; there is no background replay or cross-identity storage. */
export class PeopleController {
  private state: PeopleState = {
    people: [],
    loading: false,
    busy: false,
    error: '',
    message: '',
    blocked: false,
    retry: false,
    refresh: false,
    invitation: null,
    invitationGrants: null,
    branches: [],
    branchesLoading: false,
    branchesValid: false,
    branchesError: '',
  }
  private listeners = new Set<() => void>()
  private lifetime = new AbortController()
  private read: AbortController | null = null
  private branchRead: AbortController | null = null
  private readBranches: (signal: AbortSignal) => Promise<ProductOutput<'invitationBranches'>>
  private pending: Pending | null = null
  private epoch = 0
  readonly context: PeopleContext
  private createClient: (signal?: AbortSignal) => ProductV2Client
  constructor(
    context: PeopleContext,
    createClient: (signal?: AbortSignal) => ProductV2Client,
    readBranches?: (signal: AbortSignal) => Promise<ProductOutput<'invitationBranches'>>,
  ) {
    this.readBranches =
      readBranches ?? ((signal) => createClient(signal).call('invitationBranches', {}))
    this.context = context
    this.createClient = createClient
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(patch: Partial<PeopleState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  connect() {
    this.lifetime = new AbortController()
    const abort = () => this.clear()
    this.context.signal.addEventListener('abort', abort, { once: true })
    return () => {
      this.context.signal.removeEventListener('abort', abort)
      this.clear()
    }
  }
  private current(epoch: number) {
    return (
      epoch === this.epoch && !this.lifetime.signal.aborted && peopleContextAllowed(this.context)
    )
  }
  private signal(signal?: AbortSignal) {
    const network = this.context.requestSignal?.()
    return AbortSignal.any([
      this.context.signal,
      this.lifetime.signal,
      ...(network ? [network] : []),
      ...(signal ? [signal] : []),
    ])
  }
  clear() {
    this.epoch++
    this.lifetime.abort()
    this.read?.abort()
    this.branchRead?.abort()
    this.pending = null
    this.set({
      people: [],
      invitation: null,
      invitationGrants: null,
      error: '',
      message: '',
      loading: false,
      busy: false,
      retry: false,
      refresh: false,
      blocked: true,
      branches: [],
      branchesValid: false,
      branchesLoading: false,
      branchesError: '',
    })
  }
  suspend() {
    this.epoch++
    this.lifetime.abort()
    this.read?.abort()
    this.set({
      people: [],
      invitation: null,
      invitationGrants: null,
      loading: false,
      busy: false,
      blocked: true,
      retry: Boolean(this.pending),
      branches: [],
      branchesValid: false,
      branchesLoading: false,
      branchesError: '',
      message: '',
      error: 'La conexión de acceso se interrumpió. Volvé a validar antes de continuar.',
    })
  }
  async load() {
    if (!peopleContextAllowed(this.context)) {
      this.clear()
      return
    }
    if (this.lifetime.signal.aborted) this.lifetime = new AbortController()
    this.read?.abort()
    this.read = new AbortController()
    const epoch = this.epoch,
      read = this.read
    this.set({ loading: true, error: '', message: '', refresh: false })
    try {
      const signal = this.signal(read.signal)
      const people = await this.createClient(signal).call('people', {})
      if (this.current(epoch) && !signal.aborted && this.read === read) {
        this.set({ people, blocked: false })
        await this.loadBranches()
      }
    } catch (error) {
      if (this.current(epoch) && this.read === read) {
        const failure = peopleError(error)
        this.set({
          error: failure.uncertain
            ? 'No pudimos validar la lista. Comprobá la conexión y recargá.'
            : failure.message,
          people: [],
          invitation: null,
          invitationGrants: null,
          blocked: true,
          branches: [],
          branchesValid: false,
          branchesLoading: false,
        })
      }
    } finally {
      if (this.current(epoch) && this.read === read) this.set({ loading: false })
    }
  }
  async loadBranches() {
    if (
      !this.context.access ||
      !creatableRoles(this.context.access).length ||
      !peopleContextAllowed(this.context)
    )
      return
    this.branchRead?.abort()
    const request = new AbortController()
    this.branchRead = request
    const epoch = this.epoch
    this.set({ branchesLoading: true, branchesError: '', branchesValid: false })
    try {
      const signal = this.signal(request.signal)
      const options = scopedInvitationBranches(this.context, await this.readBranches(signal))
      if (this.current(epoch) && !signal.aborted && this.branchRead === request)
        this.set({ branches: options, branchesValid: true })
    } catch (error) {
      if (this.current(epoch) && this.branchRead === request) {
        const failure = peopleError(error)
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          this.clear()
          this.set({ error: failure.message, branchesError: failure.message, refresh: true })
        } else this.set({ branches: [], branchesValid: false, branchesError: failure.message })
      }
    } finally {
      if (this.current(epoch) && this.branchRead === request) this.set({ branchesLoading: false })
    }
  }
  async update(input: Omit<ProductInput<'updateMember'>, 'operationId'>): Promise<Person | null> {
    const target = this.state.people.find((person) => person.userId === input.memberId)
    const access = this.context.access
    if (
      !access ||
      !target ||
      !canManagePerson(access, target) ||
      (input.role && !creatableRoles(access).includes(input.role))
    )
      return null
    if (this.state.busy || this.pending || this.state.blocked) return null
    this.pending = {
      kind: 'updateMember',
      input: structuredClone({ ...input, operationId: createClientId() }),
    }
    return (await this.send()) as Person | null
  }
  async invite(input: ProductInput<'inviteMember'>) {
    if (
      this.state.busy ||
      this.pending ||
      this.state.blocked ||
      !this.context.access ||
      !creatableRoles(this.context.access).includes(input.role)
    )
      return null
    this.pending = { kind: 'inviteMember', input: structuredClone(input) }
    return (await this.send()) as ProductOutput<'inviteMember'> | null
  }
  retry = () => this.send()
  dismissInvitation = () => this.set({ invitation: null, invitationGrants: null })
  private async send(): Promise<Person | ProductOutput<'inviteMember'> | null> {
    if (!this.pending || this.state.busy || !peopleContextAllowed(this.context)) return null
    const pending = this.pending,
      epoch = this.epoch
    this.set({ busy: true, retry: false, error: '', message: '', refresh: false })
    try {
      const signal = this.signal()
      const client = this.createClient(signal)
      const result =
        pending.kind === 'updateMember'
          ? await client.call('updateMember', pending.input)
          : await client.call('inviteMember', pending.input)
      if (!this.current(epoch) || signal.aborted) return null
      this.pending = null
      if (pending.kind === 'inviteMember')
        this.set({
          invitation: result as ProductOutput<'inviteMember'>,
          invitationGrants: pending.input.branchGrants.map((grant) => ({ ...grant })),
          message: 'Invitación creada. Compartí el enlace solo con la persona indicada.',
        })
      else {
        const member = result as Person
        this.set({
          people: this.state.people.map((p) => (p.userId === member.userId ? member : p)),
          message:
            'Acceso actualizado. Los permisos revocados y el consentimiento no se restauran automáticamente.',
        })
      }
      return result
    } catch (error) {
      if (this.current(epoch)) {
        const failure =
          pending.kind === 'inviteMember' ? invitationError(error) : peopleError(error)
        if (!failure.uncertain) this.pending = null
        const lostAccess = error instanceof ApiError && [401, 403].includes(error.status)
        this.set({
          error: failure.message,
          retry: failure.uncertain,
          refresh: failure.refresh,
          ...(lostAccess
            ? {
                people: [],
                invitation: null,
                invitationGrants: null,
                blocked: true,
                branches: [],
                branchesValid: false,
                branchesLoading: false,
              }
            : {}),
        })
      }
      return null
    } finally {
      if (this.current(epoch)) this.set({ busy: false })
    }
  }
}
