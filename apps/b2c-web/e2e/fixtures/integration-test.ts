import { test as base } from '@playwright/test'
export { expect } from '@playwright/test'
export type { Browser, Page, TestInfo } from '@playwright/test'

// Fictitious HTTP origins are not secure contexts. Supply only UUID generation
// for functional QA; this does not make the origin secure or change cookie/TLS rules.
export const test = base.extend({
  context: async ({ context }, use) => {
    if (process.env.QA_INTEGRATION_HTTP === '1') {
      await context.addInitScript(() => {
        if (typeof crypto.randomUUID !== 'function') {
          Object.defineProperty(crypto, 'randomUUID', {
            value: () => {
              const bytes = crypto.getRandomValues(new Uint8Array(16))
              bytes[6] = (bytes[6]! & 15) | 64
              bytes[8] = (bytes[8]! & 63) | 128
              const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
              return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
            },
          })
        }
      })
    }
    await use(context)
  },
})
