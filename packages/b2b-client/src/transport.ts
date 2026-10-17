import { API_PREFIX } from '@klisteniapp/b2b-contracts/common'
import type { Role } from '@klisteniapp/b2b-contracts/common'
import { ApiError } from './errors.ts'
import { broadcastSessionChange } from './session-events.ts'

/** Parsers, rather than caller-selected response types, define the HTTP boundary. */
export type Parser<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown }
}
export type ClientOptions = {
  contractVersion?: 2
  signal?: AbortSignal
  contextSignal?: AbortSignal
  branchId?: string
  role?: Role
  fetch?: typeof fetch
  timeoutMs?: number
  uploadTimeoutMs?: number
  onAuthChange?: () => void
}
function errorDetails(value: unknown): { message?: string; code?: string } {
  if (!value || typeof value !== 'object') return {}
  const message =
    'message' in value && typeof value.message === 'string'
      ? value.message
      : 'error' in value && typeof value.error === 'string'
        ? value.error
        : undefined
  const code = 'code' in value && typeof value.code === 'string' ? value.code : undefined
  return { message, code }
}

export function createTransport(accountId?: string, options: ClientOptions = {}) {
  async function request<T>(
    path: string,
    schema: Parser<T>,
    method = 'GET',
    body?: unknown,
    requestId?: string,
  ): Promise<T> {
    if (options.signal?.aborted || options.contextSignal?.aborted)
      throw new ApiError('Solicitud cancelada.', 0, 'ABORTED')
    const controller = new AbortController()
    const cancel = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', cancel, { once: true })
    options.contextSignal?.addEventListener('abort', cancel, { once: true })
    const binary = body instanceof Blob
    const timeout = setTimeout(
      () => controller.abort(),
      binary ? (options.uploadTimeoutMs ?? 120_000) : (options.timeoutMs ?? 20_000),
    )
    try {
      const response = await (options.fetch ?? fetch)(`${API_PREFIX}${path}`, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.contractVersion
            ? { 'X-Klisteni-B2B-Contract': String(options.contractVersion) }
            : {}),
          ...(accountId ? { 'X-Klisteni-B2B-Account': accountId } : {}),
          ...(options.branchId ? { 'X-Klisteni-B2B-Branch': options.branchId } : {}),
          ...(options.role ? { 'X-Klisteni-B2B-Role': options.role } : {}),
          ...(requestId ? { 'Idempotency-Key': requestId } : {}),
          ...(body === undefined
            ? {}
            : {
                'Content-Type': binary
                  ? body.type || 'application/octet-stream'
                  : 'application/json',
              }),
        },
        ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
      })
      let result: unknown
      if (response.status !== 204) {
        try {
          result = await response.json()
        } catch (error) {
          // Keep a known HTTP rejection even if its body is unreadable: 401/403
          // must still clear protected UI state. Interrupted successful responses
          // are transport failures and retain the same retry behavior as fetch.
          if (response.ok && (controller.signal.aborted || !(error instanceof SyntaxError)))
            throw error
        }
      }
      if (!response.ok) {
        const error = errorDetails(result)
        if (
          accountId &&
          (response.status === 401 ||
            (response.status === 403 &&
              [
                'BRANCH_FORBIDDEN',
                'BRANCH_ARCHIVED',
                'CONTEXT_REVOKED',
                'MEMBERSHIP_REQUIRED',
              ].includes(error.code ?? '')))
        )
          (options.onAuthChange ?? broadcastSessionChange)()
        throw new ApiError(
          error.message ??
            (response.status === 401
              ? 'Iniciá sesión para continuar.'
              : 'No pudimos completar la solicitud.'),
          response.status,
          error.code,
        )
      }
      if (options.signal?.aborted || options.contextSignal?.aborted)
        throw new ApiError('Solicitud cancelada.', 0, 'ABORTED')
      // A successful auth operation has changed cookies even if its payload is malformed.
      if (
        path === '/auth/sign-in/email' ||
        path === '/auth/sign-out' ||
        path === '/invitations/sign-in'
      )
        (options.onAuthChange ?? broadcastSessionChange)()
      const parsed = schema.safeParse(result)
      if (!parsed.success)
        throw new ApiError(
          'El servicio devolvió datos incompatibles. Actualizá la página; tus cambios sin enviar se conservan.',
          502,
          'INVALID_RESPONSE',
        )
      return parsed.data
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (options.signal?.aborted || options.contextSignal?.aborted)
        throw new ApiError('Solicitud cancelada.', 0, 'ABORTED')
      throw new ApiError(
        controller.signal.aborted
          ? 'La solicitud tardó demasiado. Tus cambios sin enviar se conservan en pantalla.'
          : 'No pudimos conectar con el gimnasio. Tus cambios sin enviar se conservan en pantalla.',
        0,
        controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      )
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', cancel)
      options.contextSignal?.removeEventListener('abort', cancel)
    }
  }
  return request
}
