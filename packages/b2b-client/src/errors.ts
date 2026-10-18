import type { ProductIssue } from '@klisteniapp/b2b-contracts/product-v2'
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues?: ProductIssue[]

  constructor(message: string, status: number, code = 'REQUEST_FAILED', issues?: ProductIssue[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.issues = issues
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un problema. Volvé a intentar.'
}
