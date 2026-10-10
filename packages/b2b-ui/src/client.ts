import {
  B2BResponseSchemas as responses, AcceptInvitationSchema, BrandInputSchema, CoachAssignmentSchema,
  ExerciseInputSchema, ExerciseUpdateSchema, ExecutionInputSchema, InvitationInputSchema,
  MachineInputSchema, MachineUpdateSchema, MediaUploadSchema, MembershipUpdateSchema, ProgramAssignmentSchema,
  ProgramInputSchema, ProgramUpdateSchema, PublishSchema, UnitInputSchema, UnitUpdateSchema, UnitBatchSchema,
  WebsiteUpdateSchema, type B2BInputs,
} from '@klisteniapp/b2b-contracts'

/** Parsers, rather than caller-selected response types, define the HTTP boundary. */
type Parser<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown } }
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status: number, code = 'REQUEST_FAILED') {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code
  }
}
export type ClientOptions = {
  fetch?: typeof fetch
  timeoutMs?: number
  uploadTimeoutMs?: number
  onAuthChange?: () => void
}
function broadcastAuthChange() {
  try { localStorage.setItem('klisteni.b2b.auth-change', crypto.randomUUID()) } catch { /* Channel remains independent of storage availability. */ }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('klisteni.b2b.auth'); channel.postMessage('changed'); channel.close()
  }
}
function errorDetails(value: unknown): { message?: string; code?: string } {
  if (!value || typeof value !== 'object') return {}
  const message = 'message' in value && typeof value.message === 'string' ? value.message : 'error' in value && typeof value.error === 'string' ? value.error : undefined
  const code = 'code' in value && typeof value.code === 'string' ? value.code : undefined
  return { message, code }
}
function input<T>(schema: Parser<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new ApiError('Revisá los campos de la solicitud.', 400, 'INVALID_INPUT')
  return parsed.data
}
const segment = (value: string) => encodeURIComponent(value)
const orgPath = (orgId: string, route: string) => `/orgs/${segment(orgId)}${route}`
const memberQuery = (memberId?: string) => memberId ? `?memberId=${segment(memberId)}` : ''

/** Bound instances keep the originating account on every request, including delayed writes. */
export function createB2BClient(accountId?: string, options: ClientOptions = {}) {
  async function request<T>(path: string, schema: Parser<T>, method = 'GET', body?: unknown): Promise<T> {
    const controller = new AbortController()
    const binary = body instanceof Blob
    const timeout = setTimeout(() => controller.abort(), binary ? options.uploadTimeoutMs ?? 120_000 : options.timeoutMs ?? 20_000)
    try {
      const response = await (options.fetch ?? fetch)(`/api/b2b${path}`, {
        method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', ...(accountId ? { 'X-Klisteni-B2B-Account': accountId } : {}), ...(body === undefined ? {} : { 'Content-Type': binary ? body.type || 'application/octet-stream' : 'application/json' }) },
        ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
      })
      let result: unknown
      if (response.status !== 204) {
        try { result = await response.json() }
        catch (error) {
          // Keep a known HTTP rejection even if its body is unreadable: 401/403
          // must still clear protected UI state. Interrupted successful responses
          // are transport failures and retain the same retry behavior as fetch.
          if (response.ok && (controller.signal.aborted || !(error instanceof SyntaxError))) throw error
        }
      }
      if (!response.ok) {
        const error = errorDetails(result)
        throw new ApiError(error.message ?? (response.status === 401 ? 'Iniciá sesión para continuar.' : 'No pudimos completar la solicitud.'), response.status, error.code)
      }
      // A successful auth operation has changed cookies even if its payload is malformed.
      if (path === '/auth/sign-in/email' || path === '/auth/sign-out') (options.onAuthChange ?? broadcastAuthChange)()
      const parsed = schema.safeParse(result)
      if (!parsed.success) throw new ApiError('El servicio devolvió datos incompatibles. Actualizá la página; tus cambios sin enviar se conservan.', 502, 'INVALID_RESPONSE')
      return parsed.data
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(controller.signal.aborted ? 'La solicitud tardó demasiado. Tus cambios sin enviar se conservan en pantalla.' : 'No pudimos conectar con el gimnasio. Tus cambios sin enviar se conservan en pantalla.', 0, controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR')
    } finally { clearTimeout(timeout) }
  }
  return {
    me: () => request('/me', responses.me),
    auth: {
      signIn: (body: B2BInputs['signIn']) => request('/auth/sign-in/email', responses.signIn, 'POST', body),
      signOut: () => request('/auth/sign-out', responses.signOut, 'POST', {}),
    },
    public: {
      site: (slug: string) => request(`/public/${segment(slug)}`, responses.publicSite),
      unit: (slug: string, unitId: string) => request(`/public/${segment(slug)}/units/${segment(unitId)}`, responses.publicUnit),
    },
    invitations: {
      accept: (body: B2BInputs['acceptInvitation']) => request('/invitations/accept', responses.ok, 'POST', input(AcceptInvitationSchema, body)),
      join: (body: { token: string }) => request('/invitations/join', responses.ok, 'POST', body),
    },
    members: {
      list: (orgId: string) => request(orgPath(orgId, '/members'), responses.members),
      update: (orgId: string, userId: string, body: B2BInputs['membership']) => request(orgPath(orgId, `/members/${segment(userId)}`), responses.ok, 'PATCH', input(MembershipUpdateSchema, body)),
      assignCoach: (orgId: string, body: B2BInputs['coachAssignment']) => request(orgPath(orgId, '/coach-assignments'), responses.ok, 'POST', input(CoachAssignmentSchema, body)),
      invite: (orgId: string, body: B2BInputs['invitation']) => request(orgPath(orgId, '/invitations'), responses.invitation, 'POST', input(InvitationInputSchema, body)),
    },
    brand: { update: (orgId: string, body: B2BInputs['brand']) => request(orgPath(orgId, '/brand'), responses.organization, 'PUT', input(BrandInputSchema, body)) },
    catalog: {
      listExercises: (orgId: string) => request(orgPath(orgId, '/exercises'), responses.exercises),
      createExercise: (orgId: string, body: B2BInputs['exercise']) => request(orgPath(orgId, '/exercises'), responses.exercise, 'POST', input(ExerciseInputSchema, body)),
      updateExercise: (orgId: string, id: string, body: B2BInputs['exerciseUpdate']) => request(orgPath(orgId, `/exercises/${segment(id)}`), responses.exercise, 'PUT', input(ExerciseUpdateSchema, body)),
      reviewExercise: (orgId: string, id: string, body: B2BInputs['revision']) => request(orgPath(orgId, `/exercises/${segment(id)}/review`), responses.exercise, 'POST', input(PublishSchema, body)),
      publishExercise: (orgId: string, id: string, body: B2BInputs['revision']) => request(orgPath(orgId, `/exercises/${segment(id)}/publish`), responses.exercise, 'POST', input(PublishSchema, body)),
    },
    equipment: {
      listMachines: (orgId: string) => request(orgPath(orgId, '/machines'), responses.machines),
      createMachine: (orgId: string, body: B2BInputs['machine']) => request(orgPath(orgId, '/machines'), responses.machine, 'POST', input(MachineInputSchema, body)),
      updateMachine: (orgId: string, id: string, body: B2BInputs['machineUpdate']) => request(orgPath(orgId, `/machines/${segment(id)}`), responses.machine, 'PUT', input(MachineUpdateSchema, body)),
      reviewMachine: (orgId: string, id: string, body: B2BInputs['revision']) => request(orgPath(orgId, `/machines/${segment(id)}/review`), responses.machine, 'POST', input(PublishSchema, body)),
      publishMachine: (orgId: string, id: string, body: B2BInputs['revision']) => request(orgPath(orgId, `/machines/${segment(id)}/publish`), responses.machine, 'POST', input(PublishSchema, body)),
      listUnits: (orgId: string) => request(orgPath(orgId, '/units'), responses.units),
      createUnit: (orgId: string, body: B2BInputs['unit']) => request(orgPath(orgId, '/units'), responses.unit, 'POST', input(UnitInputSchema, body)),
      updateUnit: (orgId: string, id: string, body: B2BInputs['unitUpdate']) => request(orgPath(orgId, `/units/${segment(id)}`), responses.unit, 'PUT', input(UnitUpdateSchema, body)),
      createUnitsBatch: (orgId: string, body: B2BInputs['unitBatch']) => request(orgPath(orgId, '/units/batch'), responses.units, 'POST', input(UnitBatchSchema, body)),
    },
    programs: {
      list: (orgId: string) => request(orgPath(orgId, '/programs'), responses.programs),
      create: (orgId: string, body: B2BInputs['program']) => request(orgPath(orgId, '/programs'), responses.program, 'POST', input(ProgramInputSchema, body)),
      update: (orgId: string, id: string, body: B2BInputs['programUpdate']) => request(orgPath(orgId, `/programs/${segment(id)}`), responses.program, 'PUT', input(ProgramUpdateSchema, body)),
      publish: (orgId: string, id: string, body: B2BInputs['revision']) => request(orgPath(orgId, `/programs/${segment(id)}/publish`), responses.programVersion, 'POST', input(PublishSchema, body)),
      version: (orgId: string, id: string, version: number) => request(orgPath(orgId, `/programs/${segment(id)}/versions/${version}`), responses.programVersion),
    },
    assignments: {
      list: (orgId: string, memberId?: string) => request(orgPath(orgId, `/assignments${memberQuery(memberId)}`), responses.assignments),
      create: (orgId: string, body: B2BInputs['assignment']) => request(orgPath(orgId, '/assignments'), responses.assignment, 'POST', input(ProgramAssignmentSchema, body)),
    },
    executions: {
      list: (orgId: string, memberId?: string) => request(orgPath(orgId, `/executions${memberQuery(memberId)}`), responses.executions),
      create: (orgId: string, body: B2BInputs['execution']) => request(orgPath(orgId, '/executions'), responses.execution, 'POST', input(ExecutionInputSchema, body)),
    },
    reports: { get: (orgId: string) => request(orgPath(orgId, '/reports'), responses.report) },
    website: {
      get: (orgId: string) => request(orgPath(orgId, '/website'), responses.website),
      update: (orgId: string, body: B2BInputs['website']) => request(orgPath(orgId, '/website'), responses.website, 'PUT', input(WebsiteUpdateSchema, body)),
      publish: (orgId: string, body: B2BInputs['revision']) => request(orgPath(orgId, '/website/publish'), responses.website, 'POST', input(PublishSchema, body)),
      unpublish: (orgId: string, body: B2BInputs['revision']) => request(orgPath(orgId, '/website/unpublish'), responses.website, 'POST', input(PublishSchema, body)),
    },
    setup: { progress: (orgId: string) => request(orgPath(orgId, '/setup-progress'), responses.setupProgress) },
    media: {
      list: (orgId: string) => request(orgPath(orgId, '/media'), responses.mediaList),
      upload: (orgId: string, metadata: B2BInputs['media'], file: Blob) => {
        const query = new URLSearchParams(input(MediaUploadSchema, metadata))
        return request(orgPath(orgId, `/media?${query}`), responses.media, 'POST', file)
      },
    },
  }
}
export type B2BClient = ReturnType<typeof createB2BClient>
export const b2bClient = createB2BClient()
