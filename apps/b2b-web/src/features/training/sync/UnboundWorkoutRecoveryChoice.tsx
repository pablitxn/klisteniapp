import { useEffect, useRef, useState } from 'react'
import { Notice } from '@klisteniapp/b2b-ui'
import type { WorkoutDocument } from '../storage/workoutStore'
import type { WorkoutRecoveryStore } from '../storage/recoverySelection'
import {
  adoptUnboundWorkout,
  recoveryWorkoutScope,
  hasBlockedLegacyPayload,
  type WorkoutRecoveryContext,
} from '../storage/selectedWorkoutRecovery'
import { sameScope, unboundWorkoutScope } from '../storage/workoutIdentity'

/** A one-time visible choice for pre-realm IndexedDB work. The old record is
 * retained byte-for-byte; a claimed source cannot move into another realm. */
export function UnboundWorkoutRecoveryChoice({
  store,
  context,
  source,
  onAdopted,
  onOpenFresh,
}: {
  store: WorkoutRecoveryStore
  context: WorkoutRecoveryContext
  source: WorkoutDocument
  onAdopted: (document: WorkoutDocument) => void
  onOpenFresh: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    request = useRef<AbortController | null>(null)
  let current = false
  try {
    current =
      !context.signal.aborted &&
      sameScope(source.scope, unboundWorkoutScope(recoveryWorkoutScope(context)))
  } catch {
    /* Await current verified discovery. */
  }
  const identity = JSON.stringify([
    context.bootstrap.user.id,
    context.bootstrap.realm,
    context.access.organizationId,
    context.branchId,
    source.key,
  ])
  const active = useRef(identity)
  active.current = identity
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    return () => controller.abort()
  }, [identity, context.signal])
  async function adopt() {
    if (!current || busy || !request.current || request.current.signal.aborted) return
    const selectedIdentity = identity,
      signal = AbortSignal.any([context.signal, request.current.signal])
    setBusy(true)
    try {
      const selected = await adoptUnboundWorkout(store, { ...context, signal }, source)
      signal.throwIfAborted()
      if (active.current === selectedIdentity) onAdopted(selected.document)
    } catch (failure) {
      if (!signal.aborted && active.current === selectedIdentity) setError(String(failure))
    } finally {
      if (!signal.aborted && active.current === selectedIdentity) setBusy(false)
    }
  }
  if (!current) return <p role="status">Verificando el contexto del trabajo local…</p>
  return (
    <section className="card" aria-label="Recuperar borrador anterior al contexto autenticado">
      <h2>Encontramos trabajo anterior en este dispositivo</h2>
      <p>
        Podés retomar una copia en tu contexto actual o abrir un borrador limpio. Conservamos la
        copia anterior y los identificadores de sus envíos. No se envía ni completa por elegir aquí.
      </p>
      {hasBlockedLegacyPayload(source) && (
        <Notice>
          El envío del formato anterior requiere una compatibilidad explícita. No se convierte ni se
          reintenta automáticamente.
        </Notice>
      )}
      <Notice error>{error}</Notice>
      <button
        className="button primary"
        disabled={busy || hasBlockedLegacyPayload(source)}
        onClick={() => void adopt()}
      >
        Retomar copia anterior en este contexto
      </button>
      <button
        className="button"
        disabled={busy}
        onClick={() => {
          if (!context.signal.aborted) {
            request.current?.abort()
            onOpenFresh()
          }
        }}
      >
        Conservar anterior y abrir borrador limpio
      </button>
    </section>
  )
}
