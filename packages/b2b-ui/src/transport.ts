/** Parsers, rather than caller-selected response types, define the HTTP boundary. */
export type Parser<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown }
}
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status: number, code = 'REQUEST_FAILED') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
export type ClientOptions = {
  signal?: AbortSignal
  fetch?: typeof fetch
  timeoutMs?: number
  uploadTimeoutMs?: number
  onAuthChange?: () => void
}
function broadcastAuthChange() {
  try {
    localStorage.setItem('klisteni.b2b.auth-change', crypto.randomUUID())
  } catch {
    /* Channel remains independent of storage availability. */
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('klisteni.b2b.auth')
    channel.postMessage('changed')
    channel.close()
  }
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
  ): Promise<T> {
    if (options.signal?.aborted) throw new ApiError('Solicitud cancelada.', 0, 'ABORTED')
    const controller = new AbortController()
    const cancel = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', cancel, { once: true })
    const binary = body instanceof Blob
    const timeout = setTimeout(
      () => controller.abort(),
      binary ? (options.uploadTimeoutMs ?? 120_000) : (options.timeoutMs ?? 20_000),
    )
    try {
      const response = await (options.fetch ?? fetch)(`/api/b2b${path}`, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(accountId ? { 'X-Klisteni-B2B-Account': accountId } : {}),
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
        throw new ApiError(
          error.message ??
            (response.status === 401
              ? 'Iniciá sesión para continuar.'
              : 'No pudimos completar la solicitud.'),
          response.status,
          error.code,
        )
      }
      // A successful auth operation has changed cookies even if its payload is malformed.
      if (path === '/auth/sign-in/email' || path === '/auth/sign-out')
        (options.onAuthChange ?? broadcastAuthChange)()
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
      if (options.signal?.aborted) throw new ApiError('Solicitud cancelada.', 0, 'ABORTED')
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
    }
  }
  return request
}
