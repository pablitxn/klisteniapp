import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import type {
  ProductEndpoint,
  ProductInput,
  ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import type { HealthAccess } from '../src/features/health/healthAccess.ts'
import { HealthController } from '../src/features/health/healthState.ts'

export const own: ProductOutput<'ownHealth'> = {
  schemaVersion: 2,
  ownerId: 'owner',
  revision: 3,
  data: {
    version: 1,
    profile: {},
    goals: [],
    measurements: [],
    sleep: [],
    activity: [],
    nutrition: [],
    supplements: [],
  },
}
export const consent: ProductOutput<'grantHealthConsent'> = {
  schemaVersion: 2,
  id: 'consent',
  ownerId: 'owner',
  scope: { organizationId: 'atlas', branchId: 'east' },
  revision: 2,
  status: 'active',
  categories: ['sleep'],
  audience: 'current-authorized-branch-trainers',
  disclosureVersion: 1,
  grantedAt: '2026-10-16T12:00:00.000Z',
  revokedAt: null,
}
export const preview: ProductOutput<'previewHealthImport'> = {
  schemaVersion: 2,
  expectedRevision: 3,
  format: 'klisteniapp.health',
  version: 1,
  previewHash: 'a'.repeat(64),
  expiresAt: '2026-10-17T12:05:00.000Z',
  additions: { measurements: 0, sleep: 1, activity: 0, nutrition: 0, supplements: 0 },
  duplicates: 2,
  conflicts: [],
  issues: [],
}
export const projection: ProductOutput<'consentedHealth'> = {
  schemaVersion: 2,
  ownerId: 'owner',
  consentId: 'consent',
  consentRevision: 2,
  scope: consent.scope,
  viewedAt: '2026-10-17T12:00:00.000Z',
  categories: [
    {
      category: 'sleep',
      records: [
        {
          id: 'synthetic-sleep',
          date: '2026-10-16',
          recordedAt: '2026-10-16T12:00:00.000Z',
          source: { kind: 'manual' },
          durationMinutes: 480,
        },
      ],
    },
  ],
}
export const raw = JSON.stringify({
  format: 'klisteniapp.health',
  version: 1,
  exportedAt: '2026-10-16T12:00:00.000Z',
  timeZone: 'Etc/UTC',
  records: {},
})
export const file = { name: 'synthetic.json', size: raw.length, text: async () => raw }
export function access(trainer = false): HealthAccess {
  return {
    accountId: trainer ? 'trainer' : 'owner',
    organizationId: 'atlas',
    branchId: 'east',
    hostBinding: 'atlas.example.test:g1',
    generation: 'current-1',
    signal: new AbortController().signal,
    access: {
      schemaVersion: 2,
      userId: trainer ? 'trainer' : 'owner',
      organizationId: 'atlas',
      role: trainer ? 'coach' : 'member',
      accessMode: 'active',
      accessRevision: 1,
      branches: [{ branchId: 'east', role: trainer ? 'coach' : 'member' }],
      capabilities: trainer
        ? ['read-consented-health']
        : ['manage-own-health', 'export-own-records'],
    },
  }
}
type Handlers = {
  [K in ProductEndpoint]?: (
    input: ProductInput<K>,
    signal: AbortSignal,
  ) => Promise<ProductOutput<K>> | ProductOutput<K>
}
export function fixture(trainer = false, handlers: Handlers = {}) {
  const context = access(trainer)
  const calls: { key: ProductEndpoint; input: unknown; signal: AbortSignal }[] = []
  let now = Date.parse('2026-10-17T12:00:00.000Z')
  let invalidations = 0
  let sequence = 0
  const defaults: Handlers = {
    ownHealth: () => structuredClone(own),
    healthConsents: () => [],
    previewHealthImport: () => structuredClone(preview),
    applyHealthImport: () => ({ ...structuredClone(own), revision: 4 }),
    grantHealthConsent: () => structuredClone(consent),
    revokeHealthConsent: () => ({
      ...structuredClone(consent),
      revision: 3,
      status: 'revoked',
      revokedAt: '2026-10-17T12:00:00.000Z',
    }),
    consentedHealth: () => structuredClone(projection),
  }
  const controller = new HealthController(context, {
    now: () => now,
    id: () => `operation-${++sequence}`,
    invalidateViews: () => {
      invalidations++
    },
    client: (signal) =>
      ({
        call: async <K extends ProductEndpoint>(
          key: K,
          input: ProductInput<K>,
        ): Promise<ProductOutput<K>> => {
          calls.push({ key, input: structuredClone(input), signal })
          const handler = (handlers[key] ?? defaults[key]) as
            | ((
                input: ProductInput<K>,
                signal: AbortSignal,
              ) => Promise<ProductOutput<K>> | ProductOutput<K>)
            | undefined
          if (!handler) throw new ApiError('Missing fixture', 500)
          return handler(input, signal)
        },
      }) satisfies ProductV2Client,
  })
  controller.start()
  controller.setEnvironment(true, true)
  return {
    context,
    controller,
    calls,
    handlers,
    advance: (ms: number) => {
      now += ms
    },
    invalidations: () => invalidations,
  }
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
