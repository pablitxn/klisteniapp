import { createRoot } from 'react-dom/client'
import { ProductTrainingSession } from './source/apps/b2b-web/src/features/training/sync/ProductTrainingSession'
import { IndexedDBWorkoutStore } from './source/apps/b2b-web/src/features/training/storage/workoutStore'
import { createWorkoutDocument } from './source/apps/b2b-web/src/features/training/sync/workoutEdit'
import { routine, scope as template, access, environment, now } from './source/apps/b2b-web/tests/fixtures/workout'

let root: ReturnType<typeof createRoot> | null = null
let actual: IndexedDBWorkoutStore
let key = ''
let releaseGate = () => {}
let ready = false
let held = false
let closed = false
let sequence = 0
let events: unknown[] = []
let store: unknown
const first = 'Notes entered before slow storage'
const second = 'Final reason entered before close'

async function mount() {
  root?.unmount()
  root = null
  sequence++
  ready = false; held = false; closed = false; events = []
  actual = new IndexedDBWorkoutStore(indexedDB, `close-proof-${sequence}`)
  let create = 0
  const initial = createWorkoutDocument(
    { ...template, origin: location.origin }, `close-proof-${sequence}`,
    { kind: 'occurrence', occurrenceId: 'occurrence', routine: { programId: 'routine', version: 1, schemaVersion: 2 } },
    routine, () => `identity-${++create}`, now,
  )
  key = initial.key
  const gate = new Promise<void>(resolve => { releaseGate = resolve })
  store = {
    read: (k: string) => actual.read(k),
    preserveLegacy: (k: string, bytes: string) => actual.preserveLegacy(k, bytes),
    async compareAndSet(document: any, expected: number | null, signal?: AbortSignal) {
      events.push({ event: 'write-start', generation: document.generation, notes: document.content.notes, reason: document.content.correctionReason })
      if (!held && document.content.notes === first) {
        held = true
        events.push({ event: 'hold-first-edit' })
        await gate
        events.push({ event: 'release-first-edit' })
      }
      await actual.compareAndSet(document, expected, signal)
      events.push({ event: 'write-committed', generation: document.generation, notes: document.content.notes, reason: document.content.correctionReason })
    },
  }
  root = createRoot(document.getElementById('root')!)
  root.render(<ProductTrainingSession
    initial={initial} routine={routine} store={store as any} access={access}
    transport={{ access: async () => access, save: async () => { throw new Error('No network mutation expected') } }}
    integrationAccepted={false} environment={environment}
    onDocumentReady={async () => { ready = true; events.push({ event: 'document-ready' }) }}
    onClose={() => {
      events.push({ event: 'close-click' })
      root?.unmount()
      root = null
      closed = true
    }}
    loadRemote={async () => { throw new Error('Not used') }}
  />)
}
Object.assign(window, { closeProof: {
  mount,
  state: () => ({ ready, held, closed, events }),
  release: () => releaseGate(),
  read: () => actual.read(key),
  reopen: async () => new IndexedDBWorkoutStore(indexedDB, `close-proof-${sequence}`).read(key),
  first, second,
} })
