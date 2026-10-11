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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un problema. Volvé a intentar.'
}
