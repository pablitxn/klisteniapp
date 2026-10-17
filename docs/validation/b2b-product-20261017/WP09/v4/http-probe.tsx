import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createProductV2Client } from '/workspace/wp09-http591/packages/b2b-client/src/index.ts'
import { createWorkoutClient } from '/workspace/wp09-http591/apps/b2b-web/src/features/training/sync/workoutClient.ts'
import { IndexedDBWorkoutStore } from '/workspace/wp09-http591/apps/b2b-web/src/features/training/storage/workoutStore.ts'
import { ProductTrainingSession } from '/workspace/wp09-http591/apps/b2b-web/src/features/training/Session.tsx'
import { createWorkoutDocument, occurrenceWorkoutId } from '/workspace/wp09-http591/apps/b2b-web/src/features/training/sync/workoutEdit.ts'
import { workoutContentHash, newWorkoutId } from '/workspace/wp09-http591/apps/b2b-web/src/features/training/sync/workoutCrypto.ts'
import { access, scope as template, routine, environment } from '/workspace/wp09-http591/apps/b2b-web/tests/fixtures/workout.ts'
Object.assign(window, { httpProbe: {
  flags() { return { secureContext: isSecureContext, subtle: typeof crypto.subtle, randomUUID: typeof crypto.randomUUID, getRandomValues: typeof crypto.getRandomValues } },
  async mount() {
    const scope = { ...template, origin: location.origin }
    const id = await occurrenceWorkoutId(scope, 'http-occurrence')
    const initial = createWorkoutDocument(scope, id, { kind: 'occurrence', occurrenceId: 'http-occurrence', routine: { programId: routine.programId, version: routine.version, schemaVersion: 2 } }, routine, newWorkoutId, '2026-10-17T12:00:00.000Z')
    initial.content.notes = 'Entrené 🏋🏽‍♀️ · mañana · 東京'
    const store = new IndexedDBWorkoutStore(indexedDB, 'http-workout-hash-v4')
    const io = createWorkoutClient(signal => createProductV2Client('member', 'gym', { branchId: 'east', role: 'member', signal }))
    createRoot(document.getElementById('root')!).render(<StrictMode><ProductTrainingSession initial={initial} routine={routine} store={store} access={access} transport={io.transport} integrationAccepted={true} environment={environment} loadRemote={() => { throw Error('Not used in this transport probe') }} onClose={() => {}} /></StrictMode>)
    return { id, key: initial.key, utf8Hash: workoutContentHash(initial.content.notes), generatedId: newWorkoutId() }
  }
}})
