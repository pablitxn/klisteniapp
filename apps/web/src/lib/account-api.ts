import { ServerStateSchema, type CardioLog, type PersonalData, type PersonalSettings, type ProgressData, type WorkoutLog } from '@klisteniapp/scene-schema'
import { z } from 'zod'

export interface AccountUser { id: string; email: string; name: string; role?: 'admin' | 'user' }
const AdminUserSchema = z.object({ id: z.string(), email: z.string(), name: z.string(), role: z.enum(['admin', 'user']), disabled: z.boolean(), createdAt: z.string() })
const InvitationSchema = z.object({ id: z.string(), email: z.string(), name: z.string().nullish(), kind: z.enum(['activation', 'recovery']), role: z.enum(['admin', 'user']), createdAt: z.string(), expiresAt: z.string(), status: z.enum(['pending', 'used', 'revoked', 'expired']), deliveryStatus: z.string().nullish() })
const IssuedInvitationSchema = z.object({ invitation: InvitationSchema, url: z.string(), delivery: z.object({ status: z.enum(['not_requested', 'smtp_accepted', 'unavailable', 'failed']) }) })
const TokenInfoSchema = z.object({ kind: z.enum(['activation', 'recovery']), email: z.string(), name: z.string().nullish(), expiresAt: z.string() })
const SuccessSchema = z.object({ ok: z.literal(true) })
export type AdminUser = z.infer<typeof AdminUserSchema>
export type AccountInvitation = z.infer<typeof InvitationSchema>
export type IssuedInvitation = z.infer<typeof IssuedInvitationSchema>
export class AccountApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status = 0, code = 'NETWORK_ERROR') {
    super(message)
    this.name = 'AccountApiError'
    this.status = status
    this.code = code
  }
}
async function request(path: string, method = 'GET', body?: unknown, userId?: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(path, {
      method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(userId ? { 'X-Klisteni-Account': userId } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    let value: unknown = null
    if (response.status !== 204) {
      try { value = await response.json() }
      catch { throw new AccountApiError('El servicio de cuentas devolvió una respuesta que no podemos leer.', response.status, 'INVALID_RESPONSE') }
    }
    if (!response.ok) {
      const error = value && typeof value === 'object' ? value as { error?: unknown; message?: unknown; code?: unknown } : {}
      throw new AccountApiError(typeof error.error === 'string' ? error.error : typeof error.message === 'string' ? error.message : 'No pudimos completar la solicitud.', response.status, typeof error.code === 'string' ? error.code : 'HTTP_ERROR')
    }
    if (value === null && response.status !== 204 && !response.headers.get('content-type')?.includes('application/json')) throw new AccountApiError('El servicio de cuentas no está disponible.', response.status, 'INVALID_RESPONSE')
    return value
  } catch (error) {
    if (error instanceof AccountApiError) throw error
    throw new AccountApiError('No pudimos conectar con tu cuenta. Revisá la conexión y volvé a intentar.')
  } finally { clearTimeout(timer) }
}
async function stateRequest(path: string, method = 'GET', body?: unknown, userId?: string) {
  const result = ServerStateSchema.safeParse(await request(path, method, body, userId))
  if (!result.success) throw new AccountApiError('El servidor devolvió datos que no podemos leer.', 200, 'INVALID_RESPONSE')
  return result.data
}
async function parsedRequest<T>(schema: z.ZodType<T>, path: string, method = 'GET', body?: unknown, userId?: string): Promise<T> {
  const result = schema.safeParse(await request(path, method, body, userId))
  if (!result.success) throw new AccountApiError('El servidor devolvió una respuesta que no podemos leer.', 200, 'INVALID_RESPONSE')
  return result.data
}
export const accountApi = {
  async session(): Promise<AccountUser | null> {
    const response = await request('/api/auth/get-session')
    if (response === null) return null
    const user = typeof response === 'object' && 'user' in response ? response.user : null
    if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string' || !('email' in user) || typeof user.email !== 'string' || !('name' in user) || typeof user.name !== 'string') throw new AccountApiError('No pudimos verificar la sesión.', 200, 'INVALID_RESPONSE')
    return { id: user.id, email: user.email, name: user.name, role: 'role' in user && user.role === 'admin' ? 'admin' : 'user' }
  },
  signIn: (email: string, password: string) => request('/api/auth/sign-in/email', 'POST', { email, password }),
  signOut: (userId?: string) => request('/api/auth/sign-out', 'POST', {}, userId),
  state: (userId: string) => stateRequest('/api/me/state', 'GET', undefined, userId),
  settings: (settings: PersonalSettings, expectedRevision: number, userId: string) => stateRequest('/api/me/settings', 'PUT', { settings, expectedRevision }, userId),
  addWorkout: (log: WorkoutLog, userId: string) => stateRequest('/api/me/logs', 'POST', { kind: 'workout', log }, userId),
  addCardio: (log: CardioLog, userId: string) => stateRequest('/api/me/logs', 'POST', { kind: 'cardio', log }, userId),
  removeLog: (id: string, userId: string) => stateRequest(`/api/me/logs/${encodeURIComponent(id)}`, 'DELETE', undefined, userId),
  importData: (data: PersonalData | ProgressData, includeSettings: boolean, expectedRevision: number, userId: string) => stateRequest('/api/me/import', 'POST', { data, includeSettings, expectedRevision }, userId),
  tokenInfo: (token: string) => parsedRequest(TokenInfoSchema, '/api/account/token-info', 'POST', { token }),
  acceptInvitation: (input: { token: string; name: string; password: string }) => parsedRequest(SuccessSchema, '/api/account/activate', 'POST', input),
  requestRecovery: (email: string) => parsedRequest(SuccessSchema, '/api/account/request-recovery', 'POST', { email }),
  completeRecovery: (input: { token: string; password: string }) => parsedRequest(SuccessSchema, '/api/account/reset-password', 'POST', input),
  adminUsers: (userId: string) => parsedRequest(z.object({ users: z.array(AdminUserSchema) }), '/api/admin/users', 'GET', undefined, userId),
  adminInvitations: (userId: string) => parsedRequest(z.object({ invitations: z.array(InvitationSchema), mailConfigured: z.boolean() }), '/api/admin/invitations', 'GET', undefined, userId),
  invite: (input: { email: string; name?: string; sendEmail: boolean }, userId: string) => parsedRequest(IssuedInvitationSchema, '/api/admin/invitations', 'POST', input, userId),
  reissueInvitation: (id: string, sendEmail: boolean, userId: string) => parsedRequest(IssuedInvitationSchema, `/api/admin/invitations/${encodeURIComponent(id)}/reissue`, 'POST', { sendEmail }, userId),
  revokeInvitation: (id: string, userId: string) => parsedRequest(SuccessSchema, `/api/admin/invitations/${encodeURIComponent(id)}/revoke`, 'POST', {}, userId),
  manageUser: (id: string, action: 'disable' | 'enable' | 'revoke-sessions', userId: string) => parsedRequest(SuccessSchema, `/api/admin/users/${encodeURIComponent(id)}/${action}`, 'POST', {}, userId),
  createRecovery: (id: string, sendEmail: boolean, userId: string) => parsedRequest(IssuedInvitationSchema, `/api/admin/users/${encodeURIComponent(id)}/recovery`, 'POST', { sendEmail }, userId),
}
