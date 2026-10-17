import type { ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductInput, ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import type { WorkoutTransport } from './workoutSync.ts'

/** INTEGRATION supplies a client bound to the current authenticated host/account/
 * branch/role and context signal. Every call also receives its caller's signal. */
export function createWorkoutClient(clientForSignal: (signal: AbortSignal) => ProductV2Client) {
  const transport: WorkoutTransport = {
    access: (signal) => clientForSignal(signal).call('access', {}),
    save: (payload, signal) => clientForSignal(signal).call('saveSession', payload),
  }
  return {
    transport,
    async routineVersion(
      reference: ProductInput<'saveSession'>['origin']['routine'],
      signal: AbortSignal,
    ): Promise<ProductOutput<'routineVersion'>> {
      signal.throwIfAborted()
      const stored = await clientForSignal(signal).call('routineVersion', {
        id: reference.programId,
        version: reference.version,
      })
      signal.throwIfAborted()
      if (
        stored.schemaVersion !== reference.schemaVersion ||
        stored.snapshot.programId !== reference.programId ||
        stored.snapshot.version !== reference.version
      )
        throw new Error('Issued routine discriminator or identity mismatch')
      // Return the strict stored union. Legacy missing doses remain missing;
      // callers cannot substitute mutable draft/publication-choice projections.
      return stored
    },
    async latestRevision(id: string, signal: AbortSignal) {
      signal.throwIfAborted()
      const revisions = await clientForSignal(signal).call('sessionRevisions', { id })
      signal.throwIfAborted()
      if (
        revisions.some(
          (revision) => (revision.schemaVersion === 2 ? revision.id : revision.original.id) !== id,
        )
      )
        throw new Error('Foreign session revision')
      const current = revisions
        .filter((revision) => revision.schemaVersion === 2)
        .sort((a, b) => b.revision - a.revision)[0]
      if (!current)
        throw new Error('Legacy revision zero needs an explicit legacy correction projection')
      return current
    },
  }
}
