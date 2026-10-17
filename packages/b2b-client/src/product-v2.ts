import {
  ProductEndpoints,
  type ProductEndpoint,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { ApiError } from './errors.ts'
import { createTransport, type ClientOptions, type Parser } from './transport.ts'

/** Explicit opt-in; legacy callers never send a new version or receive new DTOs. */
export function createProductV2Client(accountId: string, options: ClientOptions = {}) {
  const request = createTransport(accountId, { ...options, contractVersion: 2 })
  return {
    async call<K extends ProductEndpoint>(
      key: K,
      input: ProductInput<K>,
    ): Promise<ProductOutput<K>> {
      const endpoint = ProductEndpoints[key]
      const parsed = endpoint.input.safeParse(input)
      if (!parsed.success)
        throw new ApiError('Revisá los datos de la solicitud.', 400, 'INVALID_INPUT')
      const data: Record<string, unknown> = { ...parsed.data }
      const path = endpoint.path.replace(/:([a-zA-Z]+)/g, (_, name: string) => {
        const value = data[name]
        delete data[name]
        return encodeURIComponent(String(value))
      })
      const query =
        endpoint.method === 'GET'
          ? new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString()
          : ''
      return request(
        `${path}${query ? `?${query}` : ''}`,
        endpoint.output as Parser<ProductOutput<K>>,
        endpoint.method,
        endpoint.method === 'POST' ? parsed.data : undefined,
        'operationId' in data ? String(data.operationId) : undefined,
      )
    },
  }
}
export type ProductV2Client = ReturnType<typeof createProductV2Client>
